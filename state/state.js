const { applyPointer } = require("./jsonPatch");
const { Player } = require("./models/player");
const { Shop } = require("./models/shop");
const { Room } = require("./models/room");

/**
 * The game renamed the slot's owner field from `playerId` to `userId` (same
 * value: the id Welcome reports as `selfPlayerId`); slots now carry
 * `playerId: null`. Both names are accepted.
 */
function matchesPlayer(slot, playerId) {
  if (!playerId) return false;
  return slot.userId === playerId || slot.playerId === playerId || slot.data?.playerId === playerId;
}

/**
 * Fallback match on the player's Discord/database id. The id fields sit at the
 * slot's top level, but some payloads repeat them inside `data`.
 */
function matchesDb(slot, dbId) {
  if (!dbId) return false;
  const data = slot.data || {};
  return (
    slot.discordUserId === dbId ||
    slot.databaseUserId === dbId ||
    data.discordUserId === dbId ||
    data.databaseUserId === dbId ||
    data.userId === dbId
  );
}

class GameState {
  constructor() {
    // Raw state: patches apply to fullState, roomState / gameState are views
    // of it (fullState.data / fullState.child.data)
    this.fullState = null;
    this.roomState = null;
    this.gameState = null;
    this.welcomed = false;
    this.selfPlayerId = null; // our own player id, as Welcome reports it

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

    this.fullState = fullState;
    this._syncRawState();
    this.selfPlayerId = msg.selfPlayerId || this.selfPlayerId;
    this.welcomed = true;

    this._buildModels();
  }

  /**
   * Apply patches from a PartialState message (a normalized RoomFrame).
   *
   * Like the game, every patch applies to the whole `fullState`: `/data/...`
   * is the room, `/child/data/...` the game. A whole `/child` or `/data` can
   * be replaced, hence the re-sync of the two views afterwards.
   */
  handlePartialState(msg) {
    const patches = msg.patches;
    if (!this.fullState || !Array.isArray(patches) || patches.length === 0) return;

    for (const { path, value, op } of patches) {
      if (typeof path !== "string") continue;
      this.fullState = applyPointer(this.fullState, path, value, op);
    }
    this._syncRawState();

    // Rebuild models from updated raw state
    this._buildModels();
  }

  _syncRawState() {
    this.roomState = this.fullState?.data || null;
    this.gameState = this.fullState?.child?.data || null;
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

      for (let i = 0; i < userSlots.length; i++) {
        const slot = userSlots[i];
        if (!slot) continue;

        if (matchesPlayer(slot, player.id) || matchesDb(slot, player.databaseUserId)) {
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

  /** Our own player, once Welcome has told us which one it is. */
  getSelf() {
    return this.selfPlayerId ? this.players.get(this.selfPlayerId) : undefined;
  }

  /** Stock left in a shop for our own player, see Shop.remainingStocks(). */
  getRemainingStocks(type) {
    const shop = this.shops.get(type);
    if (!shop) return {};
    return shop.remainingStocks(this.getSelf()?.shopPurchases?.[type]);
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
    this.fullState = null;
    this.roomState = null;
    this.gameState = null;
    this.welcomed = false;
    this.selfPlayerId = null;
    this.room = null;
    this.players.clear();
    this.shops.clear();
    this.weather = null;
  }
}

module.exports = { GameState };
