import { render, screen } from "@testing-library/react";

// KEY: the API key is read once at module load, not on every render, because
// CRA substitutes process.env.REACT_APP_* at build time. That means the two
// key states cannot be tested by changing a prop -- the module has to be
// re-imported with a different environment behind it.
function loadMap(apiKey) {
  jest.resetModules();
  if (apiKey === undefined) {
    delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  } else {
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = apiKey;
  }
  // eslint-disable-next-line global-require
  return require("./PropertyMap").default;
}

const originalKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  } else {
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = originalKey;
  }
});

describe("with a key configured", () => {
  const KEY = "test-key-123";

  test("renders an iframe titled after the address", () => {
    const PropertyMap = loadMap(KEY);
    render(
      <PropertyMap latitude="45.5231" longitude="-122.6765" address="123 Main St" />,
    );

    expect(screen.getByTitle("Map of 123 Main St")).toBeInTheDocument();
  });

  test("falls back to a generic title when there is no address", () => {
    const PropertyMap = loadMap(KEY);
    render(<PropertyMap latitude="45.5231" longitude="-122.6765" />);

    expect(screen.getByTitle("Map of this property")).toBeInTheDocument();
  });

  test("points the embed at the listing's coordinates", () => {
    const PropertyMap = loadMap(KEY);
    render(<PropertyMap latitude="45.5231" longitude="-122.6765" />);

    const src = screen.getByTitle("Map of this property").getAttribute("src");
    expect(src).toContain("q=45.5231,-122.6765");
    expect(src).toContain(`key=${KEY}`);
  });

  test("offers a directions link that opens in a new tab safely", () => {
    const PropertyMap = loadMap(KEY);
    render(<PropertyMap latitude="45.5231" longitude="-122.6765" />);

    const link = screen.getByRole("link", { name: "Get Directions" });
    expect(link).toHaveAttribute("target", "_blank");
    // Without noopener the new tab can reach back into this one via
    // window.opener, which is a real navigation hijack.
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("accepts numbers as well as the strings mysql2 sends for DECIMALs", () => {
    const PropertyMap = loadMap(KEY);
    render(<PropertyMap latitude={45.5231} longitude={-122.6765} />);

    expect(screen.getByTitle("Map of this property")).toBeInTheDocument();
  });
});

// KEY: these are the coordinate states the real data actually contains --
// 698 listings with no coordinates at all and 16 parked at 0,0, which is a
// point in the Atlantic and always means "unknown", never a real address.
describe("unusable coordinates render nothing at all", () => {
  test.each([
    ["null coordinates", null, null],
    ["undefined coordinates", undefined, undefined],
    ["empty strings", "", ""],
    ["the 0,0 null island", "0", "0"],
    ["non-numeric text", "unknown", "unknown"],
    ["a latitude out of range", "95.0", "-122.6765"],
    ["a longitude out of range", "45.5231", "-200.0"],
  ])("%s", (_label, latitude, longitude) => {
    const PropertyMap = loadMap("test-key-123");
    const { container } = render(
      <PropertyMap latitude={latitude} longitude={longitude} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("without a key configured", () => {
  // A missing key must say what to do about it. Rendering an iframe with
  // "key=undefined" in the URL would show a broken Google error page instead.
  test("explains how to set the key rather than rendering a broken map", () => {
    const PropertyMap = loadMap(undefined);
    render(<PropertyMap latitude="45.5231" longitude="-122.6765" />);

    expect(screen.getByText(/REACT_APP_GOOGLE_MAPS_API_KEY/)).toBeInTheDocument();
    expect(screen.queryByTitle(/^Map of/)).not.toBeInTheDocument();
  });

  // The coordinate check runs first, so a listing with no location stays
  // invisible whether or not a key exists.
  test("still renders nothing when the coordinates are unusable", () => {
    const PropertyMap = loadMap(undefined);
    const { container } = render(<PropertyMap latitude={null} longitude={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
