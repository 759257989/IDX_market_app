import PropTypes from "prop-types";
import "./PropertyFilters.css";

// Bedroom / bathroom choices. 1-4 are exact counts ("3" means exactly 3);
// "5+" is the one open-ended choice, so 5-and-up listings stay reachable.
// An empty value means "no filter at all". Beds and baths offer the same set.
const COUNT_OPTIONS = ["1", "2", "3", "4", "5+"];

function PropertyFilters({ values, onChange, onSubmit, onClear }) {
  // One handler for every input. 
  function handleChange(event) {
    const { name, value } = event.target;
    onChange(name, value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="filters" onSubmit={handleSubmit}>
      <input
        name="city"
        aria-label="City"
        placeholder="City"
        value={values.city}
        onChange={handleChange}
      />
      <input
        name="zipcode"
        aria-label="ZIP code"
        placeholder="ZIP code"
        value={values.zipcode}
        onChange={handleChange}
      />
      <input
        name="minPrice"
        aria-label="Min price"
        type="number"
        placeholder="Min price"
        value={values.minPrice}
        onChange={handleChange}
      />
      <input
        name="maxPrice"
        aria-label="Max price"
        type="number"
        placeholder="Max price"
        value={values.maxPrice}
        onChange={handleChange}
      />

      <select name="beds" aria-label="Beds" value={values.beds} onChange={handleChange}>
        <option value="">Beds (any)</option>
        {COUNT_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <select name="baths" aria-label="Baths" value={values.baths} onChange={handleChange}>
        <option value="">Baths (any)</option>
        {COUNT_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <button type="submit">Search</button>
      
      <button type="button" onClick={onClear}>Clear Filters</button>
    </form>
  );
}

PropertyFilters.propTypes = {
  // Every field is required and must be a string -- these drive controlled
  // inputs, and a value that goes undefined flips the input to uncontrolled,
  // which React warns about at runtime.
  values: PropTypes.shape({
    city: PropTypes.string.isRequired,
    zipcode: PropTypes.string.isRequired,
    minPrice: PropTypes.string.isRequired,
    maxPrice: PropTypes.string.isRequired,
    beds: PropTypes.string.isRequired,
    baths: PropTypes.string.isRequired,
  }).isRequired,
  // A missing handler leaves the control silently dead, so each one is
  // required rather than defaulted to a no-op.
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default PropertyFilters;