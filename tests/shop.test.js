const { runTest } = require("./helper");

runTest(async ({ actions, state, expect }) => {
  console.log("--- Shop / Purchases ---\n");

  const seedShop = state.getShop("seed");
  const seed = seedShop?.getAvailable()?.[0];
  if (seed) {
    await expect(
      `PurchaseShopItem seed (${seed.species})`,
      () => actions.purchaseShopItem("seed", { itemType: "Seed", species: seed.species }),
      { matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)" }
    );
  } else {
    console.log("  [SKIP] PurchaseShopItem seed — no stock");
  }

  const toolShop = state.getShop("tool");
  const tool = toolShop?.getAvailable()?.[0];
  if (tool) {
    await expect(
      `PurchaseShopItem tool (${tool.toolId})`,
      () => actions.purchaseShopItem("tool", { itemType: "Tool", toolId: tool.toolId }),
      { matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)" }
    );
  } else {
    console.log("  [SKIP] PurchaseShopItem tool — no stock");
  }

  const eggShop = state.getShop("egg");
  const egg = eggShop?.getAvailable()?.[0];
  if (egg) {
    await expect(
      `PurchaseShopItem egg (${egg.eggId})`,
      () => actions.purchaseShopItem("egg", { itemType: "Egg", eggId: egg.eggId }),
      { matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)" }
    );
  } else {
    console.log("  [SKIP] PurchaseShopItem egg — no stock");
  }

  const decorShop = state.getShop("decor");
  const decor = decorShop?.getAvailable()?.[0];
  if (decor) {
    await expect(
      `PurchaseShopItem decor (${decor.decorId})`,
      () => actions.purchaseShopItem("decor", { itemType: "Decor", decorId: decor.decorId }),
      { matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)" }
    );
  } else {
    console.log("  [SKIP] PurchaseShopItem decor — no stock");
  }
});
