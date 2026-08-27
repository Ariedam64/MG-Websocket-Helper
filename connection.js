const WebSocket = require("ws");
const crypto = require("crypto");

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const LOWER_ALPHA = "abcdefghijklmnopqrstuvwxyz";

const DEFAULTS = {
  host: "magicgarden.gg",
  gameName: "Quinoa",
  userAgent: "Mozilla/5.0",
};

const GAME_SCOPE = ["Room", DEFAULTS.gameName];

// Same 5s budget the game client gives a QuinoaCommand before giving up.
const COMMAND_TIMEOUT_MS = 5000;

// The first command of a session is `Welcome.executedCommandSequence + 1`.
const FIRST_COMMAND_SEQUENCE = 1;

function generatePlayerId() {
  const bytes = require("crypto").randomBytes(16);
  const id = Array.from(bytes)
    .map((b) => BASE58[b % BASE58.length])
    .join("");
  return `p_${id}`;
}

function generateRoomId() {
  const bytes = require("crypto").randomBytes(10);
  return Array.from(bytes)
    .map((b) => LOWER_ALPHA[b % LOWER_ALPHA.length])
    .join("");
}

// The game's netcode is migrating PartialState -> RoomFrame (same data,
// patches moved from msg.patches to msg.state.patches). Normalize RoomFrame
// into the old PartialState shape so downstream consumers don't need to
// know about both formats. Remove once PartialState is fully retired.
function normalizePartialState(msg) {
  if (msg && msg.type === "RoomFrame") {
    return { ...msg, type: "PartialState", patches: msg.state?.patches || [] };
  }
  return msg;
}

function normalizeCookie(cookie) {
  const trimmed = (cookie || "").trim();
  if (!trimmed) return "";
  return trimmed.includes("mc_jwt") ? trimmed : `mc_jwt=${trimmed}`;
}

function buildUrl(host, version, room, playerId) {
  const base = `wss://${host}/version/${version}/api/rooms/${room}/connect`;
  const params = new URLSearchParams({
    surface: '"web"',
    platform: '"desktop"',
    playerId: `"${playerId}"`,
    version: `"${version}"`,
    source: '"manualUrl"',
    capabilities: '"fbo_mipmap_ok"',
  });
  return `${base}?${params}`;
}

class Connection {
  constructor({ cookie, room, version, host, userAgent, commandTimeoutMs } = {}) {
    this.cookie = normalizeCookie(cookie);
    this.room = (room || "").trim() || generateRoomId();
    this.version = (version || "").trim();
    this.host = host || DEFAULTS.host;
    this.userAgent = userAgent || DEFAULTS.userAgent;
    this.commandTimeoutMs = commandTimeoutMs || COMMAND_TIMEOUT_MS;
    this.playerId = generatePlayerId();

    this.ws = null;
    this.onMessage = null; // callback(parsed) - set from main.js

    this._resetCommandSession();
  }

  connect() {
    if (!this.cookie || !this.version) {
      throw new Error("Missing cookie or version");
    }

    this.disconnect();
    this.playerId = generatePlayerId();

    const url = buildUrl(this.host, this.version, this.room, this.playerId);

    this.ws = new WebSocket(url, {
      headers: {
        "User-Agent": this.userAgent,
        Cookie: this.cookie,
        Origin: `https://${this.host}`,
      },
    });

    this.ws.on("open", () => this._onOpen());
    this.ws.on("message", (data) => this._onRawMessage(data));
    this.ws.on("close", (code, reason) => this._onClose(code, reason));
    this.ws.on("error", (err) => this._onError(err));

    return url;
  }

