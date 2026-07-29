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
