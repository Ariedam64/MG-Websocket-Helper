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
├── connection.js          # WebSocket connection (handshake, ping/pong)
├── actions.js             # 65 sendable actions
├── .env                   # Credentials (not committed)
├── utils/
│   └── version.js         # Fetches game version dynamically
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

`GameState` initializes on `Welcome` then updates on every `PartialState` via JSON Patch.

```js
const state = new GameState();
conn.onMessage = (msg) => state.handleMessage(msg);

state.getAllPlayers()           // Player[]
state.getPlayer(id)            // Player
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

// Garden
player.getGardenPlants()
player.getGardenDecor()
player.getBoardwalkTiles()

// Active pets (deployed)
player.getActivePets()
player.getAllPets()             // inventory + hutch + active
```

## Actions

65 actions available:

```js
const actions = new Actions(conn);

// Social
actions.chat(message)
actions.emote(emoteType)
actions.kickPlayer(playerId)
actions.setPlayerData({ name, cosmetic })
actions.usurpHost()

// Movement
actions.move(x, y)
actions.teleport(x, y)

// Shop — item is { itemType, species | toolId | eggId | decorId }
actions.purchaseShopItem(shop, item)

// Garden
actions.plantSeed(tile, species)
actions.waterPlant(tile)
actions.harvestCrop(tile, slotIndex)
actions.sellAllCrops()
actions.plantGardenPlant(tile, itemId)
actions.potPlant(tile)
actions.mutationPotion(tile, growSlotIdx, mutation)
actions.cropCleanser(tile, growSlotIdx)
actions.removeGardenObject(tile, slotType)
actions.preserve(itemId, growSlotIdx)
actions.displayCrop(tileType, tileIndex, itemId)
actions.pickupDisplayedCrop(tileType, tileIndex)
actions.wish(itemId)

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
actions.savePetTeam(teamId, name, petIds)
actions.applyPetTeam(teamId)
actions.deletePetTeam(teamId)
actions.movePetTeam(movePetTeamId, toIndex)
actions.setPetTeamEmblem(teamId, emblem)

// Inventory / Storage
actions.moveInventoryItem(moveItemId, toIndex)
actions.setSelectedItem(index)
actions.toggleLockItem(itemId)
actions.putItemInStorage(itemId, storageId, { toStorageIndex, quantity })
actions.retrieveItemFromStorage(itemId, storageId, { toInventoryIndex, quantity })
actions.moveStorageItem(itemId, storageId, toStorageIndex)
actions.logItems()

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

- **URL**: `wss://magicgarden.gg/version/{version}/api/rooms/{room}/connect`
- **Auth**: Cookie `mc_jwt={token}`
- **Welcome**: full state (room + game) received on connect
- **RoomFrame**: JSON patches (RFC 6902) for updates, under `state.patches`.
  Normalized to the legacy `PartialState` shape by `normalizePartialState`.
- **Keepalive**: server sends `ping`, client responds `pong`

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
- `Ping` and `PlayerPosition` are not commands and stay flat.
- Room-scoped messages (`Chat`, `Emote`, `RestartGame`, `UsurpHost`, …) are
  never wrapped.

The old flat format (`{ scopePath, type, ...params }`) is still honoured by the
server but is being removed. To fall back to it:

```js
const { Actions, COMMAND_MODES } = require("./actions");
const actions = new Actions(conn, { commandMode: COMMAND_MODES.LEGACY });
```
