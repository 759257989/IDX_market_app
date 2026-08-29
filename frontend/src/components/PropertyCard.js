import PropTypes from "prop-types";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { getPhotoUrls } from "../utils/photos";
import PropertyImageCarousel from "./PropertyImageCarousel";
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
  const navigate = useNavigate();
  const location = useLocation();
  const photos = getPhotoUrls(property.L_Photos);
  const detailPath = `/property/${property.L_ListingID}`;
  const cityState = [property.L_City, property.L_State].filter(Boolean).join(", ");

  // Hand the detail page the exact search the user came from, so its back link
  // can restore the filters and page instead of dumping them on an empty list.
  const backState = { from: location.search };

  return (
    <article
      className="card"
      onClick={() => navigate(detailPath, { state: backState })}
    >
      <PropertyImageCarousel
        photos={photos}
        alt={property.L_Address || "Property photo"}
      />

      <div className="card-body">
        <p className="card-price">{formatPrice(property.price)}</p>
        <Link
          to={detailPath}
          state={backState}
          className="card-address"
          onClick={(event) => event.stopPropagation()}
        >
          {property.L_Address || "Address unavailable"}
        </Link>

        <p className="card-location">{cityState}</p>

        <ul className="card-specs">
          <li><strong>{formatNumber(property.beds)}</strong> bd</li>
          <li><strong>{formatNumber(property.baths)}</strong> ba</li>
          <li><strong>{property.sqft ? formatNumber(property.sqft) : "—"}</strong> sqft</li>
        </ul>
      </div>
    </article>
  );

}

PropertyCard.propTypes = {
  property: PropTypes.shape({
    L_ListingID: PropTypes.string.isRequired,

    // Everything below is optional
    L_Address: PropTypes.string,
    L_City: PropTypes.string,
    L_State: PropTypes.string,
    L_Photos: PropTypes.string,

    // Numbers as MySQL returns them. baths is DECIMAL(4,1)
    price: PropTypes.number,
    beds: PropTypes.number,
    baths: PropTypes.number,
    sqft: PropTypes.number,
  }).isRequired,
};

export default PropertyCard;