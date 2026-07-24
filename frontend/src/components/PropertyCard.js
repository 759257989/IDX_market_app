import { useState } from "react";
import { getFirstPhotoUrl } from "../utils/photos";
import "./PropertyCard.css";

// Beds/baths/sqft can be NULL in the data. Show an em dash instead of "null"
// or a misleading "0". (In your data: 101 null beds, 17 null baths, 84 null sqft.)
function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US"); // adds thousands separators: 7130 -> "7,130"
}

// Price is always present in the data, but guard anyway -- a card should never
// print the word "null" at the user.
function formatPrice(price) {
  if (price === null || price === undefined) return "Price unavailable";
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0, // $3,950,000 not $3,950,000.00
  });
}

function PropertyCard({ property }) {
  const photoUrl = getFirstPhotoUrl(property.L_Photos);

  const [imageFailed, setImageFailed] = useState(false);
  const showImage = photoUrl && !imageFailed;

  const cityState = [property.L_City, property.L_State].filter(Boolean).join(", ");

  return (
    <article className="card">
      <div className="card-photo">
        {showImage ? (
          <img
            src={photoUrl}
            alt={property.L_Address || "Property photo"}
            loading="lazy" // don't download off-screen images until scrolled to
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="card-photo placeholder">No photo available</div>
        )}
      </div>

      <div className="card-body">
        <p className="card-price">{formatPrice(property.price)}</p>
        <p className="card-address">{property.L_Address || "Address unavailable"}</p>
        <p className="card-location">{cityState}</p>

        <ul className="card-specs">
          <li><strong>{formatNumber(property.beds)}</strong> bd</li>
          <li><strong>{formatNumber(property.baths)}</strong> ba</li>
          {/* sqft of 0 means "unknown" here, so treat 0 like null */}
          <li><strong>{property.sqft ? formatNumber(property.sqft) : "—"}</strong> sqft</li>
        </ul>
      </div>
    </article>
  );
}

export default PropertyCard;