  disconnect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "client disconnect");
      }
      this.ws = null;
    }
    this._resetCommandSession();
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  // --- Quinoa command envelope ---

  /**
   * Send a gameplay command inside the QuinoaCommand envelope:
   *   { scopePath, type: "QuinoaCommand", requestId, commandSequence, command }
   *
   * Commands are only valid once the server has sent Welcome (that message
   * carries the sequence number to resume from), so anything sent earlier is
   * queued and flushed on Welcome.
   *
   * @param {{type: string}} command
   * @returns {Promise<object|null>} the QuinoaCommandResult, or null on timeout
   *   / disconnect. Never rejects, so callers may ignore the promise.
   */
  sendQuinoaCommand(command) {
    if (!this.commandSessionReady) {
      return new Promise((resolve) => {
        this.pendingCommands.push({ command, resolve });
      });
    }
    return this._dispatchQuinoaCommand(command);
  }

  /** Sequence number the next command will carry (nth command since Welcome). */
  nextCommandSequence() {
    return this.commandSequence;
  }

  // --- Internal ---

  _resetCommandSession() {
    // Nothing in flight can still be answered: settle waiters instead of
    // leaving their promises hanging.
    for (const { resolve, timeoutId } of this.pendingResults?.values() || []) {
      clearTimeout(timeoutId);
      resolve(null);
    }
    for (const { resolve } of this.pendingCommands || []) resolve(null);

    this.commandSessionReady = false;
    this.commandSequence = FIRST_COMMAND_SEQUENCE;
    this.executedCommandSequence = 0;
    this.pendingCommands = []; // sent before Welcome, flushed after
    this.pendingResults = new Map(); // requestId -> { resolve, timeoutId }
  }

  _dispatchQuinoaCommand(command) {
    const requestId = crypto.randomUUID();
    const commandSequence = this.commandSequence;
    this.commandSequence += 1;

    this.send(
      JSON.stringify({
        scopePath: GAME_SCOPE,
        type: "QuinoaCommand",
        requestId,
        commandSequence,
        command,
      })
    );

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingResults.delete(requestId);
        resolve(null);
      }, this.commandTimeoutMs);
      timeoutId.unref?.(); // a pending result shouldn't keep the process alive
      this.pendingResults.set(requestId, { resolve, timeoutId });
    });
  }

  _onCommandSessionReady(welcome) {
    // Resume where the server left off; absent field means a fresh session.
    this.executedCommandSequence = welcome.executedCommandSequence || 0;
    this.commandSequence = this.executedCommandSequence + 1;
    this.commandSessionReady = true;

    const queued = this.pendingCommands;
    this.pendingCommands = [];
    for (const { command, resolve } of queued) {
      this._dispatchQuinoaCommand(command).then(resolve);
    }
  }

  _onCommandResult(msg) {
    const pending = this.pendingResults.get(msg.requestId);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingResults.delete(msg.requestId);
    pending.resolve(msg);
  }

  _onOpen() {
    // Handshake
    this.send(
      JSON.stringify({
        scopePath: ["Room"],
        type: "VoteForGame",
        gameName: DEFAULTS.gameName,
      })
    );
    this.send(
      JSON.stringify({
        scopePath: ["Room"],
        type: "SetSelectedGame",
        gameName: DEFAULTS.gameName,
      })
    );

  }

  _onRawMessage(data) {
    const raw = data.toString();

    // Respond to server pings
    if (raw === "ping" || raw === '"ping"') {
      this.send("pong");
      return;
    }

    // Ignore pong
    if (raw === "pong" || raw === '"pong"') return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (parsed.type === "Welcome") {
      this._onCommandSessionReady(parsed);
    } else if (parsed.type === "RoomFrame") {
      this.executedCommandSequence = Math.max(
        this.executedCommandSequence,
        parsed.executedCommandSequence || 0
      );
    } else if (parsed.type === "QuinoaCommandResult") {
      this._onCommandResult(parsed);
    }

    if (this.onMessage) {
      this.onMessage(normalizePartialState(parsed));
    }
  }

  _onClose() {
    this._resetCommandSession();
  }

  _onError() {}

}

module.exports = {
  Connection,
  DEFAULTS,
  GAME_SCOPE,
  COMMAND_TIMEOUT_MS,
  normalizePartialState,
};
