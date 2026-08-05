import { getPageItems, ELLIPSIS } from "../utils/pagination";
import "./Pagination.css";

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);

  return (
    <nav className="pagination" aria-label="Property list pages">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1} // no previous page to go to
      >
        Previous
      </button>

      {items.map((item, index) =>
        item === ELLIPSIS ? (
          <span
            key={`gap-${index}`}
            className="pagination-gap"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            type="button"
            key={item}
            onClick={() => onPageChange(item)}
            className={item === currentPage ? "is-current" : ""}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages} // already on the last page
      >
        Next
      </button>
    </nav>
  );
}

export default Pagination;
