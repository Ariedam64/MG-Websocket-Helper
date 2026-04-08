const { runTest, sleep } = require("./helper");

runTest(async ({ actions, player, expect }) => {
  console.log("--- Garden / Crops ---\n");

  const usedTiles = new Set(Object.keys(player.getGardenTiles()).map(Number));
  let freeTile = null;
  for (let i = 0; i < 100; i++) {
    if (!usedTiles.has(i)) { freeTile = i; break; }
  }

  const seeds = player.getSeeds();
  const plants = player.getPlants();
  const tools = player.getTools();
  const hasWetPotion = tools.some((t) => t.toolId === "WetPotion" && t.quantity > 0);
  const hasCropCleanser = tools.some((t) => t.toolId === "CropCleanser" && t.quantity > 0);

  // --- PlantSeed ---
  if (freeTile !== null && seeds.length > 0) {
    const species = seeds[0].species;

    await expect(`PlantSeed (${species} at tile ${freeTile})`, () => actions.plantSeed(freeTile, species), {
      matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
    });

    await sleep(500);

    // --- WaterPlant ---
    await expect(`WaterPlant (tile ${freeTile})`, () => actions.waterPlant(freeTile), {
      matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
    });

    await sleep(500);

    // --- MutationPotion (Wet) ---
    if (hasWetPotion) {
      await expect(`MutationPotion (Wet on tile ${freeTile}, slot 0)`,
        () => actions.mutationPotion(freeTile, 0, "Wet"), {
          matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
        });

      await sleep(500);

      // --- CropCleanser ---
      if (hasCropCleanser) {
        await expect(`CropCleanser (tile ${freeTile}, slot 0)`,
          () => actions.cropCleanser(freeTile, 0), {
            matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
          });

        await sleep(500);
      } else {
        console.log("  [SKIP] CropCleanser — no CropCleanser in inventory");
      }
    } else {
      console.log("  [SKIP] MutationPotion — no WetPotion in inventory");
      console.log("  [SKIP] CropCleanser — skipped (depends on MutationPotion)");
    }

    // --- RemoveGardenObject (clean up the planted seed) ---
    await expect(`RemoveGardenObject (tile ${freeTile})`,
      () => actions.removeGardenObject(freeTile, "Dirt"), {
        matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
      });

    await sleep(500);
  } else {
    console.log("  [SKIP] PlantSeed/WaterPlant/MutationPotion/CropCleanser/RemoveGardenObject — no free tile or no seeds");
  }

  // --- PlantGardenPlant (place a potted plant from inventory) ---
  let freeTile2 = null;
  for (let i = 0; i < 100; i++) {
    if (!usedTiles.has(i) && i !== freeTile) { freeTile2 = i; break; }
  }

  if (plants.length > 0 && freeTile2 !== null) {
    const plant = plants[0];
    await expect(`PlantGardenPlant (${plant.species} at tile ${freeTile2})`,
      () => actions.plantGardenPlant(freeTile2, plant.id), {
        matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
      });

    await sleep(500);

    // --- PotPlant (pick it back up) ---
    await expect(`PotPlant (tile ${freeTile2})`, () => actions.potPlant(freeTile2), {
      matchPath: "/child/data/userSlots/0/data/(garden|inventory)",
    });
  } else {
    console.log("  [SKIP] PlantGardenPlant/PotPlant — no potted plant in inventory or no free tile");
  }

  // --- Wish (delete seeds) ---
  // Uncomment to test — this permanently deletes seeds!
  // const wishSeed = player.getSeeds().find((s) => s.quantity > 100);
  // if (wishSeed) {
  //   await expect(`Wish / delete seed (${wishSeed.species})`,
  //     () => actions.wish(wishSeed.species), {
  //       matchPath: "/child/data/userSlots/0/data/inventory",
  //     });
  // }

  // --- SellAllCrops ---
  const produce = player.getProduce();
  if (produce.length > 0) {
    await expect("SellAllCrops", () => actions.sellAllCrops(), {
      matchPath: "/child/data/userSlots/0/data",
    });
  } else {
    console.log("  [SKIP] SellAllCrops — no produce");
  }
});
