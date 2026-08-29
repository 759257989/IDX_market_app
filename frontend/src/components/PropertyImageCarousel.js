import PropTypes from "prop-types";
import { useState } from "react";
import "./PropertyImageCarousel.css";

function PropertyImageCarousel({ photos, alt }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // No photos at all: show the same placeholder the card used before.
  if (photos.length === 0 || failed) {
    return <div className="carousel placeholder">No photo available</div>;
  }


  function stopClickFromNavigating(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  function showPrevious(event) {
    stopClickFromNavigating(event);
    setIndex((current) => (current - 1 + photos.length) % photos.length);
  }

  function showNext(event) {
    stopClickFromNavigating(event);
    setIndex((current) => (current + 1) % photos.length);
  }

  return (
    <div className="carousel">
      <img
        src={photos[index]}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="carousel-arrow prev"
            aria-label="Previous photo"
            onClick={showPrevious}
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow next"
            aria-label="Next photo"
            onClick={showNext}
          >
            ›
          </button>
          <span className="carousel-counter">
            {index + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}

PropertyImageCarousel.propTypes = {
  // Always an array -- getPhotoUrls returns [] rather than null when a listing
  // has no usable photos, so the component never has to guard for undefined.
  photos: PropTypes.arrayOf(PropTypes.string).isRequired,
  alt: PropTypes.string.isRequired,
};

export default PropertyImageCarousel;