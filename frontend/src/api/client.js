// All backend calls go here. Components import these functions and
// never touch fetch directly, so error handling lives in exactly one place.

const BASE = "/api"; // relative path -> the dev-server proxy forwards it to :5001

// One shared helper for all backend calls. Throws on network failure or non-2xx response.
async function request(path) {
  let res;
  try {
    res = await fetch(BASE + path);
  } catch (networkError) {
    throw new Error("Cannot reach the server. Is the backend running on port 5001?");
  }

  if (!res.ok) {
    let detail = "";
    try {
      // Our backend sends { error: "..." } on failures -- surface that text.
      const body = await res.json();
      if (body && body.error) detail = `: ${body.error}`;
    } catch {
      // response had no JSON body; the status code alone will have to do
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }

  return res.json();
}

// GET /api/properties with optional filters/pagination, e.g.
// fetchProperties({ limit: 20, offset: 0, city: "Portland" }).
export function fetchProperties(params = {}) {
  //  turns { limit: 20, city: "Portland" } into "limit=20&city=Portland"
  const query = new URLSearchParams(params).toString();
  return request(`/properties${query ? `?${query}` : ""}`);
}

// GET /api/properties/:id
export function fetchPropertyDetail(id) {
  return request(`/properties/${encodeURIComponent(id)}`);
}