# Websocket MG

Node.js WebSocket client for Magic Garden. Connects to the game server, maintains real-time state and allows sending actions.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your credentials:
```env
MC_JWT=your_mc_jwt_token_here
ROOM=your_room_id
```

The `mc_jwt` token can be found in your browser cookies on `magicgarden.gg` (DevTools > Application > Cookies).  
Leave `ROOM` empty for a random room.

## Usage

```bash
node main.js
```

## Project Structure

```
├── main.js               # Entry point
├── connection.js          # WebSocket connection (handshake, keepalive, reconnect)
├── actions.js             # sendable actions
├── .env                   # Credentials (not committed)
├── utils/
│   └── version.js         # Fetches the room's game version
├── state/
│   ├── state.js           # GameState (Welcome + PartialState → models)
│   ├── jsonPatch.js       # RFC 6902 JSON Patch
│   └── models/
│       ├── player.js      # Player (room data + userSlot merged)
│       ├── shop.js        # Shop (inventory + restock timer)
│       └── room.js        # Room (metadata)
└── tests/                 # Tests by category
```

## State

`GameState` initializes on `Welcome` then applies every frame's JSON Patch to the full state, like the game does (`state.fullState`; `roomState` = `fullState.data`, `gameState` = `fullState.child.data`).

```js
const state = new GameState();
conn.onMessage = (msg) => state.handleMessage(msg);

state.getAllPlayers()           // Player[]
state.getPlayer(id)            // Player
state.getSelf()                // our own Player (Welcome.selfPlayerId)
state.getRemainingStocks("seed") // { itemId: stock left for us }
state.getShop("seed")          // Shop
state.getWeather()             // string | null
state.getRoom()                // Room
```

### Player

Each `Player` merges room data (name, avatar, cosmetic) with its `userSlot` (coins, inventory, garden, pets).

```js
const player = state.getPlayer(id);

// Info
player.name
player.coins
player.magicDust
player.petTeams
player.position               // { x, y }
player.stats
player.activityLogs

// Inventory
player.getSeeds()
player.getTools()
player.getEggs()
player.getPets()
player.getPlants()
player.getProduce()
player.getDecor()

// Storages
player.getPetHutch()
player.getSeedSilo()
player.getDecorShed()
player.getFeedingTrough()
player.getToolShack()

// Garden
player.getGardenPlants()
player.getGardenDecor()
player.getGardenEggs()
player.getCrystals()             // dirt + boardwalk, tagged with tileType
player.getBoardwalkTiles()

// Active pets (deployed)
player.getActivePets()
player.getAllPets()             // inventory + hutch + active
```

## Actions


