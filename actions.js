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

  // =====================
  // Session / Heartbeat
  // =====================

  ping(id = Date.now()) { this._game("Ping", { id }); }
  setSelectedGame(gameId = GAME) { this._room("SetSelectedGame", { gameId }); }
  voteForGame(gameId = GAME) { this._room("VoteForGame", { gameId }); }
  restartGame() { this._room("RestartGame"); }
  checkWeatherStatus() { this._game("CheckWeatherStatus"); }

  // =====================
  // Social / Chat
  // =====================

  chat(message) { this._room("Chat", { message }); }
  emote(emoteType) { this._room("Emote", { emoteType }); }
  wish(itemId) { this._game("Wish", { itemId }); }
  kickPlayer(playerId) { this._room("KickPlayer", { playerId }); }
  setPlayerData({ name, cosmetic } = {}) { this._room("SetPlayerData", { name, cosmetic }); }
  usurpHost() { this._game("UsurpHost"); }
  reportSpeakingStart() { this._game("ReportSpeakingStart"); }

  // =====================
  // Movement
  // =====================

  move(x, y) { this._game("PlayerPosition", { position: { x, y } }); }
  teleport(x, y) { this._game("Teleport", { position: { x, y } }); }

  // =====================
  // Shop / Purchases
  // =====================

  purchaseSeed(species) { this._game("PurchaseSeed", { species }); }
  purchaseTool(toolId) { this._game("PurchaseTool", { toolId }); }
  purchaseEgg(eggId) { this._game("PurchaseEgg", { eggId }); }
  purchaseDecor(decorId) { this._game("PurchaseDecor", { decorId }); }

  // =====================
  // Garden / Crops
  // =====================

  plantSeed(slot, species) { this._game("PlantSeed", { slot, species }); }
  waterPlant(slot) { this._game("WaterPlant", { slot }); }
  harvestCrop(slot, slotsIndex) {
    const params = { slot };
    if (slotsIndex !== undefined) params.slotsIndex = slotsIndex;
    this._game("HarvestCrop", params);
  }
  sellAllCrops() { this._game("SellAllCrops"); }
  plantGardenPlant(slot, itemId) { this._game("PlantGardenPlant", { slot, itemId }); }
  potPlant(slot) { this._game("PotPlant", { slot }); }
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
  petPositions(petPositions) { this._game("PetPositions", { petPositions }); }
  growEgg(slot, eggId) { this._game("GrowEgg", { slot, eggId }); }
  hatchEgg(slot) { this._game("HatchEgg", { slot }); }

  // =====================
  // Inventory / Storage
  // =====================

  moveInventoryItem(moveItemId, toInventoryIndex) {
    this._game("MoveInventoryItem", { moveItemId, toInventoryIndex });
  }
  setSelectedItem(itemIndex) { this._game("SetSelectedItem", { itemIndex }); }
  toggleLockItem(itemId) { this._game("ToggleLockItem", { itemId }); }
  dropObject(slotIndex) { this._game("DropObject", { slotIndex }); }
  pickupObject(objectId) { this._game("PickupObject", { objectId }); }
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
  logItems() { this._game("LogItems"); }

  // =====================
  // Misc
  // =====================

  throwSnowball() { this._game("ThrowSnowball"); }
  checkFriendBonus() { this._game("CheckFriendBonus"); }
}

module.exports = { Actions };
