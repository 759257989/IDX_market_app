import { fetchProperties, fetchPropertyDetail } from "./client";

// Build a fake Response
function fakeResponse({ ok = true, status = 200, body = {} }) {
  return { ok, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("fetchProperties", () => {
  test("success path: calls the right URL and returns parsed JSON", async () => {
    const payload = { total: 1, results: [{ L_ListingID: "1" }] };
    global.fetch.mockResolvedValue(fakeResponse({ body: payload }));

    const data = await fetchProperties({ city: "Portland", limit: 20 });

    // Assert on the URL: this is how we prove the query string is built right.
    expect(global.fetch).toHaveBeenCalledWith("/api/properties?city=Portland&limit=20");
    expect(data).toEqual(payload);
  });

  test("error path: a non-2xx response throws with status and backend message", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ ok: false, status: 400, body: { error: "limit must be >= 1" } })
    );

    await expect(fetchProperties({ limit: 0 })).rejects.toThrow(
      "Request failed (400): limit must be >= 1"
    );
  });

  test("error path: a network failure throws a friendly message", async () => {
    // fetch itself rejecting = server unreachable / DNS / connection refused.
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchProperties()).rejects.toThrow("Cannot reach the server");
  });
});

describe("fetchPropertyDetail", () => {
  test("requests the property by id", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ body: { L_ListingID: "42" } }));

    await fetchPropertyDetail("42");

    expect(global.fetch).toHaveBeenCalledWith("/api/properties/42");
  });
});
