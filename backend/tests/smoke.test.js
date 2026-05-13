const { test } = require("node:test");
const assert = require("node:assert/strict");

test("config module loads", async () => {
  const config = require("../config");
  assert.ok(typeof config.port === "number");
  assert.ok(config.jwtSecret);
  assert.ok(config.jwtRefreshSecret);
  assert.ok(config.jwtAccessExpiresIn);
});
