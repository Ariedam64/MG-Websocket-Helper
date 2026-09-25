// Which field names an item, per itemType: the tool shop mixes Tool and Decor entries.
const ID_FIELDS = { Seed: "species", Tool: "toolId", Egg: "eggId", Decor: "decorId" };

class Shop {
  constructor(type, data) {
    this.type = type; // "seed" | "tool" | "egg" | "decor" | "dawn" | ...
    this.inventory = data.inventory || [];
    this.secondsUntilRestock = data.secondsUntilRestock || 0;
    this.restockId = data.restockId ?? null;
    this.startedAtMs = data.startedAtMs || 0;
  }

  update(data) {
    if (data.inventory) this.inventory = data.inventory;
    if (data.secondsUntilRestock !== undefined) {
      this.secondsUntilRestock = data.secondsUntilRestock;
    }
    if (data.restockId !== undefined) this.restockId = data.restockId;
    if (data.startedAtMs !== undefined) this.startedAtMs = data.startedAtMs;
  }

  getAvailable() {
    return this.inventory.filter((i) => i.initialStock > 0);
  }

  getOutOfStock() {
    return this.inventory.filter((i) => i.initialStock === 0);
  }

  /** Item id (species / toolId / eggId / decorId) -> initialStock, for items in stock. */
  getItemStocks() {
    const stocks = {};
    for (const item of this.getAvailable()) {
      const id = item[ID_FIELDS[item.itemType]];
      if (id) stocks[id] = item.initialStock;
    }
    return stocks;
  }

  /**
   * Stock still on the shelf: `initialStock` minus what the player bought from
   * the stock currently on display.
   *
   * A `shopPurchases[shop]` entry is not wiped on restock: it keeps the
   * `restockId` / `startedAtMs` of the cycle it was made in. Its counts apply
   * only while it names the cycle on display; an older entry counts as nothing
   * bought. A newer one means our shop snapshot is a frame behind, and there we
   * keep subtracting rather than advertise stock that is gone.
   *
   * @param {{ purchases?: object, restockId?: string, startedAtMs?: number }} [purchaseEntry]
   */
  remainingStocks(purchaseEntry) {
    const purchases = this._purchasesOnDisplay(purchaseEntry);
    const remaining = {};
    for (const [id, initial] of Object.entries(this.getItemStocks())) {
      remaining[id] = Math.max(0, initial - (purchases[id] || 0));
    }
    return remaining;
  }

  _purchasesOnDisplay(entry) {
    const purchases = entry?.purchases;
    if (!purchases) return {};
    if (entry.restockId != null && entry.restockId === this.restockId) return purchases;
    return (entry.startedAtMs || 0) < this.startedAtMs ? {} : purchases;
  }
}

module.exports = { Shop };
