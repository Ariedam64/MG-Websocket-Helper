const WebSocket = require("ws");

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const LOWER_ALPHA = "abcdefghijklmnopqrstuvwxyz";

const DEFAULTS = {
  host: "magicgarden.gg",
  gameName: "Quinoa",
  userAgent: "Mozilla/5.0",
};

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
  constructor({ cookie, room, version, host, userAgent } = {}) {
    this.cookie = normalizeCookie(cookie);
    this.room = (room || "").trim() || generateRoomId();
    this.version = (version || "").trim();
    this.host = host || DEFAULTS.host;
    this.userAgent = userAgent || DEFAULTS.userAgent;
    this.playerId = generatePlayerId();

    this.ws = null;
    this.onMessage = null; // callback(parsed) - set from main.js
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
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  // --- Internal ---

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

    if (this.onMessage) {
      this.onMessage(normalizePartialState(parsed));
    }
  }

  _onClose() {}

  _onError() {}

}

module.exports = { Connection, DEFAULTS, normalizePartialState };
