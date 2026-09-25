const crypto = require("crypto");
const { GAME_SCOPE } = require("./connection");

const GAME = "Quinoa";
const ROOM_SCOPE = ["Room"];

// How Quinoa-scoped actions are framed on the wire.
//   "envelope" — new QuinoaCommand envelope (requestId + commandSequence).
//   "legacy"   — flat `{ scopePath, type, ...params }` message.
// The server still honours "legacy" but it is being removed, so the envelope
// is the default. Keep "legacy" as an escape hatch for older servers.
const COMMAND_MODES = { ENVELOPE: "envelope", LEGACY: "legacy" };

// Quinoa messages the game sends flat, in both modes: the ones its client
// passes to the plain `sendMessage({scopePath:["Room","Quinoa"], ...msg})`
// sender rather than the QuinoaCommand one. The server answers some of them
// with `not_ackable` when wrapped. The game moves messages across one release
// at a time, so re-derive this list from the bundle (last checked: 1284).
const RAW_GAME_TYPES = new Set([
  "Ping",
  "PlayerPosition",
  "Teleport",
  "SetSelectedItem",
  "CheckWeatherStatus",
  "CheckFriendBonus",
  "ThrowSnowball",
  "QuinoaTutorialSkipped",
  "RequestPetGreet",
  "DropObject",
  "PickupObject",
  "UpgradePetHutch",
  "UpgradeSeedSilo",
  "UpgradeDecorShed",
  "UpgradeToolShack",
  "TramBoarding",
  "TramArrival",
  "SkipNpcVisitArrival",
  "NpcVisitFarewellReady",
  "NpcVisitFarewellSeen",
]);

const CREDITS_TIMEOUT_MS = 10000;

// The two PlaceCrystal intents: plant a shard, or fuse it into a standing crystal.
const PLACE_INTENT = "place";
const MERGE_INTENT = "merge";

/**
 * The wire shape PlaceCrystal expects in `item`: a shard from a stack is named
 * by its toolId (e.g. "RainWardShard"), a shard picked back up (which kept its
 * remaining time) by its itemId.
 * @param {{ toolId: string } | { itemId: string }} shard
 */