```js
const actions = new Actions(conn);

// Social
actions.chat(message)
actions.chatTyping(isTyping)
actions.requestGame(name)
actions.emote(emoteType)
actions.kickPlayer(playerId)
actions.setPlayerData({ name, cosmetic })
actions.usurpHost()

// Movement
actions.move(x, y)
actions.teleport(x, y, tramArrivalStationIndex?)
actions.tramBoarding(stationIndex) / tramArrival(stationIndex)

// Shop — item is { itemType, species | toolId | eggId | decorId }
actions.purchaseShopItem(shop, item)

// Garden
actions.plantSeed(tile, species)
actions.waterPlant(tile)
actions.harvestCrop(tile, slotsIndex, cropItemId?)  // slotsIndex required; cropItemId defaults to a fresh UUID
actions.setGrowSlotLock(tile, growSlotId, locked)
actions.sellAllCrops()
actions.plantGardenPlant(tile, itemId)
actions.potPlant(tile, plantItemId?)                 // plantItemId defaults to a fresh UUID
actions.mutationPotion(tile, growSlotIdx, mutation)
actions.cropCleanser(tile, growSlotIdx)
actions.removeGardenObject(tile, slotType)
actions.preserve(itemId, growSlotIdx)
actions.displayCrop(tileType, tileIndex, itemId)
actions.pickupDisplayedCrop(tileType, tileIndex)
actions.wish(itemId)

// Crystals - shard is { toolId } (from a stack) or { itemId } (picked back up)
actions.placeCrystal(shard, tileType, tileIndex)
actions.fuseCrystal(shard, tileType, tileIndex, mergeGainSeconds)
actions.pickupCrystal(crystalType, tileType, tileIndex, itemId?)

// Decor
actions.placeDecor(decorId, tileType, tileIndex, rotation)
actions.pickupDecor(tileType, tileIndex)

// Pets
actions.placePet(itemId, { x, y }, tileType, tileIndex)
actions.pickupPet(petId)
actions.feedPet(petItemId, cropItemId)
actions.sellPet(itemId)
actions.namePet(petItemId, name)
actions.swapPet(petSlotId, petInventoryId)
actions.swapPetFromStorage(petSlotId, storagePetId, storageId)
actions.movePetSlot(petSlotId, toIndex)
actions.growEgg(tile, eggId)
actions.hatchEgg(tile)
actions.equipPetCosmetic(petItemId, slotCategory, cosmeticId)

// Pet teams
actions.savePetTeam(teamId, name, petIds, isCreate)
actions.applyPetTeam(teamId)
actions.deletePetTeam(teamId)
actions.movePetTeam(movePetTeamId, toIndex)
actions.setPetTeamEmblem(teamId, emblem)       // emblem: { type: "number"|"pet"|"icon"|"cosmetic", ... }

// Inventory / Storage
actions.moveInventoryItem(moveItemId, toIndex)
actions.setSelectedItem(index | null)
actions.toggleLockItem(itemId)
actions.putItemInStorage(itemId, storageId, { toStorageIndex, quantity })
actions.retrieveItemFromStorage(itemId, storageId, { toInventoryIndex, quantity })
actions.moveStorageItem(itemId, storageId, toStorageIndex)
actions.swapItemWithStorage(storageId, invItemId, storageItemId, { toStorageIndex, toInventoryIndex, draggedQuantity, draggedFromInventory })
actions.upgradePetHutch() / upgradeSeedSilo() / upgradeDecorShed() / upgradeToolShack()
actions.logItem(target)   // { kind: "inventoryItem", itemId } | { kind: "growSlot", slot, slotsIndex } | { kind: "petSlot", petId } | { kind: "displayedCrop", tileType, localTileIndex, cropId }

// Capsules (result.payload lists what came out)
actions.openDawnCapsule() / openAllDawnCapsules() / openAmberCapsule() / openAllAmberCapsules()

// NPC visits
actions.requestNpcVisit(trigger?)   // { kind: "call" } | { kind: "harvest", crop }
actions.acceptNpcVisitGift() / skipNpcVisitArrival() / npcVisitFarewellReady() / npcVisitFarewellSeen()

// Credits (spend the paid currency; the result waits 10s, refusals carry code "insufficient_credits" / "account_required")
actions.purchaseSeedWithCredits(species, shop?) / purchaseToolWithCredits(toolId, shop?)
actions.purchaseEggWithCredits(egg, shop?) / purchaseDecorWithCredits(decorId, shop?)
actions.purchasePetCosmeticWithCredits(cosmeticId)
actions.upgradeStorageWithCredits(decorId)
actions.restockSeedsWithCredits() / restockEggsWithCredits() / restockToolsWithCredits() / restockDecorsWithCredits()
actions.instaGrowWithCredits(dirtTileIndex)

// Dev - in the game's schema, never sent by the production client; expect a refusal on a normal account
actions.devWeather(weather) / devSetCurrency(currency, amount, operation?) / devSetFastForward(enabled)
actions.devClearInventory() / devClearGarden() / devSpectate() / devInstaGrowAll()
actions.devSetJournalCompletion(completion) / devPetTeams(action) / devSaveWarning(state)
actions.devSetPet(petId, changes) / devMovePet(petId, position) / devEditPet(petId, edit)
actions.devMoveGardenObject(fromSlotType, fromSlot, toSlotType, toSlot) / devRemoveGardenObject(slot, slotType)
actions.devSetSize(dirtTileIdx, slotId, size, allSlots?) / devEditCrop(dirtTileIdx, edit, slotId?)
actions.devGrantInventoryItem(item, quantity?) / devPlaceGardenObject(object, target?)
actions.devCompleteTutorial() / devResetAccount()

// Misc
actions.ping()
actions.checkWeatherStatus()
actions.checkFriendBonus()
actions.throwSnowball()
```

