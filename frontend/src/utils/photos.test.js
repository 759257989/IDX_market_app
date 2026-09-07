import { getFirstPhotoUrl, getPhotoUrls } from "./photos";

// L_Photos is a longtext column holding a JSON array as a STRING. The values
// below are the shapes that actually occur in the feed, not invented ones:
// 381 rows store an empty string, and the column is nullable on top of that.
const validJson = '["https://example.com/1.jpg","https://example.com/2.jpg"]';

describe("getPhotoUrls", () => {
  test("returns every usable url from a well-formed array", () => {
    expect(getPhotoUrls(validJson)).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });

  // KEY: JSON.parse("") throws. Without this guard, the 381 rows with an empty
  // L_Photos would each take down the whole grid they appear in.
  test.each([
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("returns an empty array for %s", (_label, input) => {
    expect(getPhotoUrls(input)).toEqual([]);
  });

  test("returns an empty array for malformed JSON instead of throwing", () => {
    expect(getPhotoUrls("[not json")).toEqual([]);
    expect(getPhotoUrls('["truncated"')).toEqual([]);
  });

  // Valid JSON of the wrong shape is still unusable.
  test("returns an empty array when the JSON is not an array", () => {
    expect(getPhotoUrls('{"url":"https://example.com/1.jpg"}')).toEqual([]);
    expect(getPhotoUrls("42")).toEqual([]);
    expect(getPhotoUrls("null")).toEqual([]);
  });

  // Filter rather than reject: one junk entry must not cost the other photos.
  test("drops junk entries but keeps the good ones", () => {
    expect(getPhotoUrls('["https://example.com/1.jpg",null,"",42,"  "]')).toEqual([
      "https://example.com/1.jpg",
    ]);
  });

  test("an array of nothing usable comes back empty", () => {
    expect(getPhotoUrls('[null,"",42]')).toEqual([]);
  });
});

describe("getFirstPhotoUrl", () => {
  test("returns the first url", () => {
    expect(getFirstPhotoUrl(validJson)).toBe("https://example.com/1.jpg");
  });

  test.each([
    ["an empty string", ""],
    ["null", null],
    ["malformed JSON", "[not json"],
    ["an empty array", "[]"],
    ["a non-array", '{"a":1}'],
  ])("returns null for %s", (_label, input) => {
    expect(getFirstPhotoUrl(input)).toBeNull();
  });

  // Unlike getPhotoUrls this does not search past the first element: if the
  // first entry is junk the caller gets null rather than a surprise photo 2.
  test("returns null when the first entry is not a usable url", () => {
    expect(getFirstPhotoUrl('[null,"https://example.com/2.jpg"]')).toBeNull();
    expect(getFirstPhotoUrl('["   ","https://example.com/2.jpg"]')).toBeNull();
    expect(getFirstPhotoUrl('[42,"https://example.com/2.jpg"]')).toBeNull();
  });
});
