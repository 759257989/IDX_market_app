import { render, screen, fireEvent } from "@testing-library/react";
import PropertyFilters from "./PropertyFilters";

// A blank filter object to feed the controlled inputs.
const EMPTY = { city: "", zipcode: "", minPrice: "", maxPrice: "", beds: "", baths: "" };

function renderFilters(overrides = {}) {
  const props = {
    values: EMPTY,
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    onClear: jest.fn(),
    ...overrides,
  };
  render(<PropertyFilters {...props} />);
  return props; // so the test can assert on the mocks
}

test("renders all six filter inputs", () => {
  renderFilters();

  // Queried by label, 
  expect(screen.getByLabelText("City")).toBeInTheDocument();
  expect(screen.getByLabelText("ZIP code")).toBeInTheDocument();
  expect(screen.getByLabelText("Min price")).toBeInTheDocument();
  expect(screen.getByLabelText("Max price")).toBeInTheDocument();
  expect(screen.getByLabelText("Beds")).toBeInTheDocument();
  expect(screen.getByLabelText("Baths")).toBeInTheDocument();
});

test("typing in a field reports that field's name and value upward", () => {
  const { onChange } = renderFilters();

  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Portland" } });
  expect(onChange).toHaveBeenCalledWith("city", "Portland");
});

test("submitting the form calls onSubmit", () => {
  const { onSubmit } = renderFilters();

  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(onSubmit).toHaveBeenCalledTimes(1);
});

// The counts are exact matches, so the labels must NOT say "3+". The only
// open-ended choice is "5+", which the API turns into minBeds/minBaths.
test("Beds offers exact counts 1-4 plus an open-ended 5+", () => {
  renderFilters();

  const options = Array.from(screen.getByLabelText("Beds").options);

  expect(options.map((o) => o.textContent)).toEqual(["Beds (any)", "1", "2", "3", "4", "5+"]);
  expect(options.map((o) => o.value)).toEqual(["", "1", "2", "3", "4", "5+"]);
});

test("Baths offers exact counts 1-4 plus an open-ended 5+", () => {
  renderFilters();

  const options = Array.from(screen.getByLabelText("Baths").options);

  expect(options.map((o) => o.textContent)).toEqual(["Baths (any)", "1", "2", "3", "4", "5+"]);
  expect(options.map((o) => o.value)).toEqual(["", "1", "2", "3", "4", "5+"]);
});

test("clicking Clear Filters calls onClear and does not submit", () => {
  const { onClear, onSubmit } = renderFilters();

  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));

  expect(onClear).toHaveBeenCalledTimes(1);
  // Proves the type="button" attribute is doing its job.
  expect(onSubmit).not.toHaveBeenCalled();
});