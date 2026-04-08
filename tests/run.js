const { execSync } = require("child_process");
const path = require("path");

const TESTS = [
  "session",
  "social",
  "movement",
  "shop",
  "garden",
  "pet",
  "inventory",
  "decor",
  "misc",
];

const arg = process.argv[2];

if (arg === "--help" || arg === "-h") {
  console.log("Usage: node tests/run.js [test-name]\n");
  console.log("Available tests:");
  TESTS.forEach((t) => console.log(`  - ${t}`));
  console.log("\n  node tests/run.js          # run all tests one by one");
  console.log("  node tests/run.js shop     # run only shop test");
  process.exit(0);
}

const toRun = arg ? [arg] : TESTS;

for (const test of toRun) {
  if (!TESTS.includes(test)) {
    console.error(`Unknown test: ${test}`);
    console.error(`Available: ${TESTS.join(", ")}`);
    process.exit(1);
  }

  const file = path.join(__dirname, `${test}.test.js`);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Running: ${test}`);
  console.log(`${"=".repeat(50)}\n`);

  try {
    execSync(`node "${file}"`, { stdio: "inherit", timeout: 30000 });
  } catch (err) {
    console.error(`\n[FAIL] ${test} test failed\n`);
  }
}

console.log("\n[DONE] All tests completed.");
