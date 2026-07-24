import { useEffect, useState } from "react";
import { fetchProperties } from "../api/client";
import PropertyCard from "../components/PropertyCard";
import "./ListingsPage.css";

const PAGE_SIZE = 20;

function ListingsPage() {

  const [status, setStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [data, setData] = useState(null);          // { total, limit, offset, results }
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    fetchProperties({ limit: PAGE_SIZE, offset: 0 })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        // err.message is the human-readable string our API client threw.
        setErrorMessage(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true; // cleanup: runs if the component unmounts mid-request
    };
  }, []); // empty deps -> run once when the page first mounts

  // Requirement: loading state shows while fetching.
  if (status === "loading") {
    return <p className="state">Loading properties…</p>;
  }

  // error message shows if the backend is unreachable.
  if (status === "error") {
    return (
      <p className="state state-error">
        Could not load properties — {errorMessage}
      </p>
    );
  }

  // status === "ready"
  return (
    <section>
      {/* Requirement: "Showing 20 of 487 properties" */}
      <p className="count">
        Showing {data.results.length} of {data.total} properties
      </p>

      <div className="grid">
        {data.results.map((property) => (
          // key must be stable + unique; the listing id is perfect for it
          <PropertyCard key={property.L_ListingID} property={property} />
        ))}
      </div>
    </section>
  );
}

export default ListingsPage;