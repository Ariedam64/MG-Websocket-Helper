class Player {
  constructor(roomData, slotData = null, slotIndex = null) {
    // --- From room state (players[]) ---
    this.id = roomData.id;
    this.name = roomData.name;
    this.isConnected = roomData.isConnected;
    this.discordAvatarUrl = roomData.discordAvatarUrl;
    this.cosmetic = roomData.cosmetic; // { color, avatar[] }
    this.emoteData = roomData.emoteData;
    this.databaseUserId = roomData.databaseUserId;
    this.guildId = roomData.guildId;
    this.secondsRemainingUntilChatEnabled =
      roomData.secondsRemainingUntilChatEnabled;

    // --- From game state (userSlots[]) ---
    this.slotIndex = slotIndex;

    // Slot top-level
    this.position = null; // { x, y }
    this.lastActionEvent = null; // { performedAt }
    this.petSlotInfos = {};
    this.customRestockInventories = { seed: null, egg: null, tool: null, decor: null };
    this.hasBeenSupersededByAnotherRoom = false;
    this.lastSlotMachineInfo = null;
    this.selectedItemIndex = null;

    // Slot data
    this.coins = 0;
    this.schemaVersion = null;

    // Inventory
    this.inventory = []; // mixed items (Seeds, Tools, Eggs, Plants, Pets, Produce, Decor)
    this.storages = []; // PetHutch, DecorShed, SeedSilo, FeedingTrough
    this.favoritedItemIds = [];

    // Garden
    this.garden = null; // { tileObjects, boardwalkTileObjects }

    // Active pets (deployed on the field, not in inventory/hutch)
    this.petSlots = [];

    // Shops tracking (per-player purchases & custom restocks)
    this.shopPurchases = {};
    this.customRestocks = { seed: null, egg: null, tool: null, decor: null };

    // Journal (produce variants discovered)
    this.journal = {};

    // Tasks & Stats
    this.tasksCompleted = [];
    this.stats = {};

    // Activity logs
    this.activityLogs = [];

    if (slotData) {
      this.applySlot(slotData, slotIndex);
    }
  }

  applySlot(slot, slotIndex) {
    if (slotIndex !== undefined) this.slotIndex = slotIndex;

    // Slot top-level fields
    this.position = slot.position || null;
    this.lastActionEvent = slot.lastActionEvent || null;
    this.petSlotInfos = slot.petSlotInfos || {};
    this.customRestockInventories = slot.customRestockInventories || this.customRestockInventories;
    this.hasBeenSupersededByAnotherRoom = slot.hasBeenSupersededByAnotherRoom || false;
    this.lastSlotMachineInfo = slot.lastSlotMachineInfo || null;
    this.selectedItemIndex = slot.notAuthoritative_selectedItemIndex || null;

    // Slot data fields
    const data = slot.data;
    if (!data) return;

    this.schemaVersion = data.schemaVersion || null;
    this.coins = data.coinsCount || 0;

    // Inventory
    this.inventory = data.inventory?.items || [];
    this.storages = data.inventory?.storages || [];
    this.favoritedItemIds = data.inventory?.favoritedItemIds || [];

    // Garden
    this.garden = data.garden || null;

    // Active pet slots
    this.petSlots = data.petSlots || [];

    // Shop tracking
    this.shopPurchases = data.shopPurchases || {};
    this.customRestocks = data.customRestocks || this.customRestocks;

    // Journal
    this.journal = data.journal || {};

    // Tasks & Stats
    this.tasksCompleted = data.tasksCompleted || [];
    this.stats = data.stats || {};

    // Activity logs
    this.activityLogs = data.activityLogs || [];
  }

  // --- Inventory helpers ---

  getSeeds() {
    return this.inventory.filter((i) => i.itemType === "Seed");
  }

  getTools() {
    return this.inventory.filter((i) => i.itemType === "Tool");
  }

  getEggs() {
    return this.inventory.filter((i) => i.itemType === "Egg");
  }

  getPets() {
    return this.inventory.filter((i) => i.itemType === "Pet");
  }

  getPlants() {
    return this.inventory.filter((i) => i.itemType === "Plant");
  }

  getProduce() {
    return this.inventory.filter((i) => i.itemType === "Produce");
  }

  getDecor() {
    return this.inventory.filter((i) => i.itemType === "Decor");
  }

  // --- Storage helpers ---

  getStorage(decorId) {
    return this.storages.find((s) => s.decorId === decorId);
  }

  getPetHutch() {
    return this.getStorage("PetHutch")?.items || [];
  }

  getSeedSilo() {
    return this.getStorage("SeedSilo")?.items || [];
  }

  getDecorShed() {
    return this.getStorage("DecorShed")?.items || [];
  }

  getFeedingTrough() {
    return this.getStorage("FeedingTrough")?.items || [];
  }

  // --- Garden helpers ---

  getGardenTiles() {
    return this.garden?.tileObjects || {};
  }

  getBoardwalkTiles() {
    return this.garden?.boardwalkTileObjects || {};
  }

  getGardenPlants() {
    const tiles = this.getGardenTiles();
    return Object.entries(tiles)
      .filter(([, tile]) => tile.objectType === "plant")
      .map(([tileId, tile]) => ({ tileId: parseInt(tileId), ...tile }));
  }

  getGardenDecor() {
    const tiles = this.getGardenTiles();
    return Object.entries(tiles)
      .filter(([, tile]) => tile.objectType === "decor")
      .map(([tileId, tile]) => ({ tileId: parseInt(tileId), ...tile }));
  }

  // --- Pet slots (active/deployed pets) ---

  getActivePets() {
    return this.petSlots;
  }

  // --- All pets (inventory + hutch + active) ---

  getAllPets() {
    return [...this.getPets(), ...this.getPetHutch(), ...this.petSlots];
  }
}

module.exports = { Player };
