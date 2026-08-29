import PropTypes from "prop-types";
import { useState, useEffect, useRef } from "react";
import "./PropertyImageGallery.css";

function PropertyImageGallery({ photos, alt }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxRef = useRef(null);

  useEffect(() => {
    if (lightboxOpen && lightboxRef.current) {
      lightboxRef.current.focus();
    }
  }, [lightboxOpen]);

  if (photos.length === 0) {
    return <div className="gallery-placeholder">No photos available</div>;
  }

  const showPrevious = () =>
    setIndex((current) => (current - 1 + photos.length) % photos.length);
  const showNext = () => setIndex((current) => (current + 1) % photos.length);

  function handleLightboxKeyDown(event) {
    if (event.key === "Escape") setLightboxOpen(false);
    if (event.key === "ArrowLeft") showPrevious();
    if (event.key === "ArrowRight") showNext();
  }

  return (
    <div className="gallery">
      <button
        type="button"
        className="gallery-main"
        onClick={() => setLightboxOpen(true)}
        aria-label="Open photo in full screen"
      >
        <img src={photos[index]} alt={alt} />
        <span className="gallery-counter">
          {index + 1} / {photos.length}
        </span>
      </button>
      {photos.length > 1 && (
        <div className="gallery-thumbs">
          {photos.map((url, position) => (
            <button
              type="button"
              key={url}
              className={position === index ? "is-active" : ""}
              onClick={() => setIndex(position)}
              aria-label={`Show photo ${position + 1}`}
              aria-current={position === index ? "true" : undefined}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="lightbox"
          ref={lightboxRef}
          tabIndex={-1}
          onKeyDown={handleLightboxKeyDown}
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Property photo viewer"
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            ×
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-arrow prev"
              onClick={showPrevious}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          <img className="lightbox-image" src={photos[index]} alt={alt} />

          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-arrow next"
              onClick={showNext}
              aria-label="Next photo"
            >
              ›
            </button>
          )}

          <span className="lightbox-counter">
            {index + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}

PropertyImageGallery.propTypes = {
  photos: PropTypes.arrayOf(PropTypes.string).isRequired,
  alt: PropTypes.string.isRequired,
};

export default PropertyImageGallery;
