import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
import { toQueryParams } from "../utils/filters";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
import Pagination from "../components/Pagination";
import "./ListingsPage.css";

const PAGE_SIZE = 20;

// Every field starts as "" 
const EMPTY_FILTERS = {
  city: "",
  zipcode: "",
  minPrice: "",
  maxPrice: "",
  beds: "",
  baths: "",
};

function ListingsPage() {
  // draft   = what the user is currently typing (changes on every keystroke)
  // applied = what is actually in effect (changes only on Search / Clear)
  // Only `applied` is in the effect's dependency array
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    // Empty fields are stripped never hit the API, and a "5+" bed/bath
    // choice becomes the minBeds/minBaths param.
    const params = {
      ...toQueryParams(appliedFilters),
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    };

    fetchProperties(params)
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
  }, [appliedFilters, currentPage]); // re-fetch on new filters OR a new page

  // Update one field of the draft. The spread keeps the other five untouched.
  function handleFilterChange(name, value) {
    setDraftFilters((previous) => ({ ...previous, [name]: value }));
  }

  // Promote the draft to applied -> the effect above re-runs and fetches.
  function handleSearch() {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
  }

  // Reset BOTH: the form the user sees, and the filters in effect.
  function handleClear() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }

  function handlePageChange(nextPage) {
    setCurrentPage(nextPage);
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
