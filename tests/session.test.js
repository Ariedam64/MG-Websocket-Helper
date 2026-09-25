const { runTest, sleep } = require("./helper");

runTest(async ({ conn, state, actions, expect, check }) => {
  console.log("--- Session / Heartbeat ---\n");

  await expect("Ping", () => actions.ping(), {
    matchPath: "/child/data/currentTime",
  });

  // Weather is no longer in the room state (it is always null and never
  // patched), so there is nothing to wait for. Sent in the envelope the server
  // answers `not_ackable`, which is why RAW_GAME_TYPES sends it flat.
  const weatherResult = await conn.sendQuinoaCommand({ type: "CheckWeatherStatus" });
  check(
    "CheckWeatherStatus refused in the envelope (sent flat)",
    weatherResult?.code === "not_ackable",
    `code=${weatherResult?.code}`
  );
  actions.checkWeatherStatus();

  // The post-Welcome handshake already voted, so a repeat vote is a no-op.
  await sleep(500);
  check(
    "VoteForGame (handshake vote recorded)",
    state.roomState?.gameVotes?.[state.selfPlayerId] === "Quinoa",
    `gameVotes[self]=${JSON.stringify(state.roomState?.gameVotes?.[state.selfPlayerId])}`
  );
  check("SetSelectedGame (handshake)", state.roomState?.selectedGame === "Quinoa");
});
