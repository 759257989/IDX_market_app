import { render, screen, fireEvent } from "@testing-library/react";
import PropertySort from "./PropertySort";

function renderSort(overrides = {}) {
  const props = {
    value: { sortBy: "", sortOrder: "" },
    onChange: jest.fn(),
    ...overrides,
  };
  render(<PropertySort {...props} />);
  return props;
}

test("offers the default option plus the six sorts", () => {
  renderSort();

  const options = Array.from(screen.getByLabelText("Sort properties").options);

  expect(options.map((o) => o.textContent)).toEqual([
    "Sort: Default",
    "Price: Low to High",
    "Price: High to Low",
    "Newest First",
    "Oldest First",
    "Largest First",
    "Most Bedrooms",
  ]);
});

// KEY: the dropdown holds one combined string ("price:desc") while the rest of
// the app keeps sortBy and sortOrder apart, because the API takes them as two
// query params. The split happens here, on the way up.
test("splits the combined option value into sortBy and sortOrder", () => {
  const { onChange } = renderSort();

  fireEvent.change(screen.getByLabelText("Sort properties"), {
    target: { value: "price:desc" },
  });

  expect(onChange).toHaveBeenCalledWith({ sortBy: "price", sortOrder: "desc" });
});

// Choosing Default has to clear BOTH halves. Leaving sortOrder behind would
// send ?sortOrder=desc with no sortBy, which the API rejects with a 400.
test("choosing Default clears both halves", () => {
  const { onChange } = renderSort({ value: { sortBy: "price", sortOrder: "desc" } });

  fireEvent.change(screen.getByLabelText("Sort properties"), {
    target: { value: "" },
  });

  expect(onChange).toHaveBeenCalledWith({ sortBy: "", sortOrder: "" });
});

// The applied sort lives in the URL, so on a fresh page load the dropdown has
// to rebuild its own value from the two props -- otherwise a shared link would
// show sorted results under a dropdown reading "Default".
test("rebuilds the selected option from the two props", () => {
  renderSort({ value: { sortBy: "dateListed", sortOrder: "desc" } });

  expect(screen.getByLabelText("Sort properties")).toHaveValue("dateListed:desc");
});

test("an empty sortBy selects the default option", () => {
  renderSort({ value: { sortBy: "", sortOrder: "" } });

  expect(screen.getByLabelText("Sort properties")).toHaveValue("");
});
