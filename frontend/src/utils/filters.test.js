import {
  removeEmptyValues,
  toQueryParams,
  filtersFromSearchParams,
  filtersToSearchParams,
  pageFromSearchParams,
  EMPTY_FILTERS,
} from "./filters";

describe("filtersFromSearchParams", () => {
  test("reads the filter fields out of the URL", () => {
    const params = new URLSearchParams("city=Concord&beds=2&page=3");
    expect(filtersFromSearchParams(params)).toEqual({
      ...EMPTY_FILTERS,
      city: "Concord",
      beds: "2",
    });
  });

  test("returns all-empty filters for a bare URL", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });
});

describe("pageFromSearchParams", () => {
  test("reads the page number", () => {
    expect(pageFromSearchParams(new URLSearchParams("page=4"))).toBe(4);
  });

  test("defaults to the first page when absent", () => {
    expect(pageFromSearchParams(new URLSearchParams())).toBe(1);
  });

  // A hand-edited or stale URL should not put the list into a broken state.
  test.each(["page=abc", "page=-3", "page=0", "page=1.5"])(
    "falls back to page 1 for ?%s",
    (query) => {
      expect(pageFromSearchParams(new URLSearchParams(query))).toBe(1);
    }
  );
});

describe("filtersToSearchParams", () => {
  test("keeps only the filled-in fields", () => {
    const params = filtersToSearchParams({ ...EMPTY_FILTERS, city: "Concord", beds: "2" });
    expect(params.toString()).toBe("city=Concord&beds=2");
  });

  test("omits page 1 so a fresh search has a clean URL", () => {
    expect(filtersToSearchParams({ ...EMPTY_FILTERS, city: "Madera" }, 1).toString())
      .toBe("city=Madera");
  });

  test("carries a later page so it survives the trip to a property", () => {
    expect(filtersToSearchParams({ ...EMPTY_FILTERS, city: "Madera" }, 3).toString())
      .toBe("city=Madera&page=3");
  });

  // The round trip is what actually keeps a search alive across navigation.
  test("survives a round trip through the URL", () => {
    const original = { ...EMPTY_FILTERS, city: "Palm Desert", zipcode: "92211", beds: "5+" };
    const restored = filtersFromSearchParams(filtersToSearchParams(original, 2));
    expect(restored).toEqual(original);
    expect(pageFromSearchParams(filtersToSearchParams(original, 2))).toBe(2);
  });
});

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