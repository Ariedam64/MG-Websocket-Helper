require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Connection } = require("../connection");
const { fetchVersion } = require("../utils/version");
const { GameState } = require("../state/state");
const { Actions } = require("../actions");

const COOKIE = process.env.MC_JWT || "";
const ROOM = process.env.ROOM || "";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Connect to the game, wait for the player slot to load, then run the test callback.
 * @param {(ctx: { conn, state, actions, player, expect }) => Promise<void>} testFn
 */
async function runTest(testFn) {
  const version = await fetchVersion();
  const conn = new Connection({ cookie: COOKIE, room: ROOM, version });
  const state = new GameState();
  const actions = new Actions(conn);

  let ready = false;
  let patchListener = null;
  const results = [];

  conn.onMessage = (msg) => {
    state.handleMessage(msg);

    // Forward patches to current listener
    if (msg.type === "PartialState" && patchListener) {
      patchListener(msg.patches || []);
    }

    // Wait until we have the player slot loaded
    if (!ready && msg.type === "PartialState" && state.players.size > 0) {
      const player = state.getAllPlayers()[0];
      if (player && player.coins > 0) {
        ready = true;
        console.log(`\n${DIM}[TEST] Ready — ${player.name} | ${player.coins.toLocaleString()} coins${RESET}\n`);

        testFn({ conn, state, actions, player, expect })
          .then(() => {
            printResults();
            setTimeout(() => {
              conn.disconnect();
              process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
            }, 500);
          })
          .catch((err) => {
            console.error(`${RED}[ERROR] ${err.message}${RESET}`);
            conn.disconnect();
            process.exit(1);
          });
      }
    }
  };

  /**
   * Send an action and wait for a matching patch response.
   * @param {string} name - Test name
   * @param {Function} actionFn - Function that sends the action
   * @param {object} opts
   * @param {string} [opts.matchPath] - Patch path regex to look for
   * @param {number} [opts.timeout=2000] - Timeout in ms
   * @param {Function} [opts.validate] - Optional validator (patches) => boolean
   */
  function expect(name, actionFn, opts = {}) {
    const { matchPath, timeout = 2000, validate } = opts;

    return new Promise((resolve) => {
      const collected = [];
      let resolved = false;

      const done = (status, detail = "") => {
        if (resolved) return;
        resolved = true;
        patchListener = null;

        const icon = status === "PASS" ? `${GREEN}PASS${RESET}` :
                     status === "FAIL" ? `${RED}FAIL${RESET}` :
                     `${YELLOW}WARN${RESET}`;

        const detailStr = detail ? ` ${DIM}${detail}${RESET}` : "";
        console.log(`  [${icon}] ${name}${detailStr}`);
        results.push({ name, status, detail });
        resolve();
      };

      // Listen for patches
      patchListener = (patches) => {
        collected.push(...patches);

        if (matchPath) {
          const regex = new RegExp(matchPath);
          const match = patches.find((p) => regex.test(p.path));
          if (match) {
            if (validate) {
              done(validate(collected) ? "PASS" : "FAIL", `matched ${match.path}`);
            } else {
              done("PASS", `matched ${match.path}`);
            }
            return;
          }
        }

        // If no matchPath, any patch = response
        if (!matchPath && patches.length > 0) {
          if (validate) {
            done(validate(collected) ? "PASS" : "FAIL", `${patches.length} patches`);
          } else {
            done("PASS", `${patches.length} patches received`);
          }
        }
      };

      // Send the action
      actionFn();

      // Timeout
      setTimeout(() => {
        if (matchPath) {
          done("FAIL", `no patch matching ${matchPath} within ${timeout}ms`);
        } else {
          done("WARN", `no response within ${timeout}ms (might be normal)`);
        }
      }, timeout);
    });
  }

  function printResults() {
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const warned = results.filter((r) => r.status === "WARN").length;

    console.log(`\n${"─".repeat(50)}`);
    console.log(
      `  ${GREEN}${passed} passed${RESET}` +
      (failed > 0 ? `  ${RED}${failed} failed${RESET}` : "") +
      (warned > 0 ? `  ${YELLOW}${warned} warn${RESET}` : "") +
      `  (${results.length} total)`
    );
    console.log(`${"─".repeat(50)}\n`);
  }

  conn.connect();

  process.on("SIGINT", () => {
    conn.disconnect();
    process.exit(0);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { runTest, sleep };
