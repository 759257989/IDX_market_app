import { render, screen, fireEvent, within } from "@testing-library/react";
import PropertyImageGallery from "./PropertyImageGallery";

const photos = [
  "https://example.com/1.jpg",
  "https://example.com/2.jpg",
  "https://example.com/3.jpg",
];

function renderGallery(overrides = {}) {
  render(
    <PropertyImageGallery photos={photos} alt="123 Main St" {...overrides} />,
  );
}

function openLightbox() {
  fireEvent.click(screen.getByLabelText("Open photo in full screen"));
  return screen.getByRole("dialog");
}

// KEY: while the lightbox is open the photo and the counter each exist twice --
// once in the grid behind it, once in the lightbox itself. A bare screen query
// matches both and throws, so every assertion about the lightbox has to be
// scoped to it.
function inLightbox() {
  return within(screen.getByRole("dialog"));
}

describe("the grid", () => {
  test("shows a placeholder when there are no photos", () => {
    renderGallery({ photos: [] });

    expect(screen.getByText("No photos available")).toBeInTheDocument();
  });

  test("shows the first photo and a 1-based counter", () => {
    renderGallery();

    expect(screen.getByAltText("123 Main St")).toHaveAttribute("src", photos[0]);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  test("renders one thumbnail per photo", () => {
    renderGallery();

    expect(screen.getByLabelText("Show photo 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Show photo 3")).toBeInTheDocument();
  });

  test("a single photo needs no thumbnail strip", () => {
    renderGallery({ photos: [photos[0]] });

    expect(screen.queryByLabelText("Show photo 1")).not.toBeInTheDocument();
  });

  test("clicking a thumbnail swaps the main photo and marks it current", () => {
    renderGallery();

    fireEvent.click(screen.getByLabelText("Show photo 3"));

    expect(screen.getByAltText("123 Main St")).toHaveAttribute("src", photos[2]);
    expect(screen.getByLabelText("Show photo 3")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByLabelText("Show photo 1")).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("the lightbox", () => {
  test("is closed until the main photo is clicked", () => {
    renderGallery();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openLightbox();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // KEY: aria-modal plus a focused container is what makes this usable with a
  // keyboard and a screen reader. Focus has to move INTO the dialog, or the
  // Escape and arrow keys below would land on whatever was focused before.
  test("takes focus when it opens, so the key handlers receive the keys", () => {
    renderGallery();

    const dialog = openLightbox();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  test("the close button closes it", () => {
    renderGallery();
    openLightbox();

    fireEvent.click(screen.getByLabelText("Close"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("Escape closes it", () => {
    renderGallery();
    const dialog = openLightbox();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // KEY: the check is event.target === event.currentTarget. Without it, a click
  // on the photo itself would bubble to the backdrop handler and shut the
  // lightbox the moment the user tried to look at the picture.
  test("clicking the backdrop closes it, clicking the photo does not", () => {
    renderGallery();
    const dialog = openLightbox();

    fireEvent.click(inLightbox().getByAltText("123 Main St"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("the arrow keys move between photos", () => {
    renderGallery();
    const dialog = openLightbox();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(inLightbox().getByText("2 / 3")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(inLightbox().getByText("1 / 3")).toBeInTheDocument();
  });

  // The index wraps rather than clamping, so the arrows are never dead ends.
  test("ArrowLeft from the first photo wraps to the last", () => {
    renderGallery();
    const dialog = openLightbox();

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });

    expect(inLightbox().getByText("3 / 3")).toBeInTheDocument();
  });

  test("an unrelated key does nothing", () => {
    renderGallery();
    const dialog = openLightbox();

    fireEvent.keyDown(dialog, { key: "a" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(inLightbox().getByText("1 / 3")).toBeInTheDocument();
  });

  test("the arrow buttons move between photos too", () => {
    renderGallery();
    openLightbox();

    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(inLightbox().getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Previous photo"));
    expect(inLightbox().getByText("1 / 3")).toBeInTheDocument();
  });

  test("a single photo needs no arrows", () => {
    renderGallery({ photos: [photos[0]] });
    openLightbox();

    expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
  });

  // The lightbox opens on whatever the grid was showing, not back at photo 1.
  test("opens on the photo the grid was showing", () => {
    renderGallery();

    fireEvent.click(screen.getByLabelText("Show photo 2"));
    openLightbox();

    expect(inLightbox().getByText("2 / 3")).toBeInTheDocument();
    expect(inLightbox().getByAltText("123 Main St")).toHaveAttribute(
      "src",
      photos[1],
    );
  });
});
