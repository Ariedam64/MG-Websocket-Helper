const { runTest } = require("./helper");

runTest(async ({ actions, expect }) => {
  console.log("--- Session / Heartbeat ---\n");

  await expect("Ping", () => actions.ping(), {
    matchPath: "/child/data/currentTime",
  });

  await expect("CheckWeatherStatus", () => actions.checkWeatherStatus(), {
    matchPath: "/child/data/weather",
    timeout: 3000,
  });

  await expect("VoteForGame", () => actions.voteForGame("Quinoa"), {
    matchPath: "/data/gameVotes",
  });

  await expect("SetSelectedGame", () => actions.setSelectedGame("Quinoa"));
});
