import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import ErrorBoundary from "./ErrorBoundary";

// A component that throws on demand. Throwing during render is the only thing
// an error boundary catches -- it does not catch event handlers, effects, or
// anything asynchronous.
function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error("render exploded");
  return <p>All good</p>;
}

// React logs every caught error to console.error, and so does the boundary's
// own componentDidCatch. Both are expected here, so silence them rather than
// letting a passing run look like a failing one.
let errorSpy;

beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

test("renders its children when nothing goes wrong", () => {
  render(
    <ErrorBoundary>
      <Boom shouldThrow={false} />
    </ErrorBoundary>,
  );

  expect(screen.getByText("All good")).toBeInTheDocument();
});

// KEY: without a boundary, one component throwing unmounts the entire React
// tree and the user is left staring at a blank white page with no explanation.
test("catches a child that throws and shows a recovery message", () => {
  render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  expect(
    screen.getByText("Something went wrong displaying this page."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test("logs the error so it is not swallowed silently", () => {
  render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  const loggedByBoundary = errorSpy.mock.calls.some(
    (call) => call[0] === "Render error caught by boundary:",
  );
  expect(loggedByBoundary).toBe(true);
});

// KEY: resetting only clears the boundary's own flag. If whatever made the
// child throw is still true, it throws again immediately and the fallback comes
// straight back -- which is the correct behaviour, not a bug.
test("Try again re-renders the children, and re-catches if they still throw", () => {
  render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(
    screen.getByText("Something went wrong displaying this page."),
  ).toBeInTheDocument();
});

test("Try again recovers for real once the child stops throwing", () => {
  // A wrapper that owns the failure condition, so the retry can actually fix it.
  function Harness() {
    const [broken, setBroken] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setBroken(false)}>
          Fix it
        </button>
        <ErrorBoundary>
          <Boom shouldThrow={broken} />
        </ErrorBoundary>
      </>
    );
  }

  render(<Harness />);
  expect(
    screen.getByText("Something went wrong displaying this page."),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Fix it" }));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(screen.getByText("All good")).toBeInTheDocument();
});
