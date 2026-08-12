import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { fetchPropertyDetail, fetchOpenHouses } from "../api/client";
import { getPhotoUrls } from "../utils/photos";
import PropertyImageGallery from "../components/PropertyImageGallery";
import PropertyMap from "../components/PropertyMap";
import OpenHouseList from "../components/OpenHouseList";
import "./PropertyDetailPage.css";

function formatPrice(price) {
  if (price === null || price === undefined) return "Price unavailable";
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  if (value === null || value === undefined || value === 0) return "—";
  return value.toLocaleString("en-US");
}

// Years are identifiers, not quantities — they never take a thousands
// separator, so 1944 must not render as "1,944".
function formatYear(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return "—";
  return String(numeric);
}

// Lot size arrives from the feed as a decimal string ("6969600.00"), and
// String#toLocaleString hands that straight back ungrouped. Coerce to a number
// first so the separators land, keeping whatever precision the feed sent.
function formatLotSize(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return "—";
  const fraction = String(value).split(".")[1];
  const decimals = fraction ? Math.min(fraction.length, 2) : 0;
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function PropertyDetailPage() {
  // Reads the ":id" segment out of the URL defined in App.js.
  const { id } = useParams();
  const location = useLocation();

  // PropertyCard passes the listings search it was clicked from. A direct link
  // or a reload arrives without it, so fall back to the unfiltered list.
  const backTo = `/${location.state?.from || ""}`;
  const [status, setStatus] = useState("loading");
  const [property, setProperty] = useState(null);
  const [openHouses, setOpenHouses] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    Promise.all([fetchPropertyDetail(id), fetchOpenHouses(id)])
      .then(([propertyData, openHouseData]) => {
        if (cancelled) return;
        setProperty(propertyData);
        setOpenHouses(openHouseData);
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
  }, [id]);

  if (status === "loading") return <p className="state">Loading property…</p>;

  if (status === "error") {
    return (
      <div className="state state-error">
        <p>Could not load this property — {errorMessage}</p>
        <Link to={backTo} className="detail-back">Back to listings</Link>
      </div>
    );
  }

  const photos = getPhotoUrls(property.L_Photos);
  const cityStateZip = [
    [property.L_City, property.L_State].filter(Boolean).join(", "),
    property.L_Zip,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="detail">
      {/* Requirement: a way back to the listings page. */}
      <Link to={backTo} className="detail-back">← Back to listings</Link>

      <PropertyImageGallery
        photos={photos}
        alt={property.L_Address || "Property photo"}
      />

      <header className="detail-header">
        <p className="detail-price">{formatPrice(property.L_SystemPrice)}</p>
        <h2 className="detail-address">{property.L_Address || "Address unavailable"}</h2>
        <p className="detail-location">{cityStateZip}</p>
      </header>

      <ul className="detail-stats">
        <li><strong>{formatNumber(property.L_Keyword2)}</strong><span>Beds</span></li>
        <li><strong>{formatNumber(property.LM_Dec_3)}</strong><span>Baths</span></li>
        <li><strong>{formatNumber(property.LM_Int2_3)}</strong><span>Sq Ft</span></li>
        <li><strong>{formatYear(property.YearBuilt)}</strong><span>Year Built</span></li>
      </ul>

      {property.L_Remarks && (
        <section className="detail-description">
          <h2>Description</h2>
          <p>{property.L_Remarks}</p>
        </section>
      )}

      <section className="detail-facts">
        <h2>Property Details</h2>
        <dl>
          <div><dt>Listing ID</dt><dd>{property.L_ListingID}</dd></div>
          <div><dt>City</dt><dd>{property.L_City || "—"}</dd></div>
          <div><dt>State</dt><dd>{property.L_State || "—"}</dd></div>
          <div><dt>ZIP</dt><dd>{property.L_Zip || "—"}</dd></div>
          <div><dt>Year Built</dt><dd>{formatYear(property.YearBuilt)}</dd></div>
          <div><dt>Lot Size</dt><dd>{formatLotSize(property.LotSizeSquareFeet)} sqft</dd></div>
        </dl>
      </section>

      {/* Renders nothing at all when the listing has no coordinates. */}
      <PropertyMap
        latitude={property.LMD_MP_Latitude}
        longitude={property.LMD_MP_Longitude}
        address={property.L_Address}
      />

      <OpenHouseList openHouses={openHouses} />
    </article>
  );
}

export default PropertyDetailPage;