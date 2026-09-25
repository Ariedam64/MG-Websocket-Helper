const { runTest, sleep } = require("./helper");

const MAX_STORAGE = 25;
const MAX_INVENTORY = 100;

runTest(async ({ actions, player, expect }) => {
  console.log("--- Inventory / Storage ---\n");

  const invCount = player.inventory.length;
  const hutchCount = player.getPetHutch().length;
  const siloCount = player.getSeedSilo().length;
  const shedCount = player.getDecorShed().length;

  console.log(`  Inventory: ${invCount}/${MAX_INVENTORY}`);
  console.log(`  PetHutch: ${hutchCount}/${MAX_STORAGE} | SeedSilo: ${siloCount}/${MAX_STORAGE} | DecorShed: ${shedCount}/${MAX_STORAGE}\n`);

  // --- MoveInventoryItem ---
  const moveItem = player.inventory.find((i) => i.id || i.toolId || i.species || i.eggId || i.decorId);
  if (moveItem && player.inventory.length >= 2) {
    const itemName = moveItem.id || moveItem.toolId || moveItem.species || moveItem.eggId || moveItem.decorId;
    await expect(`MoveInventoryItem (${itemName} -> index 1)`,
      () => actions.moveInventoryItem(itemName, 1), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    await expect(`MoveInventoryItem (${itemName} -> index 0) — swap back`,
      () => actions.moveInventoryItem(itemName, 0), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] MoveInventoryItem — < 2 items");
  }

  // --- SetSelectedItem ---
  await expect("SetSelectedItem (index 5)", () => actions.setSelectedItem(5), {
    matchPath: "/child/data/userSlots/0/notAuthoritative",
  });
  await sleep(300);

  // --- ToggleLockItem ---
  const lockItem = player.inventory.find((i) => i.id);
  if (lockItem) {
    await expect(`ToggleLockItem (${lockItem.id.slice(0, 8)}...)`,
      () => actions.toggleLockItem(lockItem.id), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    await expect("ToggleLockItem — toggle back",
      () => actions.toggleLockItem(lockItem.id), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] ToggleLockItem — no item with id");
  }

  // --- PutItemInStorage / RetrieveItemFromStorage (seed <-> SeedSilo) ---
  const seedWithQty = player.getSeeds().find((s) => s.quantity > 1);
  if (seedWithQty && siloCount < MAX_STORAGE) {
    await expect(`PutItemInStorage (${seedWithQty.species} x1 -> SeedSilo)`,
      () => actions.putItemInStorage(seedWithQty.species, "SeedSilo", { toStorageIndex: siloCount, quantity: 1 }), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    if (invCount < MAX_INVENTORY) {
      await expect(`RetrieveItemFromStorage (${seedWithQty.species} x1 <- SeedSilo)`,
        () => actions.retrieveItemFromStorage(seedWithQty.species, "SeedSilo", { toInventoryIndex: invCount, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (seed) — inventory full");
    }
  } else if (siloCount >= MAX_STORAGE) {
    console.log("  [SKIP] PutItemInStorage (seed) — SeedSilo full");

    // Try retrieve instead if inventory has space
    const siloItems = player.getSeedSilo();
    if (siloItems.length > 0 && invCount < MAX_INVENTORY) {
      const siloItem = siloItems[0];
      await expect(`RetrieveItemFromStorage (${siloItem.species} x1 <- SeedSilo)`,
        () => actions.retrieveItemFromStorage(siloItem.species, "SeedSilo", { toInventoryIndex: invCount, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);

      // Put it back
      await expect(`PutItemInStorage (${siloItem.species} x1 -> SeedSilo — restore)`,
        () => actions.putItemInStorage(siloItem.species, "SeedSilo", { toStorageIndex: 0, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (seed) — inventory full or silo empty");
    }
  } else {
    console.log("  [SKIP] PutItemInStorage/RetrieveItemFromStorage (seed) — no seed with qty > 1");
  }

  // --- PutItemInStorage / RetrieveItemFromStorage (decor <-> DecorShed) ---
  const decor = player.getDecor().find((d) => d.quantity > 1);
  if (decor && shedCount < MAX_STORAGE) {
    await expect(`PutItemInStorage (${decor.decorId} x1 -> DecorShed)`,
      () => actions.putItemInStorage(decor.decorId, "DecorShed", { toStorageIndex: shedCount, quantity: 1 }), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    if (invCount < MAX_INVENTORY) {
      await expect(`RetrieveItemFromStorage (${decor.decorId} x1 <- DecorShed)`,
        () => actions.retrieveItemFromStorage(decor.decorId, "DecorShed", { toInventoryIndex: invCount, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (decor) — inventory full");
    }
  } else if (shedCount >= MAX_STORAGE) {
    console.log("  [SKIP] PutItemInStorage (decor) — DecorShed full");

    const shedItems = player.getDecorShed();
    if (shedItems.length > 0 && invCount < MAX_INVENTORY) {
      const shedItem = shedItems[0];
      await expect(`RetrieveItemFromStorage (${shedItem.decorId} x1 <- DecorShed)`,
        () => actions.retrieveItemFromStorage(shedItem.decorId, "DecorShed", { toInventoryIndex: invCount, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);

      await expect(`PutItemInStorage (${shedItem.decorId} x1 -> DecorShed — restore)`,
        () => actions.putItemInStorage(shedItem.decorId, "DecorShed", { toStorageIndex: 0, quantity: 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (decor) — inventory full or shed empty");
    }
  } else {
    console.log("  [SKIP] PutItemInStorage/RetrieveItemFromStorage (decor) — no decor with qty > 1");
  }

  // --- PutItemInStorage / RetrieveItemFromStorage (pet <-> PetHutch) ---
  const invPets = player.getPets();
  if (invPets.length > 0 && hutchCount < MAX_STORAGE) {
    const pet = invPets[0];
    const petId = pet.id;
    const petName = pet.petSpecies || pet.name || petId.slice(0, 8);
    await expect(`PutItemInStorage (${petName} -> PetHutch)`,
      () => actions.putItemInStorage(petId, "PetHutch", { toStorageIndex: hutchCount }), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    if (invCount < MAX_INVENTORY) {
      // After put, inventory has 1 less item
      await expect(`RetrieveItemFromStorage (${petName} <- PetHutch)`,
        () => actions.retrieveItemFromStorage(petId, "PetHutch", { toInventoryIndex: invCount - 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (pet) — inventory full");
    }
  } else if (hutchCount >= MAX_STORAGE) {
    console.log("  [SKIP] PutItemInStorage (pet) — PetHutch full");

    const hutchPets = player.getPetHutch();
    if (hutchPets.length > 0 && invCount < MAX_INVENTORY) {
      const pet = hutchPets[0];
      const petId = pet.id;
      const petName = pet.petSpecies || pet.name || petId.slice(0, 8);
      await expect(`RetrieveItemFromStorage (${petName} <- PetHutch)`,
        () => actions.retrieveItemFromStorage(petId, "PetHutch", { toInventoryIndex: invCount }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);

      // After retrieve, hutch has 1 less item — put back at the end
      await expect(`PutItemInStorage (${petName} -> PetHutch — restore)`,
        () => actions.putItemInStorage(petId, "PetHutch", { toStorageIndex: hutchCount - 1 }), {
          matchPath: "/child/data/userSlots/0/data/inventory",
        });
      await sleep(300);
    } else {
      console.log("  [SKIP] RetrieveItemFromStorage (pet) — inventory full or hutch empty");
    }
  } else {
    console.log("  [SKIP] PutItemInStorage/RetrieveItemFromStorage (pet) — no inventory pet");
  }

  // --- MoveStorageItem ---
  const siloItems = player.getSeedSilo();
  if (siloItems.length >= 2) {
    const item = siloItems[0];
    const itemName = item.species || item.decorId || item.id;
    await expect(`MoveStorageItem (${itemName} -> index 1 in SeedSilo)`,
      () => actions.moveStorageItem(itemName, "SeedSilo", 1), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);

    await expect(`MoveStorageItem (${itemName} -> index 0) — restore`,
      () => actions.moveStorageItem(itemName, "SeedSilo", 0), {
        matchPath: "/child/data/userSlots/0/data/inventory",
      });
    await sleep(300);
  } else {
    console.log("  [SKIP] MoveStorageItem — < 2 items in SeedSilo");
  }

  // --- LogItems ---
  await expect("LogItem", () => actions.logItem({ kind: "inventoryItem", itemId: player.inventory[0]?.id }));
});
