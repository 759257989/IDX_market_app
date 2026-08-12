// Every field starts as "".
export const EMPTY_FILTERS = {
  city: "",
  zipcode: "",
  minPrice: "",
  maxPrice: "",
  beds: "",
  baths: "",
};

// Filters live in the URL rather than in component state so they survive the
// round trip to a property page and back -- ListingsPage unmounts on the way
// out, which would otherwise take the whole search with it.
export function filtersFromSearchParams(searchParams) {
  const filters = { ...EMPTY_FILTERS };

  for (const field of Object.keys(EMPTY_FILTERS)) {
    const value = searchParams.get(field);
    if (value !== null) filters[field] = value;
  }

  return filters;
}

export function pageFromSearchParams(searchParams) {
  const page = Number(searchParams.get("page"));
  // Guards a hand-edited "?page=abc" or "?page=-3" back to a sane first page.
  return Number.isInteger(page) && page > 0 ? page : 1;
}

// The URL carries the form's own values (beds "5+" stays "5+"); the translation
// to the API's minBeds/minBaths happens later, in toQueryParams.
export function filtersToSearchParams(filters, page = 1) {
  const params = new URLSearchParams(removeEmptyValues(filters));
  // Page 1 is the default, so leaving it out keeps a plain search URL clean.
  if (page > 1) params.set("page", String(page));
  return params;
}

// drop any key whose value is empty, null, or undefined.
export function removeEmptyValues(filters) {
  const cleaned = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;

    // trim first, so a field containing only spaces counts as empty.
    if (typeof value === "string" && value.trim() === "") continue;

    cleaned[key] = typeof value === "string" ? value.trim() : value;
  }

  return cleaned;
}

// The bed/bath dropdowns are exact matches ("3" means exactly 3), except for
// the open-ended "5+" choice. The API keeps those two meanings in separate
// params, so "5+" moves from beds -> minBeds (and baths -> minBaths).
const MIN_PARAM_FOR = { beds: "minBeds", baths: "minBaths" };

// Turns the filter form's values into the query params the API expects.
export function toQueryParams(filters) {
  const params = removeEmptyValues(filters);

  for (const [field, minParam] of Object.entries(MIN_PARAM_FOR)) {
    const value = params[field];
    if (typeof value === "string" && value.endsWith("+")) {
      delete params[field];
      params[minParam] = value.slice(0, -1); // "5+" -> "5"
    }
  }

  return params;
}
