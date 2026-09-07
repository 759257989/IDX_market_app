// Endpoint tests for /api/properties, run with Jest and driven through
// Supertest.
//
// KEY: the database is mocked, not connected to. Everything below runs with
// MySQL stopped and Docker shut down, which is what makes this suite usable in
// CI and fast enough to run on every save. It also lets a test set up states
// the real data cannot produce on demand -- an empty result, a listing with no
// open houses, a query that throws.
const request = require("supertest");

// KEY: the mock has to be declared before app.js is required, because that is
// when the router grabs its reference to the pool. jest.mock is hoisted above
// the require calls by the Jest transform, so writing it here is enough.
// The factory replaces the whole module with a single query spy -- the routes
// only ever call pool.query, so nothing else needs to exist.
jest.mock("../db", () => ({ query: jest.fn() }));

const app = require("../app");
const pool = require("../db");

// A row shaped like the SELECT list in the route: the aliased column names,
// with the types mysql2 actually hands back (DECIMAL arrives as a string).
const listingRow = {
  L_ListingID: "24001234",
  L_Address: "123 Main St",
  L_City: "Portland",
  L_State: "OR",
  L_Zip: "97205",
  price: 750000,
  beds: 3,
  baths: "2.5",
  sqft: 1800,
  L_Photos: '["https://example.com/1.jpg"]',
};

// The list endpoint queries twice: COUNT(*) first, then the page of rows.
// Queueing two one-shot resolutions keeps the order explicit at the call site.
function mockListQuery({ total, rows }) {
  pool.query
    .mockResolvedValueOnce([[{ total }]])
    .mockResolvedValueOnce([rows]);
}

// Reaches into the recorded calls to check the SQL the route actually built.
// Testing the response alone would pass even if a filter were silently
// dropped, because the mock returns the same rows either way.
function lastQuery() {
  const calls = pool.query.mock.calls;
  return { sql: calls[calls.length - 1][0], values: calls[calls.length - 1][1] };
}

// A shared mock leaks call history between tests, so reset before each one.
beforeEach(() => {
  pool.query.mockReset();
});

