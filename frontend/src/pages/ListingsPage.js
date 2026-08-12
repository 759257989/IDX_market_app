import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProperties } from "../api/client";
import {
  EMPTY_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  pageFromSearchParams,
  toQueryParams,
} from "../utils/filters";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import Pagination from "../components/Pagination";
import "./ListingsPage.css";

const PAGE_SIZE = 20;

function ListingsPage() {
  // The applied search lives in the URL, not in state: returning from a
  // property page remounts this component, and anything held in useState
  // would come back empty. The URL survives that, plus reload and sharing.
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedFilters = filtersFromSearchParams(searchParams);
  const currentPage = pageFromSearchParams(searchParams);

  // draft = what the user is currently typing (changes on every keystroke).
  // Seeded from the URL so the form shows the search that is actually running.
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // A string, not the searchParams object: that object is a new instance on
  // every render, so depending on it directly would refetch forever.
  const searchKey = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    const params = new URLSearchParams(searchKey);

    // Empty fields are stripped never hit the API, and a "5+" bed/bath
    // choice becomes the minBeds/minBaths param.
    const requestParams = {
      ...toQueryParams(filtersFromSearchParams(params)),
      limit: PAGE_SIZE,
      offset: (pageFromSearchParams(params) - 1) * PAGE_SIZE,
    };

    fetchProperties(requestParams)
      .then((payload) => {
        if (cancelled) return; // a newer search has superseded this one
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
  }, [searchKey]); // re-fetch on new filters OR a new page

  // Update one field of the draft. The spread keeps the other five untouched.
  function handleFilterChange(name, value) {
    setDraftFilters((previous) => ({ ...previous, [name]: value }));
  }

  // Promote the draft into the URL -> the effect above re-runs and fetches.
  function handleSearch() {
    setSearchParams(filtersToSearchParams(draftFilters, 1));
  }

  // Reset BOTH: the form the user sees, and the filters in effect.
  function handleClear() {
    setDraftFilters(EMPTY_FILTERS);
    setSearchParams(new URLSearchParams());
  }

  function handlePageChange(nextPage) {
    setSearchParams(filtersToSearchParams(appliedFilters, nextPage));
    // jump back to the top so the new page starts at the first
    // card
    window.scrollTo(0, 0);
  }

  // Derived, not stored: recomputed from the latest response every render.
  // KEY: these come from the RESPONSE (data.offset), not from currentPage.
  // While a new page is in flight the rows on screen still belong to the
  // previous response, so a label built from currentPage would advertise
  // "221-240" above page 11's rows -- the very mismatch that made the original
  // paging bug so confusing. Reading the offset back off the payload keeps the
  // label and the rows structurally incapable of disagreeing.
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const firstShown = data ? data.offset + 1 : 0;
  const lastShown = data ? data.offset + data.results.length : 0;

  // What to show. Once we have results we keep them on screen through the next
  // fetch: swapping a full page of cards for a "Loading…" line would yank the
  // pagination control out from under the cursor that just clicked it.
  const showError = status === "error";
  const showFirstLoad = status === "loading" && !data;
  const showEmpty = !showError && data !== null && data.results.length === 0;
  const showResults = !showError && data !== null && data.results.length > 0;
  const isRefreshing = status === "loading" && data !== null;

  return (
    <section>
      <PropertyFilters
        values={draftFilters}
        onChange={handleFilterChange}
        onSubmit={handleSearch}
        onClear={handleClear}
      />

      {/* Only on the very first load, when there is nothing to preserve. */}
      {showFirstLoad && <p className="state">Loading properties…</p>}

      {showError && (
        <p className="state state-error">
          Could not load properties — {errorMessage}
        </p>
      )}

      {/* a helpful message when nothing matches. */}
      {showEmpty && (
        <p className="state">
          No properties match your filters. Try widening your search.
        </p>
      )}

      {showResults && (
        <div
          data-testid="results"
          className={isRefreshing ? "results is-refreshing" : "results"}
          // Tells a screen reader the region is updating instead of letting it
          // announce a half-swapped list as if it were final.
          aria-busy={isRefreshing}
        >
          <p className="count">
            Showing {firstShown}-{lastShown} of {data.total} properties
          </p>
          <div className="grid">
            {data.results.map((property) => (
              <PropertyCard key={property.L_ListingID} property={property} />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </section>
  );
}

export default ListingsPage;
