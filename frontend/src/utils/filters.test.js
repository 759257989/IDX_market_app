import { removeEmptyValues, toQueryParams } from "./filters";

describe("removeEmptyValues", () => {
  test("drops empty-string fields", () => {
    expect(removeEmptyValues({ city: "Portland", zipcode: "" }))
      .toEqual({ city: "Portland" });
  });

  test("drops whitespace-only, null and undefined fields", () => {
    expect(
      removeEmptyValues({ city: "   ", beds: null, baths: undefined, minPrice: "300000" })
    ).toEqual({ minPrice: "300000" });
  });

  test("trims surrounding whitespace on kept values", () => {
    expect(removeEmptyValues({ city: "  Salem  " })).toEqual({ city: "Salem" });
  });

  // Guards against the classic `if (!value)` mistake: 0 is falsy but valid.
  test("keeps a numeric zero", () => {
    expect(removeEmptyValues({ offset: 0 })).toEqual({ offset: 0 });
  });
});

describe("toQueryParams", () => {
  test("sends a plain bed/bath choice as the exact-match param", () => {
    expect(toQueryParams({ beds: "3", baths: "2" }))
      .toEqual({ beds: "3", baths: "2" });
  });

  test("turns the beds '5+' choice into the minBeds param", () => {
    expect(toQueryParams({ beds: "5+" })).toEqual({ minBeds: "5" });
  });

  test("turns the baths '5+' choice into the minBaths param", () => {
    expect(toQueryParams({ baths: "5+" })).toEqual({ minBaths: "5" });
  });

  test("still drops the fields the user left blank", () => {
    expect(toQueryParams({ city: "  Salem ", beds: "", baths: "   " }))
      .toEqual({ city: "Salem" });
  });
});