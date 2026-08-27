const { GAME_SCOPE } = require("./connection");

const GAME = "Quinoa";
const ROOM_SCOPE = ["Room"];

// How Quinoa-scoped actions are framed on the wire.
//   "envelope" — new QuinoaCommand envelope (requestId + commandSequence).
//   "legacy"   — flat `{ scopePath, type, ...params }` message.
// The server still honours "legacy" but it is being removed, so the envelope
// is the default. Keep "legacy" as an escape hatch for older servers.
const COMMAND_MODES = { ENVELOPE: "envelope", LEGACY: "legacy" };

// Quinoa messages that are NOT commands and stay flat in both modes: Ping has
// its own Pong reply, and PlayerPosition feeds the movement snapshot/batch
// channel rather than the command pipeline.
const RAW_GAME_TYPES = new Set(["Ping", "PlayerPosition"]);

/** Drop keys the caller left undefined so optional fields stay off the wire. */
function compact(params) {
  const result = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

class Actions {
  /**
   * @param {import("./connection").Connection} connection
   * @param {{ commandMode?: "envelope" | "legacy" }} [options]
   */
  constructor(connection, { commandMode = COMMAND_MODES.ENVELOPE } = {}) {
    this.conn = connection;
    this.commandMode = commandMode;
  }

  _send(scopePath, type, params = {}) {
    this.conn.send(JSON.stringify({ scopePath, type, ...compact(params) }));
  }

  _room(type, params) { this._send(ROOM_SCOPE, type, params); }

  /**
   * Send a Quinoa action. In envelope mode this returns the promise from
   * `Connection.sendQuinoaCommand` (resolves with the QuinoaCommandResult, or
   * null on timeout); in legacy mode it is fire-and-forget.
   */
  _game(type, params = {}) {
    if (this.commandMode === COMMAND_MODES.LEGACY || RAW_GAME_TYPES.has(type)) {
      this._send(GAME_SCOPE, type, params);
      return undefined;
    }
    return this.conn.sendQuinoaCommand({ type, ...compact(params) });
  }

  // =====================
  // Session / Heartbeat
  // =====================

  ping(id = Date.now()) { this._game("Ping", { id }); }
  setSelectedGame(gameName = GAME) { this._room("SetSelectedGame", { gameName }); }
  voteForGame(gameName = GAME) { this._room("VoteForGame", { gameName }); }
  restartGame(gameName = GAME) { this._room("RestartGame", { name: gameName }); }
  checkWeatherStatus() { return this._game("CheckWeatherStatus"); }

  // =====================
  // Social / Chat
  // =====================

  chat(message) { this._room("Chat", { message }); }
  markChatRead(seq) { this._room("MarkChatRead", { seq }); }
  emote(emoteType, heartColor) { this._room("Emote", { emoteType, heartColor }); }
  wish(itemId) { return this._game("Wish", { itemId }); }
  kickPlayer(targetPlayerId) { this._room("KickPlayer", { targetPlayerId }); }
  setPlayerData({ name, cosmetic } = {}) { this._room("SetPlayerData", { name, cosmetic }); }
  usurpHost() { this._room("UsurpHost"); }

  // =====================
  // Movement
  // =====================

  move(x, y) { this._game("PlayerPosition", { position: { x, y } }); }
  teleport(x, y) { return this._game("Teleport", { position: { x, y } }); }

  // =====================
  // Shop / Purchases
  // =====================

  purchaseShopItem(shop, item) { return this._game("PurchaseShopItem", { shop, item }); }

  // =====================
  // Garden / Crops
  // =====================

  plantSeed(slot, species) { return this._game("PlantSeed", { slot, species }); }
  waterPlant(slot) { return this._game("WaterPlant", { slot }); }
  harvestCrop(slot, slotsIndex) { return this._game("HarvestCrop", { slot, slotsIndex }); }
  sellAllCrops() { return this._game("SellAllCrops"); }
  plantGardenPlant(slot, itemId) { return this._game("PlantGardenPlant", { slot, itemId }); }
  potPlant(slot) { return this._game("PotPlant", { slot }); }
  preserve(itemId, growSlotIdx) { return this._game("Preserve", { itemId, growSlotIdx }); }
  displayCrop(tileType, localTileIndex, itemId) {
    return this._game("DisplayCrop", { tileType, localTileIndex, itemId });
  }
  pickupDisplayedCrop(tileType, localTileIndex) {
    return this._game("PickupDisplayedCrop", { tileType, localTileIndex });
  }
  mutationPotion(tileObjectIdx, growSlotIdx, mutation) {
    return this._game("MutationPotion", { tileObjectIdx, growSlotIdx, mutation });
  }
  cropCleanser(tileObjectIdx, growSlotIdx) {
    return this._game("CropCleanser", { tileObjectIdx, growSlotIdx });
  }
  removeGardenObject(slot, slotType) { return this._game("RemoveGardenObject", { slot, slotType }); }

  // =====================
  // Decor
  // =====================

  placeDecor(decorId, tileType, localTileIndex, rotation) {
    return this._game("PlaceDecor", { decorId, tileType, localTileIndex, rotation });
  }
  pickupDecor(tileType, localTileIndex) {
    return this._game("PickupDecor", { tileType, localTileIndex });
  }

  // =====================
  // Pets
  // =====================

  placePet(itemId, position, tileType, localTileIndex) {
    return this._game("PlacePet", { itemId, position, tileType, localTileIndex });
  }
  pickupPet(petId) { return this._game("PickupPet", { petId }); }
  feedPet(petItemId, cropItemId) { return this._game("FeedPet", { petItemId, cropItemId }); }
  sellPet(itemId) { return this._game("SellPet", { itemId }); }
  namePet(petItemId, name) { return this._game("NamePet", { petItemId, name }); }
  swapPet(petSlotId, petInventoryId) { return this._game("SwapPet", { petSlotId, petInventoryId }); }
  swapPetFromStorage(petSlotId, storagePetId, storageId) {
    return this._game("SwapPetFromStorage", { petSlotId, storagePetId, storageId });
  }
  movePetSlot(movePetSlotId, toPetSlotIndex) {
    return this._game("MovePetSlot", { movePetSlotId, toPetSlotIndex });
  }
  equipPetCosmetic(petItemId, slotCategory, cosmeticId) {
    return this._game("EquipPetCosmetic", { petItemId, slotCategory, cosmeticId });
  }
  growEgg(slot, eggId) { return this._game("GrowEgg", { slot, eggId }); }
  hatchEgg(slot) { return this._game("HatchEgg", { slot }); }
  ridePet(petItemId) { return this._game("RidePet", { petItemId }); }
  dismountPet() { return this._game("DismountPet"); }
  requestPetGreet(position) { return this._game("RequestPetGreet", { position }); }
  replenishPotion(petItemId) { return this._game("ReplenishPotion", { petItemId }); }
  xpPotion(petItemId) { return this._game("XPPotion", { petItemId }); }
  thundercharge(petItemId, position) { return this._game("Thundercharge", { petItemId, position }); }
  dawnCapture(petItemId, position) { return this._game("DawnCapture", { petItemId, position }); }

  // =====================
  // Pet teams
  // =====================

  savePetTeam(teamId, name, petIds) { return this._game("SavePetTeam", { teamId, name, petIds }); }
  applyPetTeam(teamId) { return this._game("ApplyPetTeam", { teamId }); }
  deletePetTeam(teamId) { return this._game("DeletePetTeam", { teamId }); }
  movePetTeam(movePetTeamId, toPetTeamIndex) {
    return this._game("MovePetTeam", { movePetTeamId, toPetTeamIndex });
  }
  setPetTeamEmblem(teamId, emblem) { return this._game("SetPetTeamEmblem", { teamId, emblem }); }

  // =====================
  // Inventory / Storage
  // =====================

  moveInventoryItem(moveItemId, toInventoryIndex) {
    return this._game("MoveInventoryItem", { moveItemId, toInventoryIndex });
  }
  setSelectedItem(itemIndex) { return this._game("SetSelectedItem", { itemIndex }); }
  toggleLockItem(itemId) { return this._game("ToggleLockItem", { itemId }); }
  dropObject() { return this._game("DropObject"); }
  pickupObject() { return this._game("PickupObject"); }
  putItemInStorage(itemId, storageId, { toStorageIndex, quantity } = {}) {
    return this._game("PutItemInStorage", { itemId, storageId, toStorageIndex, quantity });
  }
  retrieveItemFromStorage(itemId, storageId, { toInventoryIndex, quantity } = {}) {
    return this._game("RetrieveItemFromStorage", { itemId, storageId, toInventoryIndex, quantity });
  }
  moveStorageItem(itemId, storageId, toStorageIndex) {
    return this._game("MoveStorageItem", { itemId, storageId, toStorageIndex });
  }
  swapItemWithStorage(storageId, inventoryItemId, storageItemId, { toStorageIndex, toInventoryIndex } = {}) {
    return this._game("SwapItemWithStorage", {
      storageId, inventoryItemId, storageItemId, toStorageIndex, toInventoryIndex,
    });
  }
  logItems() { return this._game("LogItems"); }

  // =====================
  // Misc
  // =====================

  throwSnowball() { return this._game("ThrowSnowball"); }
  checkFriendBonus() { return this._game("CheckFriendBonus"); }
  quinoaTutorialSkipped() { return this._game("QuinoaTutorialSkipped"); }
}

module.exports = { Actions, COMMAND_MODES, RAW_GAME_TYPES };
