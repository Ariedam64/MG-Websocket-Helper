require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Connection } = require("./connection");
const { fetchVersionForRoom } = require("./utils/version");
const { GameState } = require("./state/state");
const { Actions } = require("./actions");

const COOKIE = process.env.MC_JWT || "";
const ROOM = process.env.ROOM || "";

// --- Start ---
async function main() {
  const version = await fetchVersionForRoom(ROOM);

  const conn = new Connection({
    cookie: COOKIE,
    room: ROOM,
    version,
  });

  const state = new GameState();
  const actions = new Actions(conn);

  const outDir = path.join(__dirname, "dumps");

  conn.onStatus = (status, info) => console.log(`[WS] ${status}`, info);

  conn.onMessage = (msg) => {
    state.handleMessage(msg);

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    if (msg.type === "Welcome") {
      fs.writeFileSync(path.join(outDir, "welcome_full.json"), JSON.stringify(msg, null, 2));
      fs.writeFileSync(path.join(outDir, "room_state.json"), JSON.stringify(state.roomState, null, 2));
      fs.writeFileSync(path.join(outDir, "game_state.json"), JSON.stringify(state.gameState, null, 2));
      console.log("[DUMP] States saved to dumps/");
    }

    if (msg.type === "PartialState") {
      fs.writeFileSync(path.join(outDir, "room_state.json"), JSON.stringify(state.roomState, null, 2));
      fs.writeFileSync(path.join(outDir, "game_state.json"), JSON.stringify(state.gameState, null, 2));

      const logFile = path.join(outDir, "patches.json");
      const existing = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf-8")) : [];
      existing.push(...(msg.patches || []));
      fs.writeFileSync(logFile, JSON.stringify(existing, null, 2));
    }
  };

  conn.connect();

  process.on("SIGINT", () => {
    conn.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
