import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
import {
  filtersFromSearchParams,
  pageFromSearchParams,
  removeEmptyValues,
  sortFromSearchParams,
  toQueryParams,
} from "../utils/filters";

// Owns the whole fetch lifecycle for a property search: the request state, the
// response, and the stale-response guard. Keeping it here leaves ListingsPage
// doing only what a page should -- read the URL, and decide what to render.
//
// KEY: the only inputs are the URL query string and the page size, both
// primitives. Everything the request needs is derived from them INSIDE the
// effect, so the dependency list stays comparable by value. Accepting a
// pre-built params object instead would mean depending on a value that is a
// new object on every render: either an endless refetch loop, or an
// exhaustive-deps warning silenced with a disable comment. Deriving the params
// inside removes the problem rather than suppressing it.
export function useProperties(searchKey, pageSize) {
  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Stale-response guard: each effect run gets its own flag, and the cleanup
    // flips the previous run's copy. A slow earlier request can still resolve,
    // but it can no longer write its results over a newer search.
    let cancelled = false;
    setStatus("loading");

    const params = new URLSearchParams(searchKey);

    const requestParams = {
      // Blank fields never reach the API, and a "5+" bed/bath choice becomes
      // the minBeds/minBaths param.
      ...toQueryParams(filtersFromSearchParams(params)),
      // An unsorted page must send no sort params at all: the API rejects a
      // bare sortOrder, and an empty sortBy is not one of its allowed columns.
      ...removeEmptyValues(sortFromSearchParams(params)),
      limit: pageSize,
      offset: (pageFromSearchParams(params) - 1) * pageSize,
    };

    fetchProperties(requestParams)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [searchKey, pageSize]);

  return { status, data, errorMessage };
}