function crystalItem(shard) {
  return shard.itemId
    ? { itemType: "Tool", itemId: shard.itemId }
    : { itemType: "Tool", toolId: shard.toolId };
}

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
    this.conn.sendMessage({ scopePath, type, ...compact(params) });
  }

  _room(type, params) { this._send(ROOM_SCOPE, type, params); }

  /**
   * Send a Quinoa action. In envelope mode this returns the promise from
   * `Connection.sendQuinoaCommand` (resolves with the QuinoaCommandResult, or
   * null on timeout); in legacy mode it is fire-and-forget.
   */
  _game(type, params = {}, options) {
    if (this.commandMode === COMMAND_MODES.LEGACY || RAW_GAME_TYPES.has(type)) {
      this._send(GAME_SCOPE, type, params);
      return undefined;
    }
    return this.conn.sendQuinoaCommand({ type, ...compact(params) }, options);
  }

  // Credit commands: the game waits 10s for their result instead of 5s.
  _credits(type, params) { return this._game(type, params, { timeoutMs: CREDITS_TIMEOUT_MS }); }

  // =====================
  // Session / Heartbeat
  // =====================

  ping(id = Date.now()) { this._game("Ping", { id }); }
  setSelectedGame(gameName = GAME) { this._room("SetSelectedGame", { gameName }); }
  voteForGame(gameName = GAME) { this._room("VoteForGame", { gameName }); }
  restartGame(gameName = GAME) { this._room("RestartGame", { name: gameName }); }
  requestGame(name) { this._room("RequestGame", { name }); }
  checkWeatherStatus() { return this._game("CheckWeatherStatus"); }

  // =====================
  // Social / Chat
  // =====================

  chat(message) { this._room("Chat", { message }); }
  markChatRead(seq) { this._room("MarkChatRead", { seq }); }
  chatTyping(isTyping) { this._room("ChatTyping", { isTyping }); }
  emote(emoteType) { this._room("Emote", { emoteType }); }
  wish(itemId) { return this._game("Wish", { itemId }); }
  kickPlayer(targetPlayerId) { this._room("KickPlayer", { targetPlayerId }); }
  setPlayerData({ name, cosmetic } = {}) { this._room("SetPlayerData", { name, cosmetic }); }
  usurpHost() { this._room("UsurpHost"); }

  // =====================
  // Movement
  // =====================

  move(x, y) { this._game("PlayerPosition", { position: { x, y } }); }
  /** `tramArrivalStationIndex` is set when the teleport ends a tram trip. */
  teleport(x, y, tramArrivalStationIndex) {
    return this._game("Teleport", { position: { x, y }, tramArrivalStationIndex });
  }
  tramBoarding(stationIndex) { return this._game("TramBoarding", { stationIndex }); }
  tramArrival(stationIndex) { return this._game("TramArrival", { stationIndex }); }

  // =====================
  // Shop / Purchases
  // =====================

  /**
   * @param {string} shop - lowercase shop key ("seed", "tool", "egg", "decor", "dawn", ...)
   * @param {{ itemType: "Seed", species: string } | { itemType: "Tool", toolId: string }
   *   | { itemType: "Egg", eggId: string } | { itemType: "Decor", decorId: string }} item
   *   - itemType comes from the item itself, not the shop: the tool shop mixes
   *   Tool and Decor entries. A shop inventory entry can be passed as-is.
   */
  purchaseShopItem(shop, item) {
    const { itemType, species, toolId, eggId, decorId } = item;
    return this._game("PurchaseShopItem", { shop, item: compact({ itemType, species, toolId, eggId, decorId }) });
  }

  // =====================
  // Garden / Crops
  // =====================

  plantSeed(slot, species) { return this._game("PlantSeed", { slot, species }); }
  waterPlant(slot) { return this._game("WaterPlant", { slot }); }
  /**
   * `slotsIndex` (the grow slot on that tile) is required by the game's schema.
   * `cropItemId` is the id the harvested Produce item will carry: the client
   * mints it and the server honours it. Required since bundle 1116.
   */
  harvestCrop(slot, slotsIndex, cropItemId = crypto.randomUUID()) {
    if (!Number.isInteger(slotsIndex)) throw new TypeError("harvestCrop: slotsIndex is required");
    return this._game("HarvestCrop", { slot, slotsIndex, cropItemId });
  }
  /** Lock or unlock one grow slot (`growSlotId`) of dirt tile `slot` against harvesting. */
  setGrowSlotLock(slot, growSlotId, locked) {
    return this._game("SetGrowSlotLock", { slot, growSlotId, locked });
  }
  sellAllCrops() { return this._game("SellAllCrops"); }
  plantGardenPlant(slot, itemId) { return this._game("PlantGardenPlant", { slot, itemId }); }
  /** `plantItemId` is the id the potted Plant item will carry; the server rejects a PotPlant without it. */
  potPlant(slot, plantItemId = crypto.randomUUID()) {
    return this._game("PotPlant", { slot, plantItemId });
  }
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
  // Crystals
  // =====================

  /** Plant a shard on an empty tile. `tileType` is "Dirt" or "Boardwalk". */
  placeCrystal(shard, tileType, localTileIndex) {
    return this._game("PlaceCrystal", {
      tileType, localTileIndex, item: crystalItem(shard), intent: { type: PLACE_INTENT },
    });
  }
  /**
   * Fuse a shard into the crystal already on that tile. The server rejects a
   * gain that would push the crystal past its ceiling, and the shard is
   * consumed whole either way.
   */
  fuseCrystal(shard, tileType, localTileIndex, mergeGainSeconds) {
    return this._game("PlaceCrystal", {
      tileType, localTileIndex, item: crystalItem(shard),
      intent: { type: MERGE_INTENT, mergeGainSeconds },
    });
  }
  /**
   * Take a crystal back into the inventory, keeping its remaining time.
   * `crystalType`: RainWard | SnowWard | ThunderWard | Hunger | XP | Strength.
   * `itemId` is the id the returned item will carry (client-minted).
   */
  pickupCrystal(crystalType, tileType, localTileIndex, itemId = crypto.randomUUID()) {
    return this._game("PickupCrystal", { tileType, localTileIndex, crystalType, itemId });
  }

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
  /** `cosmeticId: null` unequips that slot. */
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
  amberCapture(petItemId, position) { return this._game("AmberCapture", { petItemId, position }); }

  // =====================
  // Capsules
  // =====================

  // The QuinoaCommandResult carries what came out in `payload`
  // ({ type: "OpenDawnCapsules" | "OpenAmberCapsules", ... }).
  openDawnCapsule() { return this._game("OpenDawnCapsule"); }
  openAllDawnCapsules() { return this._game("OpenAllDawnCapsules"); }
  openAmberCapsule() { return this._game("OpenAmberCapsule"); }
  openAllAmberCapsules() { return this._game("OpenAllAmberCapsules"); }

  // =====================
  // NPC visits
  // =====================

  /** `trigger`: { kind: "call" } | { kind: "harvest", crop: species }; omit for none. */
  requestNpcVisit(trigger) { return this._game("RequestNpcVisit", { trigger }); }
  acceptNpcVisitGift() { return this._game("AcceptNpcVisitGift"); }
  skipNpcVisitArrival() { return this._game("SkipNpcVisitArrival"); }
  npcVisitFarewellReady() { return this._game("NpcVisitFarewellReady"); }
  npcVisitFarewellSeen() { return this._game("NpcVisitFarewellSeen"); }

  // =====================
  // Pet teams
  // =====================

  /** `isCreate` tells the server this is a brand new team rather than an edit of `teamId`. */
  savePetTeam(teamId, name, petIds, isCreate = false) {
    return this._game("SavePetTeam", { teamId, isCreate, name, petIds });
  }
  applyPetTeam(teamId) { return this._game("ApplyPetTeam", { teamId }); }
  deletePetTeam(teamId) { return this._game("DeletePetTeam", { teamId }); }
  movePetTeam(movePetTeamId, toPetTeamIndex) {
    return this._game("MovePetTeam", { movePetTeamId, toPetTeamIndex });
  }
  /**
   * `emblem` is an object - a bare string is dropped by the server:
   * { type: "number", number } | { type: "pet", petSpecies } | { type: "icon", icon }
   * | { type: "cosmetic", cosmetic }
   */
  setPetTeamEmblem(teamId, emblem) { return this._game("SetPetTeamEmblem", { teamId, emblem }); }

  // =====================
  // Inventory / Storage
  // =====================

  moveInventoryItem(moveItemId, toInventoryIndex) {
    return this._game("MoveInventoryItem", { moveItemId, toInventoryIndex });
  }
  /** `itemIndex: null` deselects. */
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
  /**
   * `draggedQuantity` splits a stack: the game only sends it when part of one is
   * dragged, and always alongside `draggedFromInventory` (which side the drag
   * started on).
   */
  swapItemWithStorage(storageId, inventoryItemId, storageItemId, {
    toStorageIndex, toInventoryIndex, draggedQuantity, draggedFromInventory = false,
  } = {}) {
    const dragged = draggedQuantity === undefined ? {} : { draggedQuantity, draggedFromInventory };
    return this._game("SwapItemWithStorage", {
      storageId, inventoryItemId, storageItemId, toStorageIndex, toInventoryIndex, ...dragged,
    });
  }
  /**
   * Record an item in the journal. The result's `payload` ({ type: "LogItem",
   * speciesId, variants }) says what got logged. `target` is one of:
   *   { kind: "growSlot", slot, slotsIndex } | { kind: "petSlot", petId }
   *   | { kind: "inventoryItem", itemId }
   *   | { kind: "displayedCrop", tileType, localTileIndex, cropId }
   * (The old argument-less `LogItems` no longer exists.)
   */
  logItem(target) { return this._game("LogItem", { target }); }
  upgradePetHutch() { return this._game("UpgradePetHutch"); }
  upgradeSeedSilo() { return this._game("UpgradeSeedSilo"); }
  upgradeDecorShed() { return this._game("UpgradeDecorShed"); }
  upgradeToolShack() { return this._game("UpgradeToolShack"); }

  // =====================
  // Credits (paid currency)
  // =====================
  //
  // These spend credits. A refused result carries `code`, e.g.
  // "insufficient_credits" or "account_required".

  purchaseSeedWithCredits(species, shop = "seed") {
    return this._credits("PurchaseSeedWithCredits", { species, shop });
  }
  purchaseToolWithCredits(toolId, shop = "tool") {
    return this._credits("PurchaseToolWithCredits", { toolId, shop });
  }
  /** Note the field is `egg` here, not `eggId` as in PurchaseShopItem. */
  purchaseEggWithCredits(egg, shop = "egg") {
    return this._credits("PurchaseEggWithCredits", { egg, shop });
  }
  purchaseDecorWithCredits(decorId, shop = "decor") {
    return this._credits("PurchaseDecorWithCredits", { decorId, shop });
  }
  purchasePetCosmeticWithCredits(cosmeticId) {
    return this._credits("PurchasePetCosmeticWithCredits", { cosmeticId });
  }
  /** `decorId`: the storage to upgrade (PetHutch, SeedSilo, DecorShed, ToolShack, ...). */
  upgradeStorageWithCredits(decorId) { return this._credits("UpgradeStorageWithCredits", { decorId }); }
  restockSeedsWithCredits() { return this._credits("RestockSeedsWithCredits"); }
  restockEggsWithCredits() { return this._credits("RestockEggsWithCredits"); }
  restockToolsWithCredits() { return this._credits("RestockToolsWithCredits"); }
  restockDecorsWithCredits() { return this._credits("RestockDecorsWithCredits"); }
  /** Finish growing the plant on dirt tile `dirtTileIndex` now. */
  instaGrowWithCredits(dirtTileIndex) { return this._credits("InstaGrowWithCredits", { dirtTileIndex }); }

  // =====================
  // Dev (developer tools)
  // =====================
  //
  // In the game's command schema but never sent by the production client: its
  // dev tools are compiled out. Expect the server to refuse them on a normal
  // account. Shapes as of bundle 1284.

  /** `weather`: a weather id, "No Weather" or "Clear". */
  devWeather(weather) { return this._game("DevWeather", { weather }); }
  devClearInventory() { return this._game("DevClearInventory"); }
  devClearGarden() { return this._game("DevClearGarden"); }
  devSpectate() { return this._game("DevSpectate"); }
  devInstaGrowAll() { return this._game("DevInstaGrowAll"); }
  devSetFastForward(enabled) { return this._game("DevSetFastForward", { enabled }); }
  /** `currency`: "coins" | "credits" | "dust"; `operation`: "adjust" | "set" (optional). */
  devSetCurrency(currency, amount, operation) {
    return this._game("DevSetCurrency", { currency, amount, operation });
  }
  /** `completion`: "empty" | "random" | "complete". */
  devSetJournalCompletion(completion) { return this._game("DevSetJournalCompletion", { completion }); }
  /** `action`: "createRandom" | "clear". */
  devPetTeams(action) { return this._game("DevPetTeams", { action }); }
  /**
   * @param {{ xp?: number, hunger?: number, targetScale?: number, abilities?: string[],
   *   mutations?: string[], abilityCooldown?: { abilityId: string, remainingBaseMs: number } }} [changes]
   */
  devSetPet(petId, changes = {}) { return this._game("DevSetPet", { petId, ...changes }); }
  devMovePet(petId, position) { return this._game("DevMovePet", { petId, position }); }
  devMoveGardenObject(fromSlotType, fromSlot, toSlotType, toSlot) {
    return this._game("DevMoveGardenObject", { fromSlotType, fromSlot, toSlotType, toSlot });
  }
  devRemoveGardenObject(slot, slotType) { return this._game("DevRemoveGardenObject", { slot, slotType }); }
  devCompleteTutorial() { return this._game("DevCompleteTutorial"); }
  devResetAccount() { return this._game("DevResetAccount"); }
  /** `state`: "inactive" | "active". */
  devSaveWarning(state) { return this._game("DevSaveWarning", { state }); }
  devSetSize(dirtTileIdx, slotId, size, allSlots) {
    return this._game("DevSetSize", { dirtTileIdx, slotId, size, allSlots });
  }
  /**
   * `item`: { itemType: "Plant" | "Produce" | "Pet" | "Egg" | "Decor" | "Seed" | "Tool" | "Crystal", id }.
   */
  devGrantInventoryItem(item, quantity = 1) {
    return this._game("DevGrantInventoryItem", { item, quantity });
  }
  /**
   * `object`: { objectType: "Plant", id, size? } | { objectType: "Egg", id } | { objectType: "Decor", id };
   * `target` (optional): { tileType, tileIdx }.
   */
  devPlaceGardenObject(object, target) { return this._game("DevPlaceGardenObject", { object, target }); }
  /**
   * `edit`: { action: "Mutate", mutationId } | { action: "Cleanse" } | { action: "Preserve", preserved }.
   */
  devEditCrop(dirtTileIdx, edit, slotId) { return this._game("DevEditCrop", { dirtTileIdx, slotId, edit }); }
  /** `edit`: { action: "Mutate", mutationId } | { action: "Cleanse" }. */
  devEditPet(petId, edit) { return this._game("DevEditPet", { petId, edit }); }

  // =====================
  // Misc
  // =====================

  throwSnowball() { return this._game("ThrowSnowball"); }
  checkFriendBonus() { return this._game("CheckFriendBonus"); }
  quinoaTutorialSkipped() { return this._game("QuinoaTutorialSkipped"); }
}

module.exports = { Actions, COMMAND_MODES, RAW_GAME_TYPES };
