const { runTest } = require("./helper");

runTest(async ({ actions, state, expect }) => {
  console.log("--- Shop / Purchases ---\n");

  const seedShop = state.getShop("seed");
  const seed = seedShop?.getAvailable()?.[0];
  if (seed) {
    await expect(`PurchaseSeed (${seed.species})`, () => actions.purchaseSeed(seed.species), {
      matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)",
    });
  } else {
    console.log("  [SKIP] PurchaseSeed — no stock");
  }

  const toolShop = state.getShop("tool");
  const tool = toolShop?.getAvailable()?.[0];
  if (tool) {
    await expect(`PurchaseTool (${tool.toolId})`, () => actions.purchaseTool(tool.toolId), {
      matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)",
    });
  } else {
    console.log("  [SKIP] PurchaseTool — no stock");
  }

  const eggShop = state.getShop("egg");
  const egg = eggShop?.getAvailable()?.[0];
  if (egg) {
    await expect(`PurchaseEgg (${egg.eggId})`, () => actions.purchaseEgg(egg.eggId), {
      matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)",
    });
  } else {
    console.log("  [SKIP] PurchaseEgg — no stock");
  }

  const decorShop = state.getShop("decor");
  const decor = decorShop?.getAvailable()?.[0];
  if (decor) {
    await expect(`PurchaseDecor (${decor.decorId})`, () => actions.purchaseDecor(decor.decorId), {
      matchPath: "/child/data/userSlots/0/data/(inventory|coinsCount)",
    });
  } else {
    console.log("  [SKIP] PurchaseDecor — no stock");
  }
});
