import PropTypes from "prop-types";
import "./PropertySort.css";

const SORT_OPTIONS = [
  { value: "", label: "Sort: Default" },
  { value: "price:asc", label: "Price: Low to High" },
  { value: "price:desc", label: "Price: High to Low" },
  { value: "dateListed:desc", label: "Newest First" },
  { value: "dateListed:asc", label: "Oldest First" },
  { value: "sqft:desc", label: "Largest First" },
  { value: "beds:desc", label: "Most Bedrooms" },
];

function PropertySort({ value, onChange }) {
  function handleChange(event) {
    const [sortBy = "", sortOrder = ""] = event.target.value.split(":");
    onChange({ sortBy, sortOrder });
  }

  // Rebuild the combined value from the two separate props.
  const current = value.sortBy ? `${value.sortBy}:${value.sortOrder}` : "";

  return (
    <label className="sort">
      <span className="sort-label">Sort</span>
      <select aria-label="Sort properties" value={current} onChange={handleChange}>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

PropertySort.propTypes = {
  // Both halves are always present as strings; "" means "no sort applied".
  value: PropTypes.shape({
    sortBy: PropTypes.string.isRequired,
    sortOrder: PropTypes.string.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default PropertySort;