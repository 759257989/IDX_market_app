import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ListingsPage from "./ListingsPage";
import { fetchProperties } from "../api/client";

jest.mock("../api/client");

const TOTAL = 2748;

// A distinct listing per offset, so we can tell one page's rows from another's.
function pageOfResults(offset) {
  return Array.from({ length: 20 }, (_, i) => ({
    L_ListingID: String(1000000000 + offset + i),
    L_Address: `${offset + i} Test St`,
    L_City: "Portland",
    L_State: "OR",
    price: 500000,
    beds: 4,
    baths: 2,
    sqft: 1800,
    L_Photos: null,
  }));
}

beforeEach(() => {
  // jsdom has no real scrollTo; the page calls it on every page change.
  window.scrollTo = jest.fn();

  fetchProperties.mockReset();
  fetchProperties.mockImplementation(({ offset = 0, limit = 20 }) =>
    Promise.resolve({ total: TOTAL, limit, offset, results: pageOfResults(offset) }),
  );
});

test("clicking Next requests the next page from the API", async () => {
  render(<ListingsPage />);
  await screen.findByText(/Showing 1-20 of 2748 properties/);

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  await waitFor(() =>
    expect(fetchProperties).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 20 }),
    ),
  );
});

test("page 2 renders different listings than page 1", async () => {
  render(<ListingsPage />);
  await screen.findByText(/Showing 1-20 of 2748 properties/);
  expect(screen.getByText("0 Test St")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByText(/Showing 21-40 of 2748 properties/);
  expect(screen.getByText("20 Test St")).toBeInTheDocument();
  expect(screen.queryByText("0 Test St")).not.toBeInTheDocument();
});

test("jumping to a far page requests the matching offset", async () => {
  render(<ListingsPage />);
  await screen.findByText(/Showing 1-20 of 2748 properties/);

  // Page 12 is what the reported bug used: "Showing 221-240 of 2748".
  fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> 2
  await screen.findByText(/Showing 21-40 of 2748 properties/);
  fireEvent.click(screen.getByRole("button", { name: "3" })); // -> 3

  await waitFor(() =>
    expect(fetchProperties).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 40 }),
    ),
  );
});

// A promise whose resolution we control, so we can inspect the page mid-fetch.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const payloadFor = (offset) => ({
  total: TOTAL,
  limit: 20,
  offset,
  results: pageOfResults(offset),
});

describe("while the next page is loading", () => {
  test("the current results and the pager stay on screen", async () => {
    render(<ListingsPage />);
    await screen.findByText(/Showing 1-20 of 2748 properties/);

    const pending = deferred();
    fetchProperties.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Mid-flight: the user must not be dropped onto a bare "Loading…" screen.
    expect(
      screen.getByRole("navigation", { name: /property list pages/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 Test St")).toBeInTheDocument();

    await act(async () => pending.resolve(payloadFor(20)));
    await screen.findByText(/Showing 21-40 of 2748 properties/);
  });

  test("the count keeps describing the rows actually visible", async () => {
    render(<ListingsPage />);
    await screen.findByText(/Showing 1-20 of 2748 properties/);

    const pending = deferred();
    fetchProperties.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // The rows on screen are still page 1's, so the label must still say 1-20.
    // Saying "21-40" over page-1 rows is the original reported bug.
    expect(
      screen.getByText(/Showing 1-20 of 2748 properties/),
    ).toBeInTheDocument();

    await act(async () => pending.resolve(payloadFor(20)));
    await screen.findByText(/Showing 21-40 of 2748 properties/);
  });

  test("the region is marked busy for assistive tech", async () => {
    render(<ListingsPage />);
    await screen.findByText(/Showing 1-20 of 2748 properties/);

    const pending = deferred();
    fetchProperties.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByTestId("results")).toHaveAttribute("aria-busy", "true");

    await act(async () => pending.resolve(payloadFor(20)));
    await waitFor(() =>
      expect(screen.getByTestId("results")).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    );
  });
});

test("the very first load shows the loading message", async () => {
  const pending = deferred();
  fetchProperties.mockReturnValueOnce(pending.promise);

  render(<ListingsPage />);

  // Nothing to preserve yet, so the placeholder is correct here.
  expect(screen.getByText(/Loading properties/)).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

  await act(async () => pending.resolve(payloadFor(0)));
  await screen.findByText(/Showing 1-20 of 2748 properties/);
});

test("applying a filter resets back to page 1 (offset 0)", async () => {
  render(<ListingsPage />);
  await screen.findByText(/Showing 1-20 of 2748 properties/);

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText(/Showing 21-40 of 2748 properties/);

  fireEvent.change(screen.getByLabelText(/beds/i), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: /search/i }));

  await waitFor(() =>
    expect(fetchProperties).toHaveBeenLastCalledWith(
      expect.objectContaining({ beds: "4", offset: 0 }),
    ),
  );
});
