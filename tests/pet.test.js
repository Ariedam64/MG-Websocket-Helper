const { runTest, sleep } = require("./helper");

runTest(async ({ actions, player, expect }) => {
  console.log("--- Pets ---\n");

  const activePets = player.getActivePets();
  const invPets = player.getPets();
  const hutch = player.getPetHutch();
  const produce = player.getProduce();

  console.log(`  Active: ${activePets.length} | Inventory: ${invPets.length} | Hutch: ${hutch.length}\n`);

  // --- FeedPet ---
  if (activePets.length > 0 && produce.length > 0) {
    await expect(`FeedPet (${activePets[0].petSpecies} with ${produce[0].species})`,
      () => actions.feedPet(activePets[0].id, produce[0].id), {
        matchPath: "/child/data/userSlots/0/data",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] FeedPet — no active pet or no produce");
  }

  // --- NamePet ---
  if (invPets.length > 0) {
    const pet = invPets[0];
    const oldName = pet.name || pet.petSpecies;
    await expect(`NamePet (${pet.petSpecies} -> "WsTest")`,
      () => actions.namePet(pet.id, "WsTest"), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    await expect(`NamePet restore (-> "${oldName}")`,
      () => actions.namePet(pet.id, oldName), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] NamePet — no inventory pet");
  }

  // --- PlacePet (from inventory to garden) ---
  // Needs < 3 active pets to have a free slot
  // Position must be within our garden tiles
  const gardenTileIds = Object.keys(player.getGardenTiles()).map(Number);
  if (invPets.length > 0 && activePets.length < 3 && gardenTileIds.length > 0) {
    const pet = invPets[0];
    const tileIndex = gardenTileIds[0]; // pick any valid garden tile
    const x = tileIndex % 10;
    const y = Math.floor(tileIndex / 10);
    await expect(`PlacePet (${pet.petSpecies} at ${x},${y} tile ${tileIndex})`,
      () => actions.placePet(pet.id, { x, y }, "Dirt", tileIndex), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(500);

    // --- PickupPet (back to inventory) ---
    await expect(`PickupPet (${pet.petSpecies})`,
      () => actions.pickupPet(pet.id), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(500);
  } else if (activePets.length >= 3) {
    console.log("  [SKIP] PlacePet/PickupPet — already 3 active pets (slots full)");
  } else {
    console.log("  [SKIP] PlacePet/PickupPet — no inventory pet or no garden tiles");
  }

  // --- MovePetSlot ---
  if (activePets.length >= 2) {
    await expect(`MovePetSlot (${activePets[0].petSpecies} to slot 1)`,
      () => actions.movePetSlot(activePets[0].id, 1), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] MovePetSlot — need >= 2 active pets");
  }

  // --- SwapPet (active <-> inventory) ---
  if (activePets.length > 0 && invPets.length > 0) {
    const activePet = activePets[0];
    const invPet = invPets[invPets.length - 1]; // last to avoid using same pet as PlacePet
    await expect(`SwapPet (${activePet.petSpecies} <-> ${invPet.petSpecies})`,
      () => actions.swapPet(activePet.id, invPet.id), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(300);

    // Swap back
    await expect(`SwapPet restore`,
      () => actions.swapPet(invPet.id, activePet.id), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] SwapPet — need active + inventory pet");
  }

  // --- SwapPetFromStorage (active <-> hutch) ---
  if (activePets.length > 0 && hutch.length > 0) {
    const activePet = activePets[activePets.length - 1];
    const hutchPet = hutch[0];
    await expect(`SwapPetFromStorage (${activePet.petSpecies} <-> hutch ${hutchPet.petSpecies})`,
      () => actions.swapPetFromStorage(activePet.id, hutchPet.id, "PetHutch"), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(300);

    // Swap back
    await expect(`SwapPetFromStorage restore`,
      () => actions.swapPetFromStorage(hutchPet.id, activePet.id, "PetHutch"), {
        matchPath: "/child/data/userSlots/0/data/petSlots",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] SwapPetFromStorage — need active + hutch pet");
  }

  // --- GrowEgg ---
  const eggs = player.getEggs();
  const usedTiles = new Set(Object.keys(player.getGardenTiles()).map(Number));
  let eggTile = null;
  for (let i = 0; i < 100; i++) {
    if (!usedTiles.has(i)) { eggTile = i; break; }
  }

  if (eggs.length > 0 && eggTile !== null) {
    await expect(`GrowEgg (${eggs[0].eggId} at tile ${eggTile})`,
      () => actions.growEgg(eggTile, eggs[0].eggId), {
        matchPath: "/child/data/userSlots/0/data/garden/tileObjects",
      });
    // HatchEgg — SKIPPED (needs egg to finish growing)
  } else {
    console.log("  [SKIP] GrowEgg — no eggs or no free tile");
  }

  // --- SellPet (sell the cheapest pet, skip if risky) ---
  // Uncomment to test:
  // if (invPets.length > 0) {
  //   const cheapPet = invPets[invPets.length - 1];
  //   await expect(`SellPet (${cheapPet.petSpecies})`,
  //     () => actions.sellPet(cheapPet.id), {
  //       matchPath: "/child/data/userSlots/0/data",
  //     });
  // }
});
