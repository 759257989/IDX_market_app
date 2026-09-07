import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PropertyDetailPage from "./PropertyDetailPage";
import { fetchPropertyDetail, fetchOpenHouses } from "../api/client";

// KEY: the api module is mocked rather than global.fetch, because this page is
// not the place to re-test how a request is built -- client.test.js already
// does that. Mocking one level up keeps these tests about what the page
// RENDERS, and lets a test hand it a listing shape the real data may not have
// handy (a null year, a missing lot size, no coordinates).
jest.mock("../api/client");

// SELECT * on the detail route, so these are the raw column names, with the
// types mysql2 actually returns: DECIMAL arrives as a string.
const property = {
  L_ListingID: "24001234",
  L_Address: "123 Main St",
  L_City: "Portland",
  L_State: "OR",
  L_Zip: "97205",
  L_SystemPrice: 750000,
  L_Keyword2: 3,
  LM_Dec_3: "2.5",
  LM_Int2_3: 1800,
  YearBuilt: 1944,
  LotSizeSquareFeet: "6969600.00",
  L_Remarks: "Charming bungalow with original woodwork.",
  L_Photos: '["https://example.com/1.jpg"]',
  LMD_MP_Latitude: "45.5231",
  LMD_MP_Longitude: "-122.6765",
};

function renderDetail({ state } = {}) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/property/24001234", state }]}
    >
      <Routes>
        <Route path="/property/:id" element={<PropertyDetailPage />} />
        <Route path="/" element={<p>Listings page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchPropertyDetail.mockReset();
  fetchOpenHouses.mockReset();
  fetchPropertyDetail.mockResolvedValue(property);
  fetchOpenHouses.mockResolvedValue([]);
});

test("shows a loading message before the data arrives", async () => {
  renderDetail();

  expect(screen.getByText("Loading property…")).toBeInTheDocument();

  // Let the in-flight request settle before the test ends. Without this the
  // state update lands after teardown, which React reports as an act() warning
  // -- noise that would eventually hide a real one.
  await screen.findByRole("heading", { name: "123 Main St" });
});

test("requests the listing named in the URL", async () => {
  renderDetail();

  await screen.findByText("123 Main St");
  expect(fetchPropertyDetail).toHaveBeenCalledWith("24001234");
  expect(fetchOpenHouses).toHaveBeenCalledWith("24001234");
});

test("renders the price, address and location", async () => {
  renderDetail();

  expect(await screen.findByText("$750,000")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "123 Main St" })).toBeInTheDocument();
  expect(screen.getByText("Portland, OR 97205")).toBeInTheDocument();
});

test("renders the description when the listing has remarks", async () => {
  renderDetail();

  expect(
    await screen.findByText("Charming bungalow with original woodwork."),
  ).toBeInTheDocument();
});

test("omits the description section entirely when there are no remarks", async () => {
  fetchPropertyDetail.mockResolvedValue({ ...property, L_Remarks: null });
  renderDetail();

  await screen.findByText("$750,000");
  expect(
    screen.queryByRole("heading", { name: "Description" }),
  ).not.toBeInTheDocument();
});

// KEY: a year is an identifier, not a quantity. Every other number on this page
// is grouped with thousands separators, so YearBuilt needs its own formatter or
// 1944 renders as "1,944".
test("the year built carries no thousands separator", async () => {
  renderDetail();

  await screen.findByText("$750,000");
  expect(screen.getAllByText("1944").length).toBeGreaterThan(0);
  expect(screen.queryByText("1,944")).not.toBeInTheDocument();
});

// KEY: lot size arrives as a decimal STRING. String#toLocaleString hands the
// text straight back ungrouped, so it has to be coerced to a number first --
// otherwise the page prints a bare "6969600.00".
test("the lot size is grouped, keeping the feed's precision", async () => {
  renderDetail();

  await screen.findByText("$750,000");
  // The unit shares the <dd>, so the element reads "6,969,600.00 sqft".
  expect(screen.getByText(/6,969,600\.00 sqft/)).toBeInTheDocument();
});

// These are the states the real data actually contains: 84 listings with no
// square footage, plus rows carrying a zero year or lot size, which mean
// "unknown" rather than a real measurement.
test("missing or zero measurements show an em dash", async () => {
  fetchPropertyDetail.mockResolvedValue({
    ...property,
    LM_Int2_3: null,
    YearBuilt: 0,
    LotSizeSquareFeet: "",
  });
  renderDetail();

  await screen.findByText("$750,000");
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
});

test("a missing address and price fall back to placeholder text", async () => {
  fetchPropertyDetail.mockResolvedValue({
    ...property,
    L_Address: null,
    L_SystemPrice: null,
  });
  renderDetail();

  expect(await screen.findByText("Price unavailable")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Address unavailable" }),
  ).toBeInTheDocument();
});

test("renders the open houses the listing has", async () => {
  fetchOpenHouses.mockResolvedValue([
    {
      id: 4021,
      OpenHouseDate: "2026-06-21T00:00:00.000Z",
      OH_StartTime: "13:00:00",
      OH_EndTime: "16:00:00",
      all_data: null,
    },
  ]);
  renderDetail();

  expect(await screen.findByText(/Sun, Jun 21/)).toBeInTheDocument();
});

test("says so when nothing is scheduled", async () => {
  renderDetail();

  expect(await screen.findByText("No open houses scheduled")).toBeInTheDocument();
});

describe("errors", () => {
  test("surfaces the failure and still offers a way back", async () => {
    fetchPropertyDetail.mockRejectedValue(new Error("Request failed (404)"));
    renderDetail();

    expect(
      await screen.findByText(/Could not load this property/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Request failed \(404\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to listings" }),
    ).toBeInTheDocument();
  });

  // Promise.all rejects as soon as either call does, so a failing open-house
  // request has to fail the page too rather than leaving it stuck on "Loading".
  test("a failing open-house request also reaches the error state", async () => {
    fetchOpenHouses.mockRejectedValue(new Error("Request failed (500)"));
    renderDetail();

    expect(
      await screen.findByText(/Could not load this property/),
    ).toBeInTheDocument();
  });
});

describe("the back link", () => {
  // KEY: PropertyCard hands over the search the user clicked from. Without it,
  // going back would drop their filters and land them on an unfiltered page 1.
  test("restores the search the user came from", async () => {
    renderDetail({ state: { from: "?city=Portland&page=3" } });

    const back = await screen.findByRole("link", { name: "← Back to listings" });
    expect(back).toHaveAttribute("href", "/?city=Portland&page=3");
  });

  // A direct link or a reload arrives with no state at all, so the fallback has
  // to be the plain listings page rather than a crash on location.state.from.
  test("falls back to the plain listings page on a direct link", async () => {
    renderDetail();

    const back = await screen.findByRole("link", { name: "← Back to listings" });
    expect(back).toHaveAttribute("href", "/");
  });
});

// The page unmounts while its requests are still in flight whenever the user
// navigates away quickly. Setting state after that is a React warning and, in
// a real app, a memory leak -- the cleanup flag is what prevents it.
test("a response that lands after unmount is ignored", async () => {
  let resolveDetail;
  fetchPropertyDetail.mockReturnValue(
    new Promise((resolve) => {
      resolveDetail = resolve;
    }),
  );

  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const { unmount } = renderDetail();
  unmount();

  resolveDetail(property);
  await waitFor(() => expect(errorSpy).not.toHaveBeenCalled());

  errorSpy.mockRestore();
});
