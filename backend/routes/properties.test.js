// Run with: npm test   (uses Node's built-in test runner, no extra deps)
// Needs the local MySQL running, same as `npm run dev`.
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");

const propertiesRouter = require("./properties");
const pool = require("../db");

// Mount the router on its own app so these tests exercise the real routing and
// validation, not a hand-rolled imitation of it.
const app = express();
app.use("/api/properties", propertiesRouter);

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // port 0 = let the OS pick a free one
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/properties`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end(); // otherwise the open pool keeps the test process alive
});

const get = async (query) => {
  const res = await fetch(`${baseUrl}${query}`);
  return { status: res.status, body: await res.json() };
};

test("a repeated string param is rejected, not crashed on", async () => {
  const { status, body } = await get("?city=Portland&city=Salem");

  assert.strictEqual(status, 400);
  assert.match(body.error, /city.*once/i);
});

test("a repeated zipcode is rejected the same way", async () => {
  const { status, body } = await get("?zipcode=92211&zipcode=92253");

  assert.strictEqual(status, 400);
  assert.match(body.error, /zipcode.*once/i);
});

test("a repeated numeric param says it was repeated, not that it is non-numeric", async () => {
  const { status, body } = await get("?limit=5&limit=5");

  assert.strictEqual(status, 400);
  // The old message blamed the value ("must be a non-negative integer"), which
  // sent you looking at "5" instead of at the duplication.
  assert.match(body.error, /limit.*once/i);
});

test("a normal single-value filter is unaffected", async () => {
  const { status, body } = await get("?city=Los%20Angeles&limit=1");

  assert.strictEqual(status, 200);
  assert.strictEqual(body.results.length, 1);
  assert.strictEqual(body.results[0].L_City.trim(), "Los Angeles");
});

test("a request with no filters still returns the first page", async () => {
  const { status, body } = await get("");

  assert.strictEqual(status, 200);
  assert.strictEqual(body.limit, 20);
  assert.strictEqual(body.offset, 0);
  assert.strictEqual(body.results.length, 20);
});