## Tests

```bash
node tests/run.js              # run all tests
node tests/run.js movement     # run a specific test
node tests/run.js --help       # list available tests
```

Available: `session`, `social`, `movement`, `shop`, `garden`, `pet`, `inventory`, `decor`, `misc`

## Protocol

- **URL**: `wss://magicgarden.gg/version/{version}/api/rooms/{room}/connect`, with the web client's query params (`surface`, `platform`, `version`, `capabilities`, `locale`, `clientDocumentId`, `clientConnectionAttempt`, `clientNavigationType`, `clientVisibilityState`, and `reclaimSupersededSession` after a 4250/4300 close). No `playerId`: the server assigns it.
- **Version**: read from the room page (`/r/{room}`), falling back to `/platform/v1/version`; re-fetched before each reconnect.
- **Auth**: Cookie `mc_jwt={token}`. A Welcome whose own player has no `discordUserId`/`databaseUserId` means the cookie was refused (status `error`, code 4800, no reconnect).
- **Open**: the client sends `{"type":"SocketOpened"}` and nothing else; the server drops sockets that don't announce themselves within 10s.
- **Welcome**: full state (room + game) and `selfPlayerId`. Only then does the client send `VoteForGame` + `SetSelectedGame`.
- **RoomFrame**: JSON patches (RFC 6902) for updates, under `state.patches`.
  The server no longer sends `PartialState`; frames with patches are normalized to that shape by `normalizePartialState` (their `events` are kept).
- **Heartbeat**: the server sends a text `ping` every ~4s, the client answers `pong` and reconnects after 10s without one (same rule as the game). A socket not welcomed within 30s is dropped and retried.
- **Reconnect**: exponential backoff from 1.5s up to 60s, plus jitter, and the version is re-fetched first. Close codes the game treats as final stop the client (`CLOSE_CODES` / `PERMANENT_CLOSE_CODES`: kicked 4500, auth 4800, banned 4900, session expired 4840, ...), with two exceptions: a superseded session (4250/4300) is reclaimed after 30s unless `reclaimSuperseded: false` (this kicks the other session out), and a version change (4700/4710) reconnects with the new version. 4801 is retried up to 3 times a minute. `conn.onStatus(status, info)` reports `connecting` / `connected` / `reconnecting` / `disconnected` / `error`. Pass `reconnect: false` to disable.

### QuinoaCommand envelope

Client-to-server gameplay actions are wrapped in an envelope that feeds the
server's prediction/rollback system:

```json
{
  "scopePath": ["Room", "Quinoa"],
  "type": "QuinoaCommand",
  "requestId": "<crypto.randomUUID()>",
  "commandSequence": 1,
  "command": { "type": "FeedPet", "petItemId": "...", "cropItemId": "..." }
}
```

- `commandSequence` starts at `Welcome.executedCommandSequence + 1` and
  increments once per command. `Connection` tracks it; commands sent before
  `Welcome` are queued and flushed with the right sequence.
- The server replies with `QuinoaCommandResult` (`{ requestId, ok, code }`).
  `Actions` methods return a promise resolving to that result, or `null` after
  5s / on disconnect. The promise never rejects, so it can be ignored.
- Some Quinoa messages are still sent flat by the game: `Ping`, `PlayerPosition`, `Teleport`, `SetSelectedItem`, `CheckWeatherStatus`, `CheckFriendBonus`, `ThrowSnowball`, `QuinoaTutorialSkipped`, `RequestPetGreet`, `DropObject`, `PickupObject` and the four `Upgrade*` (see `RAW_GAME_TYPES`). Their `Actions` methods return `undefined`.
- Room-scoped messages (`Chat`, `Emote`, `RestartGame`, `UsurpHost`, …) are
  never wrapped.

The old flat format (`{ scopePath, type, ...params }`) is still honoured by the
server but is being removed. To fall back to it:

```js
const { Actions, COMMAND_MODES } = require("./actions");
const actions = new Actions(conn, { commandMode: COMMAND_MODES.LEGACY });
```
