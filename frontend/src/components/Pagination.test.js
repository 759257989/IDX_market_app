import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "./Pagination";

function renderPagination(overrides = {}) {
  const props = {
    currentPage: 1,
    totalPages: 10,
    onPageChange: jest.fn(),
    ...overrides,
  };
  render(<Pagination {...props} />);
  return props;
}

test("renders nothing when there is only one page", () => {
  const { container } = render(
    <Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
});

test("first page: Previous is disabled, Next is enabled", () => {
  renderPagination({ currentPage: 1, totalPages: 10 });

  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("last page: Next is disabled, Previous is enabled", () => {
  renderPagination({ currentPage: 10, totalPages: 10 });

  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
});

test("middle page: both Previous and Next are enabled", () => {
  renderPagination({ currentPage: 5, totalPages: 10 });

  expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("marks the current page for assistive tech", () => {
  renderPagination({ currentPage: 5, totalPages: 10 });

  expect(screen.getByRole("button", { name: "5" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "4" })).not.toHaveAttribute("aria-current");
});

test("clicking a page number reports that page upward", () => {
  const { onPageChange } = renderPagination({ currentPage: 1, totalPages: 10 });

  fireEvent.click(screen.getByRole("button", { name: "3" }));

  expect(onPageChange).toHaveBeenCalledWith(3);
});

test("Previous and Next move one page at a time", () => {
  const { onPageChange } = renderPagination({ currentPage: 5, totalPages: 10 });

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(onPageChange).toHaveBeenCalledWith(6);

  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(onPageChange).toHaveBeenCalledWith(4);
});

test("renders two gaps when the current page sits in the middle", () => {
  renderPagination({ currentPage: 12, totalPages: 24 });

  expect(screen.getAllByText("…")).toHaveLength(2);
  // 1 ... 11 12 13 ... 24
  expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "24" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "7" })).not.toBeInTheDocument();
});

// KEY: the Debug Challenge regression test. Near the end, the last page must
// appear exactly once -- never "1 ... 22 23 24 24".
test("the last page is never rendered twice", () => {
  for (const currentPage of [21, 22, 23, 24]) {
    const { unmount } = render(
      <Pagination currentPage={currentPage} totalPages={24} onPageChange={jest.fn()} />
    );

    expect(screen.getAllByRole("button", { name: "24" })).toHaveLength(1);

    unmount(); // clean up before the next loop iteration renders again
  }
});