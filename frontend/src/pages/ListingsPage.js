import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
import { toQueryParams } from "../utils/filters";
import PropertyFilters from "../components/PropertyFilters";
import PropertyCard from "../components/PropertyCard";
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
  // KEY: two separate pieces of filter state.
  // draft   = what the user is currently typing (changes on every keystroke)
  // applied = what is actually in effect (changes only on Search / Clear)
  // Only `applied` is in the effect's dependency array
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    // Empty fields are stripped never hit the API, and a "5+" bed/bath
    // choice becomes the minBeds/minBaths param.
    const params = {
      ...toQueryParams(appliedFilters),
      limit: PAGE_SIZE,
      offset: 0,
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
  }, [appliedFilters]); // re-fetch whenever the APPLIED filters change

  // Update one field of the draft. The spread keeps the other five untouched.
  function handleFilterChange(name, value) {
    setDraftFilters((previous) => ({ ...previous, [name]: value }));
  }

  // Promote the draft to applied -> the effect above re-runs and fetches.
  function handleSearch() {
    setAppliedFilters(draftFilters);
  }

  // Reset BOTH: the form the user sees, and the filters in effect.
  function handleClear() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  return (
    <section>
      <PropertyFilters
        values={draftFilters}
        onChange={handleFilterChange}
        onSubmit={handleSearch}
        onClear={handleClear}
      />

      {status === "loading" && <p className="state">Loading properties…</p>}

      {status === "error" && (
        <p className="state state-error">
          Could not load properties — {errorMessage}
        </p>
      )}

      {/* a helpful message when nothing matches. */}
      {status === "ready" && data.results.length === 0 && (
        <p className="state">
          No properties match your filters. Try widening your search.
        </p>
      )}

      {status === "ready" && data.results.length > 0 && (
        <>
          <p className="count">
            Showing {data.results.length} of {data.total} properties
          </p>
          <div className="grid">
            {data.results.map((property) => (
              <PropertyCard key={property.L_ListingID} property={property} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default ListingsPage;
