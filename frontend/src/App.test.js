import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./pages/ListingsPage", () => () => <div>Listings</div>);

test("renders the page heading", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /property listings/i })).toBeInTheDocument();
});