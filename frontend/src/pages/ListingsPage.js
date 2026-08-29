import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  EMPTY_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  pageFromSearchParams,
  sortFromSearchParams,
} from "../utils/filters";
import { useProperties } from "../hooks/useProperties";
import PropertyFilters from "../components/PropertyFilters";
import PropertySort from "../components/PropertySort";
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
  // Sort belongs in the URL for the same reason the filters do, and it is read
  // straight back out rather than mirrored into state -- one source of truth
  // means the dropdown can never disagree with the results underneath it.
  const appliedSort = sortFromSearchParams(searchParams);

  // draft = what the user is currently typing (changes on every keystroke).
  // Seeded from the URL so the form shows the search that is actually running.
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  // A string, not the searchParams object: that object is a new instance on
  // every render, so depending on it directly would refetch forever.
  const searchKey = searchParams.toString();

  // Fetching lives in the hook; this page only reacts to what it returns.
  const { status, data, errorMessage } = useProperties(searchKey, PAGE_SIZE);

  // Update one field of the draft. The spread keeps the other five untouched.
  function handleFilterChange(name, value) {
    setDraftFilters((previous) => ({ ...previous, [name]: value }));
  }

  // Promote the draft into the URL -> the effect above re-runs and fetches.
  // The sort rides along: it is a separate control from the form, so a new
  // search should not silently snap the dropdown back to Default.
  function handleSearch() {
    setSearchParams(filtersToSearchParams(draftFilters, 1, appliedSort));
  }

  // A new sort reorders the whole result set, so page 11 of the old order is
  // meaningless -- go back to page 1 rather than land the user mid-list.
  function handleSortChange(nextSort) {
    setSearchParams(filtersToSearchParams(appliedFilters, 1, nextSort));
  }

  // Reset BOTH: the form the user sees, and the filters in effect.
  function handleClear() {
    setDraftFilters(EMPTY_FILTERS);
    setSearchParams(new URLSearchParams());
  }

  function handlePageChange(nextPage) {
    setSearchParams(
      filtersToSearchParams(appliedFilters, nextPage, appliedSort),
    );
    // jump back to the top so the new page starts at the first
    // card
    window.scrollTo(0, 0);
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const firstShown = data ? data.offset + 1 : 0;
  const lastShown = data ? data.offset + data.results.length : 0;
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

      {/* Outside the form on purpose: picking a sort applies immediately,
          it does not wait for the Search button like the filters do. */}
      <PropertySort value={appliedSort} onChange={handleSortChange} />

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
