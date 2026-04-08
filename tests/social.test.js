const { runTest } = require("./helper");

runTest(async ({ actions, expect }) => {
  console.log("--- Social / Chat ---\n");

  await expect("Chat", () => actions.chat("test message"), {
    matchPath: "/data/chat",
  });

  await expect("Emote", () => actions.emote(1), {
    matchPath: "/data/players/0/emoteData",
  });

  // Wish is for deleting seeds — moved to garden test
});
