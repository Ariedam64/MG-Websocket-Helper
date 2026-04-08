require("dotenv").config();
const { Connection } = require("./connection");
const { fetchVersion } = require("./utils/version");
const { GameState } = require("./state/state");
const { Actions } = require("./actions");

const COOKIE = process.env.MC_JWT || "";
const ROOM = process.env.ROOM || "";

// --- Start ---
async function main() {
  const version = await fetchVersion();

  const conn = new Connection({
    cookie: COOKIE,
    room: ROOM,
    version,
  });

  const state = new GameState();
  const actions = new Actions(conn);

  conn.onMessage = (msg) => {
    state.handleMessage(msg);
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
