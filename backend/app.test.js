// Tests for the app itself rather than for one router: the health probe, and
// the behaviour a client sees when it asks for something that is not there.
const request = require("supertest");

jest.mock("./db", () => ({ query: jest.fn() }));

const app = require("./app");
const pool = require("./db");

beforeEach(() => {
  pool.query.mockReset();
});

describe("GET /api/health", () => {
  // The point of this endpoint is that it proves the database is reachable, so
  // it has to actually run a query. Returning a hardcoded "ok" would report a
  // healthy service while MySQL was down.
  test("reports ok when the SELECT 1 probe succeeds", async () => {
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "connected" });
    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
  });

  // KEY: a failed probe is a 500, not a 200 with a sad message in the body.
  // Uptime monitors and container orchestrators read the status code; a 200
  // here would keep a broken instance in the load balancer.
  test("reports a 500 when the probe throws", async () => {
    pool.query.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ status: "error", database: "disconnected" });
  });
});

describe("unknown routes", () => {
  test("an unmounted path is a 404", async () => {
    const res = await request(app).get("/api/nope");

    expect(res.status).toBe(404);
  });
});

describe("CORS", () => {
  // The frontend runs on a different port in development, so the browser will
  // refuse the response without this header.
  test("responses carry the allow-origin header", async () => {
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const res = await request(app).get("/api/health");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
