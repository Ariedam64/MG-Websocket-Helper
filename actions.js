const crypto = require("crypto");

const GAME = "Quinoa";
const ROOM_SCOPE = ["Room"];
const GAME_SCOPE = ["Room", GAME];

class Actions {
  constructor(connection) {
    this.conn = connection;
  }

  _send(scopePath, type, params = {}) {
    this.conn.send(JSON.stringify({ scopePath, type, ...params }));
  }

  _room(type, params) { this._send(ROOM_SCOPE, type, params); }
  _game(type, params) { this._send(GAME_SCOPE, type, params); }

  // RPC-style game actions expect a response and are wrapped in QuinoaCommand with a requestId.
  _quinoaCommand(command) {
    this._send(GAME_SCOPE, "QuinoaCommand", { requestId: crypto.randomUUID(), command });
  }

  // =====================
  // Session / Heartbeat
  // =====================

  ping(id = Date.now()) { this._game("Ping", { id }); }
  setSelectedGame(gameName = GAME) { this._room("SetSelectedGame", { gameName }); }
  voteForGame(gameName = GAME) { this._room("VoteForGame", { gameName }); }
  restartGame() { this._room("RestartGame"); }
  checkWeatherStatus() { this._game("CheckWeatherStatus"); }

  // =====================
  // Social / Chat
  // =====================

  chat(message) { this._room("Chat", { message }); }
  emote(emoteType, heartColor) { this._room("Emote", { emoteType, heartColor }); }
  wish(itemId) { this._game("Wish", { itemId }); }
  kickPlayer(targetPlayerId) { this._room("KickPlayer", { targetPlayerId }); }
  setPlayerData({ name, cosmetic } = {}) { this._room("SetPlayerData", { name, cosmetic }); }
  usurpHost() { this._game("UsurpHost"); }

  // =====================
  // Movement
  // =====================

  move(x, y) { this._game("PlayerPosition", { position: { x, y } }); }
  teleport(x, y) { this._game("Teleport", { position: { x, y } }); }

  // =====================
  // Shop / Purchases
  // =====================

  purchaseShopItem(shop, item) { this._game("PurchaseShopItem", { shop, item }); }

  // =====================
  // Garden / Crops
  // =====================

  plantSeed(slot, species) { this._game("PlantSeed", { slot, species }); }
  waterPlant(slot) { this._game("WaterPlant", { slot }); }
  harvestCrop(slot, slotsIndex) {
    const command = { type: "HarvestCrop", slot };
    if (slotsIndex !== undefined) command.slotsIndex = slotsIndex;
    this._quinoaCommand(command);
  }
  sellAllCrops() { this._game("SellAllCrops"); }
  plantGardenPlant(slot, itemId) { this._game("PlantGardenPlant", { slot, itemId }); }
  potPlant(slot) { this._quinoaCommand({ type: "PotPlant", slot }); }
  preserve(itemId, growSlotIdx) { this._quinoaCommand({ type: "Preserve", itemId, growSlotIdx }); }
  mutationPotion(tileObjectIdx, growSlotIdx, mutation) {
    this._game("MutationPotion", { tileObjectIdx, growSlotIdx, mutation });
  }
  cropCleanser(tileObjectIdx, growSlotIdx) {
    this._game("CropCleanser", { tileObjectIdx, growSlotIdx });
  }
  removeGardenObject(slot, slotType) { this._game("RemoveGardenObject", { slot, slotType }); }

  // =====================
  // Decor
  // =====================

  placeDecor(decorId, tileType, localTileIndex, rotation) {
    const params = { decorId, tileType, localTileIndex };
    if (rotation !== undefined) params.rotation = rotation;
    this._game("PlaceDecor", params);
  }
  pickupDecor(tileType, localTileIndex) {
    this._game("PickupDecor", { tileType, localTileIndex });
  }

  // =====================
  // Pets
  // =====================

  placePet(itemId, position, tileType, localTileIndex) {
    this._game("PlacePet", { itemId, position, tileType, localTileIndex });
  }
  pickupPet(petId) { this._game("PickupPet", { petId }); }
  feedPet(petItemId, cropItemId) { this._game("FeedPet", { petItemId, cropItemId }); }
  sellPet(itemId) { this._game("SellPet", { itemId }); }
  namePet(petItemId, name) { this._game("NamePet", { petItemId, name }); }
  swapPet(petSlotId, petInventoryId) { this._game("SwapPet", { petSlotId, petInventoryId }); }
  swapPetFromStorage(petSlotId, storagePetId, storageId) {
    this._game("SwapPetFromStorage", { petSlotId, storagePetId, storageId });
  }
  movePetSlot(movePetSlotId, toPetSlotIndex) {
    this._game("MovePetSlot", { movePetSlotId, toPetSlotIndex });
  }
  growEgg(slot, eggId) { this._game("GrowEgg", { slot, eggId }); }
  hatchEgg(slot) { this._game("HatchEgg", { slot }); }
  ridePet(petItemId) { this._game("RidePet", { petItemId }); }
  dismountPet() { this._game("DismountPet"); }
  requestPetGreet(position) { this._game("RequestPetGreet", { position }); }
  replenishPotion(petItemId) { this._game("ReplenishPotion", { petItemId }); }
  xpPotion(petItemId) { this._game("XPPotion", { petItemId }); }
  thundercharge(petItemId, position) { this._game("Thundercharge", { petItemId, position }); }
  dawnCapture(petItemId, position) { this._game("DawnCapture", { petItemId, position }); }

  // =====================
  // Inventory / Storage
  // =====================

  moveInventoryItem(moveItemId, toInventoryIndex) {
    this._game("MoveInventoryItem", { moveItemId, toInventoryIndex });
  }
  setSelectedItem(itemIndex) { this._game("SetSelectedItem", { itemIndex }); }
  toggleLockItem(itemId) { this._game("ToggleLockItem", { itemId }); }
  dropObject() { this._game("DropObject"); }
  pickupObject() { this._game("PickupObject"); }
  putItemInStorage(itemId, storageId, { toStorageIndex, quantity } = {}) {
    const params = { itemId, storageId };
    if (toStorageIndex !== undefined) params.toStorageIndex = toStorageIndex;
    if (quantity !== undefined) params.quantity = quantity;
    this._game("PutItemInStorage", params);
  }
  retrieveItemFromStorage(itemId, storageId, { toInventoryIndex, quantity } = {}) {
    const params = { itemId, storageId };
    if (toInventoryIndex !== undefined) params.toInventoryIndex = toInventoryIndex;
    if (quantity !== undefined) params.quantity = quantity;
    this._game("RetrieveItemFromStorage", params);
  }
  moveStorageItem(itemId, storageId, toStorageIndex) {
    this._game("MoveStorageItem", { itemId, storageId, toStorageIndex });
  }
  swapItemWithStorage(storageId, inventoryItemId, storageItemId, { toStorageIndex, toInventoryIndex } = {}) {
    this._game("SwapItemWithStorage", { storageId, inventoryItemId, storageItemId, toStorageIndex, toInventoryIndex });
  }
  logItems() { this._game("LogItems"); }

  // =====================
  // Misc
  // =====================

  throwSnowball() { this._game("ThrowSnowball"); }
  checkFriendBonus() { this._game("CheckFriendBonus"); }
  quinoaTutorialSkipped() { this._game("QuinoaTutorialSkipped"); }
}

module.exports = { Actions };
