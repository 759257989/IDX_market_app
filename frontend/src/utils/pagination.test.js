import { getPageItems, ELLIPSIS } from "./pagination";

// Render an item list as a readable string so failures are easy to eyeball:
// [1, ELLIPSIS, 4, 5] -> "1 ... 4 5"
const show = (items) => items.map((i) => (i === ELLIPSIS ? "..." : i)).join(" ");

describe("getPageItems: the four shapes", () => {
  test("shows every page when they all fit", () => {
    expect(show(getPageItems(2, 5))).toBe("1 2 3 4 5");
  });

  test("still no ellipsis at exactly seven pages", () => {
    expect(show(getPageItems(4, 7))).toBe("1 2 3 4 5 6 7");
  });

  test("near the start: gap on the right only", () => {
    expect(show(getPageItems(1, 24))).toBe("1 2 3 4 5 ... 24");
  });

  test("near the end: gap on the left only", () => {
    expect(show(getPageItems(24, 24))).toBe("1 ... 20 21 22 23 24");
  });

  test("in the middle: gaps on both sides", () => {
    expect(show(getPageItems(5, 24))).toBe("1 ... 4 5 6 ... 24");
  });

  test("a gap that would hide a single page shows that page instead", () => {
    // The left gap would cover only page 2, and "..." is no narrower than "2".
    expect(show(getPageItems(4, 24))).toBe("1 2 3 4 5 ... 24");
  });
});

describe("getPageItems: edge cases", () => {
  test("a single page returns just that page", () => {
    expect(getPageItems(1, 1)).toEqual([1]);
  });

  test("zero pages returns an empty list", () => {
    expect(getPageItems(1, 0)).toEqual([]);
  });

  test("an out-of-range current page is clamped, not crashed", () => {
    expect(show(getPageItems(99, 5))).toBe("1 2 3 4 5");
  });
});

// KEY: the exhaustive sweep. Instead of guessing which combinations might
// break, assert the rules that must hold for EVERY combination. This is what
// catches the duplicate-page bug -- and any future one like it.
describe("getPageItems: invariants across every page/total combination", () => {
  // Collect every violation, then assert the list is empty. A bare expect()
  // inside the loop would stop at the first failure and, worse, would not say
  // WHICH combination broke -- Jest's expect takes no description argument.
  // Reporting the whole list makes a failure immediately diagnosable.
  test("holds for all totals up to 60", () => {
    const violations = [];

    for (let totalPages = 1; totalPages <= 60; totalPages++) {
      for (let page = 1; page <= totalPages; page++) {
        const items = getPageItems(page, totalPages);
        const numbers = items.filter((item) => item !== ELLIPSIS);
        const where = `page ${page} of ${totalPages} -> ${show(items)}`;

        // No page number may appear twice (the Debug Challenge bug).
        if (new Set(numbers).size !== numbers.length) {
          violations.push(`duplicate page: ${where}`);
        }
        // Page numbers must ascend.
        const ascending = [...numbers].sort((a, b) => a - b);
        if (ascending.join() !== numbers.join()) {
          violations.push(`out of order: ${where}`);
        }
        // First, last and current must always be reachable.
        if (!numbers.includes(1)) violations.push(`missing first: ${where}`);
        if (!numbers.includes(totalPages)) violations.push(`missing last: ${where}`);
        if (!numbers.includes(page)) violations.push(`missing current: ${where}`);
      }
    }

    expect(violations).toEqual([]);
  });
});