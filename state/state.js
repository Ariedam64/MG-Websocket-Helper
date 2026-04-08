const { applyPatch } = require("./jsonPatch");
const { Player } = require("./models/player");
const { Shop } = require("./models/shop");
const { Room } = require("./models/room");

class GameState {
  constructor() {
    // Raw state (for patch application)
    this.roomState = null;
    this.gameState = null;
    this.welcomed = false;

    // Models
    this.room = null;
    this.players = new Map(); // playerId -> Player
    this.shops = new Map(); // type -> Shop
    this.weather = null;
  }

  /**
   * Initialize state from a Welcome message.
   */
  handleWelcome(msg) {
    const fullState = msg.fullState;
    if (!fullState) return;

    this.roomState = fullState.data || null;
    this.gameState = fullState.child?.data || null;
    this.welcomed = true;

    this._buildModels();
  }

  /**
   * Apply patches from a PartialState message.
   */
  handlePartialState(msg) {
    const patches = msg.patches;
    if (!Array.isArray(patches) || patches.length === 0) return;

    for (const patch of patches) {
      const { path, value, op } = patch;
      if (!path) continue;

      // Room state patches
      if (
        this.roomState &&
        (/^\/data\/players\/\d+(\/.*)?$/.test(path) ||
          /^\/data\/(roomId|roomSessionId|hostPlayerId|gameVotes|chat|selectedGame)(\/.*)?$/.test(
            path
          ))
      ) {
        this.roomState = applyPatch(this.roomState, path, value, op);
        continue;
      }

      // Game state patches (everything under /child)
      if (this.gameState && path.startsWith("/child")) {
        const gamePath = path.replace(/^\/child/, "");
        this.gameState = applyPatch(this.gameState, gamePath, value, op);
        continue;
      }
    }

    // Rebuild models from updated raw state
    this._buildModels();
  }

  /**
   * Process any incoming message.
   */
  handleMessage(msg) {
    if (msg.type === "Welcome") {
      this.handleWelcome(msg);
    } else if (msg.type === "PartialState") {
      this.handlePartialState(msg);
    }
  }

  /**
   * Build/rebuild all models from raw state.
   */
  _buildModels() {
    this._buildRoom();
    this._buildPlayers();
    this._buildShops();
    this._buildWeather();
  }

  _buildRoom() {
    if (!this.roomState) return;
    this.room = new Room(this.roomState);
  }

  _buildPlayers() {
    if (!this.roomState) return;

    const roomPlayers = this.roomState.players || [];
    const userSlots = this.gameState?.userSlots || [];

    this.players.clear();

    for (const roomPlayer of roomPlayers) {
      const player = new Player(roomPlayer);

      // Find matching userSlot by playerId or databaseUserId
      for (let i = 0; i < userSlots.length; i++) {
        const slot = userSlots[i];
        if (!slot) continue;

        if (
          slot.playerId === player.id ||
          slot.databaseUserId === player.databaseUserId
        ) {
          player.applySlot(slot, i);
          break;
        }
      }

      this.players.set(player.id, player);
    }
  }

  _buildShops() {
    if (!this.gameState?.shops) return;

    this.shops.clear();
    for (const [type, data] of Object.entries(this.gameState.shops)) {
      this.shops.set(type, new Shop(type, data));
    }
  }

  _buildWeather() {
    this.weather = this.gameState?.weather || null;
  }

  // --- Accessors ---

  getRoom() {
    return this.room;
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getAllPlayers() {
    return [...this.players.values()];
  }

  getShop(type) {
    return this.shops.get(type);
  }

  getAllShops() {
    return [...this.shops.values()];
  }

  getWeather() {
    return this.weather;
  }

  reset() {
    this.roomState = null;
    this.gameState = null;
    this.welcomed = false;
    this.room = null;
    this.players.clear();
    this.shops.clear();
    this.weather = null;
  }
}

module.exports = { GameState };
