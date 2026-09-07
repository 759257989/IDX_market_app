import { render, screen, fireEvent } from "@testing-library/react";
import PropertyImageCarousel from "./PropertyImageCarousel";

const photos = [
  "https://example.com/1.jpg",
  "https://example.com/2.jpg",
  "https://example.com/3.jpg",
];

function renderCarousel(overrides = {}) {
  render(
    <PropertyImageCarousel photos={photos} alt="123 Main St" {...overrides} />,
  );
}

test("shows the first photo with the address as alt text", () => {
  renderCarousel();

  expect(screen.getByAltText("123 Main St")).toHaveAttribute(
    "src",
    photos[0],
  );
});

test("shows a placeholder when there are no photos", () => {
  renderCarousel({ photos: [] });

  expect(screen.getByText("No photo available")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

// One photo needs no way to move between photos, so the chrome is hidden.
test("hides the arrows and counter for a single photo", () => {
  renderCarousel({ photos: [photos[0]] });

  expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
  expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
});

test("shows a 1-based counter for multiple photos", () => {
  renderCarousel();

  expect(screen.getByText("1 / 3")).toBeInTheDocument();
});

test("Next advances one photo at a time", () => {
  renderCarousel();

  fireEvent.click(screen.getByLabelText("Next photo"));

  expect(screen.getByAltText("123 Main St")).toHaveAttribute("src", photos[1]);
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
});

// KEY: the index wraps with modulo rather than clamping, so the arrows are
// never dead ends. Going back from the first photo lands on the last.
test("Previous from the first photo wraps to the last", () => {
  renderCarousel();

  fireEvent.click(screen.getByLabelText("Previous photo"));

  expect(screen.getByAltText("123 Main St")).toHaveAttribute("src", photos[2]);
  expect(screen.getByText("3 / 3")).toBeInTheDocument();
});

test("Next from the last photo wraps to the first", () => {
  renderCarousel();

  fireEvent.click(screen.getByLabelText("Previous photo")); // now on 3 / 3
  fireEvent.click(screen.getByLabelText("Next photo"));

  expect(screen.getByText("1 / 3")).toBeInTheDocument();
});

// KEY: the carousel sits inside a card whose own click opens the detail page.
// Without stopPropagation, paging through photos would navigate away instead.
test("the arrows do not let the click reach the card underneath", () => {
  const onCardClick = jest.fn();
  render(
    <div onClick={onCardClick}>
      <PropertyImageCarousel photos={photos} alt="123 Main St" />
    </div>,
  );

  fireEvent.click(screen.getByLabelText("Next photo"));

  expect(onCardClick).not.toHaveBeenCalled();
});

// A dead image URL would otherwise leave a broken-image icon in the grid.
test("a photo that fails to load falls back to the placeholder", () => {
  renderCarousel();

  fireEvent.error(screen.getByAltText("123 Main St"));

  expect(screen.getByText("No photo available")).toBeInTheDocument();
});
