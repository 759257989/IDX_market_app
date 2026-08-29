import PropTypes from "prop-types";
import "./PropertyMap.css";

// Read once at module load. CRA replaces this at build time with the literal
// string from .env -- there is no process.env object in the browser.
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// 698 listings have no coordinates and 16 sit at 0,0 treated as
// "no location" 
function hasUsableCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function PropertyMap({ latitude, longitude, address }) {
  if (!hasUsableCoordinates(latitude, longitude)) return null;

  if (!API_KEY) {
    return (
      <p className="map-missing-key">
        Map unavailable: set REACT_APP_GOOGLE_MAPS_API_KEY in frontend/.env
        and restart the dev server.
      </p>
    );
  }

  const query = `${latitude},${longitude}`;
  const embedUrl =
    `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${query}&zoom=15`;
  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  return (
    <section className="map">
      <h2>Location</h2>

      <iframe
        title={`Map of ${address || "this property"}`} // screen readers need this
        src={embedUrl}
        loading="lazy"
        // Do not leak the full URL of our page to Google on the referrer.
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      <a
        className="map-directions"
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Get Directions
      </a>
    </section>
  );
}

PropertyMap.propTypes = {
  // MySQL DECIMAL columns arrive as strings through mysql2, and 698 listings
  // have no coordinates at all -- so these are optional and accept either type.
  // The component narrows them with Number() before using them.
  latitude: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  longitude: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  address: PropTypes.string,
};

export default PropertyMap;