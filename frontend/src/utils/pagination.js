
export const ELLIPSIS = "ellipsis";

// How many pages to show on each side of the current one.
const SIBLING_COUNT = 1;

// Inclusive integer range: range(3, 6) -> [3, 4, 5, 6]
function range(start, end) {
  const pages = [];
  for (let page = start; page <= end; page++) pages.push(page);
  return pages;
}

function expandLonelyEllipsis(items) {
  return items.map((item, index) => {
    if (item !== ELLIPSIS) return item;

    const before = items[index - 1];
    const after = items[index + 1];
    return after - before === 2 ? before + 1 : item;
  });
}

export function getPageItems(currentPage, totalPages) {
  // Defensive: 0 results means 0 pages, and there is nothing to render.
  if (!Number.isInteger(totalPages) || totalPages < 1) return [];

  const page = Math.min(Math.max(currentPage, 1), totalPages);

  // Slots in a full row: first + last + current + siblings both sides + 2 gaps.
  const maxSlots = SIBLING_COUNT * 2 + 5; // 7
  if (totalPages <= maxSlots) {
    return range(1, totalPages); // everything fits, no gaps needed
  }

  // Is the current page far enough from an edge to need a gap on that side?
  const showLeftEllipsis = page - SIBLING_COUNT > 2;
  const showRightEllipsis = page + SIBLING_COUNT < totalPages - 1;

  // How many consecutive pages to show when we are hugging one edge.
  const edgeCount = SIBLING_COUNT * 2 + 3; // 5

  // Case A: near the start -> 1 2 3 4 5 ... 24
  if (!showLeftEllipsis && showRightEllipsis) {
    return expandLonelyEllipsis([...range(1, edgeCount), ELLIPSIS, totalPages]);
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return expandLonelyEllipsis([
      1,
      ELLIPSIS,
      ...range(totalPages - edgeCount + 1, totalPages),
    ]);
  }

  return expandLonelyEllipsis([
    1,
    ELLIPSIS,
    ...range(page - SIBLING_COUNT, page + SIBLING_COUNT),
    ELLIPSIS,
    totalPages,
  ]);
}