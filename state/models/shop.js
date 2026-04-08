class Shop {
  constructor(type, data) {
    this.type = type; // "seed" | "tool" | "egg" | "decor"
    this.inventory = data.inventory || [];
    this.secondsUntilRestock = data.secondsUntilRestock || 0;
  }

  update(data) {
    if (data.inventory) this.inventory = data.inventory;
    if (data.secondsUntilRestock !== undefined) {
      this.secondsUntilRestock = data.secondsUntilRestock;
    }
  }

  getAvailable() {
    return this.inventory.filter((i) => i.initialStock > 0);
  }

  getOutOfStock() {
    return this.inventory.filter((i) => i.initialStock === 0);
  }
}

module.exports = { Shop };
