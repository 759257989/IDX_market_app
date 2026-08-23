import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ListingsPage from "./pages/ListingsPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function App() {
  return (
    // BrowserRouter uses the browser History API, so URLs look like real paths
    <BrowserRouter>
      <main className="app">
        {/* The heading links home so there is always a way back to the list. */}
        <h1>
          <Link to="/" className="app-title">
            {/* Served from public/ so the same file backs the favicon too. */}
            <img
              src={`${process.env.PUBLIC_URL}/idxexchangelogo.png`}
              alt=""
              className="app-logo"
              width="46"
              height="44"
            />
            <span>EstateFlow</span>
          </Link>
        </h1>

        {/* Routes picks the FIRST matching route and renders only that one. */}
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ListingsPage />} />
            <Route path="/property/:id" element={<PropertyDetailPage />} />
            <Route
              path="*"
              element={<p className="state">Page not found.</p>}
            />
          </Routes>
        </ErrorBoundary>
      </main>
    </BrowserRouter>
  );
}

export default App;
