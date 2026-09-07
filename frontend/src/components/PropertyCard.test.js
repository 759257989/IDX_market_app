import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import PropertyCard from "./PropertyCard";

// KEY: PropertyCard calls useNavigate, useLocation and renders a <Link>, so it
// cannot be rendered bare -- all three throw outside a router. Wrapping in
// MemoryRouter is what makes the component testable at all.
//
// Rendering a real destination route rather than mocking useNavigate means the
// test asserts that the click actually lands on the right URL, not merely that
// some function was called with a string.
function DestinationProbe() {
  const location = useLocation();
  return (
    <div>
      <p data-testid="pathname">{location.pathname}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </div>
  );
}

// A row shaped the way the API sends it: aliased names, real types.
const property = {
  L_ListingID: "24001234",
  L_Address: "123 Main St",
  L_City: "Portland",
  L_State: "OR",
  L_Photos: '["https://example.com/1.jpg","https://example.com/2.jpg"]',
  price: 750000,
  beds: 3,
  baths: 2.5,
  sqft: 1800,
};

function renderCard(overrides = {}, { search = "" } = {}) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <Routes>
        <Route
          path="/"
          element={<PropertyCard property={{ ...property, ...overrides }} />}
        />
        <Route path="/property/:id" element={<DestinationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("what the card shows", () => {
  test("renders the price, address, location and specs", () => {
    renderCard();

    expect(screen.getByText("$750,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "123 Main St" })).toBeInTheDocument();
    expect(screen.getByText("Portland, OR")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("1,800")).toBeInTheDocument();
  });

  test("formats the price as whole dollars, no cents", () => {
    renderCard({ price: 3950000 });

    expect(screen.getByText("$3,950,000")).toBeInTheDocument();
    expect(screen.queryByText("$3,950,000.00")).not.toBeInTheDocument();
  });

  test("adds thousands separators to the square footage", () => {
    renderCard({ sqft: 7130 });

    expect(screen.getByText("7,130")).toBeInTheDocument();
  });
});

// KEY: these are the cases the real data actually contains -- 328 rows with no
// address, 101 with no beds, 84 with no sqft. A card must never print the word
// "null" at the user, and it must not print a misleading "0" either.
describe("missing data", () => {
  test("a null bed, bath or sqft count shows an em dash", () => {
    renderCard({ beds: null, baths: null, sqft: null });

    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  // sqft is guarded on truthiness rather than on null, so a genuine 0 also
  // becomes a dash. That is intentional: a zero-square-foot house is bad data,
  // not a fact worth displaying.
  test("a zero square footage shows an em dash rather than 0", () => {
    renderCard({ sqft: 0 });

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  test("a missing address falls back to placeholder text", () => {
    renderCard({ L_Address: null });

    expect(
      screen.getByRole("link", { name: "Address unavailable" }),
    ).toBeInTheDocument();
  });

  test("a missing price says so instead of printing null", () => {
    renderCard({ price: null });

    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
  });

  // The city/state line joins with a comma, but only around values that exist,
  // so a missing state must not leave a trailing "Portland, ".
  test("a missing state leaves no dangling comma", () => {
    renderCard({ L_State: null });

    expect(screen.getByText("Portland")).toBeInTheDocument();
    expect(screen.queryByText("Portland,")).not.toBeInTheDocument();
  });

  // 381 rows store L_Photos as an empty string, which JSON.parse would throw
  // on. getPhotoUrls absorbs that, and the carousel shows its placeholder.
  test("an empty photo string renders the placeholder, it does not crash", () => {
    renderCard({ L_Photos: "" });

    expect(screen.getByText("No photo available")).toBeInTheDocument();
  });

  test("malformed photo JSON also falls back to the placeholder", () => {
    renderCard({ L_Photos: "[not json" });

    expect(screen.getByText("No photo available")).toBeInTheDocument();
  });
});

describe("navigation", () => {
  test("clicking the card opens the detail page for that listing", () => {
    renderCard();

    fireEvent.click(screen.getByRole("article"));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/property/24001234",
    );
  });

  test("the address link goes to the same place", () => {
    renderCard();

    fireEvent.click(screen.getByRole("link", { name: "123 Main St" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/property/24001234",
    );
  });

  // KEY: the link sits inside a clickable article, so without stopPropagation
  // the click would fire twice -- the Link navigates, then the article's own
  // handler navigates again on top of it. Two history entries for one click
  // makes the browser Back button look broken.
  //
  // React simulates propagation along the component tree, so the way to see it
  // being stopped is a handler further up that never runs.
  test("the address link does not also trigger the card's own handler", () => {
    const onAncestorClick = jest.fn();
    render(
      <MemoryRouter>
        <div onClick={onAncestorClick}>
          <PropertyCard property={property} />
        </div>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "123 Main St" }));
    expect(onAncestorClick).not.toHaveBeenCalled();

    // Control: a click anywhere else on the card is not stopped, which proves
    // the assertion above is testing stopPropagation and not a dead handler.
    fireEvent.click(screen.getByText("$750,000"));
    expect(onAncestorClick).toHaveBeenCalledTimes(1);
  });

  // KEY: the detail page's back link needs the search the user came from,
  // otherwise returning from a listing dumps them on an unfiltered page 1.
  test("carries the current search along in the navigation state", () => {
    renderCard({}, { search: "?city=Portland&page=3" });

    fireEvent.click(screen.getByRole("article"));

    expect(screen.getByTestId("state")).toHaveTextContent(
      JSON.stringify({ from: "?city=Portland&page=3" }),
    );
  });
});
