const { runTest, sleep } = require("./helper");

runTest(async ({ actions, player, expect }) => {
  console.log("--- Decor ---\n");

  const decorInv = player.getDecor();
  console.log(`  Decor in inventory: ${decorInv.length}\n`);

  const usedTiles = new Set(Object.keys(player.getGardenTiles()).map(Number));
  let freeTile = null;
  for (let i = 0; i < 100; i++) {
    if (!usedTiles.has(i)) { freeTile = i; break; }
  }

  if (decorInv.length > 0 && freeTile !== null) {
    const decor = decorInv[0];

    await expect(`PlaceDecor (${decor.decorId} at tile ${freeTile})`,
      () => actions.placeDecor(decor.decorId, "Dirt", freeTile, 0), {
        matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
      });

    await sleep(500);

    await expect(`PickupDecor (tile ${freeTile})`,
      () => actions.pickupDecor("Dirt", freeTile), {
        matchPath: "/child/data/userSlots/0/data/(garden|inventory)",
      });
  } else {
    console.log("  [SKIP] PlaceDecor/PickupDecor — no decor or no free tile");
  }
});
