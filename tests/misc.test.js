const { runTest } = require("./helper");

runTest(async ({ actions, expect }) => {
  console.log("--- Misc ---\n");

  await expect("CheckFriendBonus", () => actions.checkFriendBonus());

  await expect("ThrowSnowball", () => actions.throwSnowball());
});
