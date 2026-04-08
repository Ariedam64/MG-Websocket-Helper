const { runTest, sleep } = require("./helper");

runTest(async ({ actions, expect }) => {
  console.log("--- Movement ---\n");

  await expect("Move to (5, 5)", () => actions.move(5, 5), {
    matchPath: "/child/data/userSlots/0/position",
  });

  await sleep(300);

  await expect("Move to (10, 5)", () => actions.move(10, 5), {
    matchPath: "/child/data/userSlots/0/position",
  });

  await sleep(300);

  await expect("Teleport to (0, 0)", () => actions.teleport(0, 0), {
    matchPath: "/child/data/userSlots/0/position",
  });
});