describe("GET /api/properties", () => {
  test("returns the total, the paging used, and the rows", async () => {
    mockListQuery({ total: 87, rows: [listingRow] });

    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 87,
      limit: 20,
      offset: 0,
      results: [listingRow],
    });
  });

  test("defaults to limit 20 offset 0 when the caller asks for nothing", async () => {
    mockListQuery({ total: 0, rows: [] });

    await request(app).get("/api/properties");

    // limit and offset are the last two placeholders, after any filter values.
    expect(lastQuery().values).toEqual([20, 0]);
  });

  test("honours limit and offset", async () => {
    mockListQuery({ total: 87, rows: [] });

    const res = await request(app).get("/api/properties?limit=5&offset=40");

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(40);
    expect(lastQuery().values).toEqual([5, 40]);
  });

  test("an empty page still reports the full total", async () => {
    // Asking for page 100 of an 87-row result: no rows, but total is unchanged.
    mockListQuery({ total: 87, rows: [] });

    const res = await request(app).get("/api/properties?offset=1980");

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.total).toBe(87);
  });

  // Each filter is checked at the SQL level, because that is the only place the
  // difference between them is visible.
  describe("filters", () => {
    test("city compares case- and whitespace-insensitively on both sides", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?city=%20portland%20");

      const { sql, values } = lastQuery();
      expect(sql).toContain("LOWER(TRIM(L_City)) = LOWER(TRIM(?))");
      // The raw value is passed through: TRIM in the SQL does the normalising,
      // so the parameter stays exactly what the caller sent.
      expect(values).toEqual([" portland ", 20, 0]);
    });

    test("zipcode is an exact match", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?zipcode=97205");

      const { sql, values } = lastQuery();
      expect(sql).toContain("L_Zip = ?");
      expect(values).toEqual(["97205", 20, 0]);
    });

    test("minPrice and maxPrice become a bounded range", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?minPrice=300000&maxPrice=900000");

      const { sql, values } = lastQuery();
      expect(sql).toContain("L_SystemPrice >= ?");
      expect(sql).toContain("L_SystemPrice <= ?");
      // Numbers, not the raw strings: a varchar comparison would stop MySQL
      // from using the price index.
      expect(values).toEqual([300000, 900000, 20, 0]);
    });

    test("beds is an exact match, minBeds is a lower bound", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });
      await request(app).get("/api/properties?beds=3");
      expect(lastQuery().sql).toContain("L_Keyword2 = ?");

      pool.query.mockReset();
      mockListQuery({ total: 1, rows: [listingRow] });
      await request(app).get("/api/properties?minBeds=5");
      expect(lastQuery().sql).toContain("L_Keyword2 >= ?");
    });

    test("baths accepts a half count", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?baths=2.5");

      const { sql, values } = lastQuery();
      expect(sql).toContain("LM_Dec_3 = ?");
      expect(values).toEqual([2.5, 20, 0]);
    });

    test("minBaths is a lower bound and also accepts a half count", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?minBaths=1.5");

      const { sql, values } = lastQuery();
      expect(sql).toContain("LM_Dec_3 >= ?");
      expect(values).toEqual([1.5, 20, 0]);
    });

    test("several filters combine with AND in the order they were read", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get(
        "/api/properties?city=Portland&minPrice=300000&beds=3",
      );

      const { sql, values } = lastQuery();
      expect(sql).toContain(" AND ");
      expect(values).toEqual(["Portland", 300000, 3, 20, 0]);
    });

    test("no filters means no WHERE clause at all", async () => {
      mockListQuery({ total: 87, rows: [listingRow] });

      await request(app).get("/api/properties");

      expect(lastQuery().sql).not.toContain("WHERE");
    });
  });

  describe("sorting", () => {
    test("sortBy maps to a real column and defaults to ascending", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?sortBy=price");

      // The tiebreaker keeps paging stable when rows share a price.
      expect(lastQuery().sql).toContain("ORDER BY L_SystemPrice ASC, L_ListingID");
    });

    test("sortOrder=desc reverses it", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties?sortBy=dateListed&sortOrder=desc");

      expect(lastQuery().sql).toContain(
        "ORDER BY ListingContractDate DESC, L_ListingID",
      );
    });

    test("without a sort the rows come back in listing id order", async () => {
      mockListQuery({ total: 1, rows: [listingRow] });

      await request(app).get("/api/properties");

      expect(lastQuery().sql).toContain("ORDER BY L_ListingID");
    });

    // KEY: a column name cannot be a ? placeholder, so the sort column is
    // interpolated into the SQL string. That is only safe because the value
    // came out of a fixed lookup table. This test is the guard on that: an
    // unknown key must be rejected before it can reach the query.
    test("an unknown sortBy is rejected, never interpolated", async () => {
      const res = await request(app).get(
        "/api/properties?sortBy=L_ListingID;DROP TABLE rets_property",
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/sortBy must be one of/);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("sortOrder without sortBy is rejected", async () => {
      const res = await request(app).get("/api/properties?sortOrder=asc");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("sortOrder requires sortBy");
    });

    test("a sortOrder that is not asc or desc is rejected", async () => {
      const res = await request(app).get(
        "/api/properties?sortBy=price&sortOrder=sideways",
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("sortOrder must be asc or desc");
    });
  });

  describe("invalid input", () => {
    // Every one of these must fail before the database is touched: a 400 that
    // still ran a query has already paid the cost it was meant to avoid.
    test.each([
      ["limit=abc", "limit must be a non-negative integer"],
      ["limit=0", "limit must be >= 1"],
      ["limit=101", "limit must be <= 100"],
      ["limit=-5", "limit must be a non-negative integer"],
      ["offset=abc", "offset must be a non-negative integer"],
      ["offset=-1", "offset must be a non-negative integer"],
      ["minPrice=cheap", "minPrice must be a non-negative integer"],
      ["maxPrice=1e6", "maxPrice must be a non-negative integer"],
      ["beds=three", "beds must be a non-negative integer"],
      ["baths=2.5.1", "baths must be a number"],
      ["minBeds=-1", "minBeds must be a non-negative integer"],
      ["minBaths=lots", "minBaths must be a number"],
    ])("rejects ?%s", async (query, message) => {
      const res = await request(app).get(`/api/properties?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: message });
      expect(pool.query).not.toHaveBeenCalled();
    });

    // KEY: Express turns "?city=a&city=b" into an array. Every parser below it
    // assumes a single scalar, and an array reaching mysql2 expands into
    // LOWER(TRIM('a', 'b')) -- a SQL syntax error, i.e. a 500 for what is
    // really bad input. This is caught up front instead.
    test("a repeated parameter is a 400 that names the parameter", async () => {
      const res = await request(app).get(
        "/api/properties?city=Portland&city=Seattle",
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "city must be provided at most once" });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("the repeated-parameter check covers limit too", async () => {
      const res = await request(app).get("/api/properties?limit=5&limit=10");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "limit must be provided at most once" });
    });
  });

  test("a database failure is a 500 that does not leak the error", async () => {
    pool.query.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:3307"));

    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(500);
    // The generic message is deliberate: connection strings, ports and table
    // names are not the client's business.
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});

describe("GET /api/properties/:id", () => {
  test("returns the whole record for a listing that exists", async () => {
    const fullRow = { ...listingRow, L_Remarks: "Charming bungalow." };
    pool.query.mockResolvedValueOnce([[fullRow]]);

    const res = await request(app).get("/api/properties/24001234");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fullRow);
    // Parameterised, and capped at one row.
    const { sql, values } = lastQuery();
    expect(sql).toContain("WHERE L_ListingID = ? LIMIT 1");
    expect(values).toEqual(["24001234"]);
  });

  test("404s when no row matches", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get("/api/properties/99999999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "No property found with listing id 99999999",
    });
  });

  // A non-numeric id is bad input, not a missing row, so it is a 400 and it
  // never reaches the database.
  test.each([
    ["abc", "id must be a numeric listing id"],
    ["12a", "id must be a numeric listing id"],
    ["-1", "id must be a numeric listing id"],
    ["1.5", "id must be a numeric listing id"],
    ["", "id must be a numeric listing id"],
  ])("400s on the invalid id %p", async (id, message) => {
    const res = await request(app).get(`/api/properties/${id || "%20"}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: message });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("400s on an id longer than 20 digits", async () => {
    const res = await request(app).get(`/api/properties/${"9".repeat(21)}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "id must be at most 20 digits" });
    expect(pool.query).not.toHaveBeenCalled();
  });

  // This route hands failures to next(err), so the response is produced by the
  // error middleware in app.js rather than by the route itself.
  test("a database failure reaches the error middleware as a 500", async () => {
    pool.query.mockRejectedValueOnce(new Error("Table doesn't exist"));

    const res = await request(app).get("/api/properties/24001234");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});

describe("GET /api/properties/:id/openhouses", () => {
  const openHouse = {
    id: 4021,
    L_ListingID: "24001234",
    OpenHouseDate: "2026-06-21",
    OH_StartTime: "13:00:00",
    OH_EndTime: "16:00:00",
    all_data: null,
  };

  test("returns the events for a listing that has them", async () => {
    pool.query
      .mockResolvedValueOnce([[{ L_ListingID: "24001234" }]]) // existence check
      .mockResolvedValueOnce([[openHouse]]);

    const res = await request(app).get("/api/properties/24001234/openhouses");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([openHouse]);
    // Date first, then time within the day, so the list reads chronologically.
    expect(lastQuery().sql).toContain("ORDER BY OpenHouseDate, OH_StartTime");
  });

  // KEY: an existing property with nothing scheduled is a 200 with an empty
  // array, not a 404. Nothing is missing -- there is simply nothing on. Making
  // it a 404 would force the frontend to treat "no open houses" as an error.
  test("a listing with nothing scheduled is a 200 and an empty array", async () => {
    pool.query
      .mockResolvedValueOnce([[{ L_ListingID: "24001234" }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get("/api/properties/24001234/openhouses");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // The existence check is what separates the two cases above and below. Drop
  // it and a typo'd listing id would look identical to a quiet weekend.
  test("404s when the property itself does not exist", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get("/api/properties/99999999/openhouses");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "No property found with listing id 99999999",
    });
    // Stopped after the existence check: the second query never ran.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("400s on an invalid id without touching the database", async () => {
    const res = await request(app).get("/api/properties/abc/openhouses");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "id must be a numeric listing id" });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("a database failure reaches the error middleware as a 500", async () => {
    pool.query.mockRejectedValueOnce(new Error("Lost connection"));

    const res = await request(app).get("/api/properties/24001234/openhouses");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
