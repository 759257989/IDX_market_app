// Pulls the first usable photo URL out of a raw L_Photos value.
// L_Photos is a longtext column holding a JSON string like
//   ["https://.../1.jpg", "https://.../2.jpg"]
export function getFirstPhotoUrl(rawPhotos) {
  // Case 1: nothing stored. Covers a NULL column AND the empty string "".
  if (!rawPhotos) return null;

  // Case 2: it is a non-empty string, but is it actually valid JSON?
  let photos;
  try {
    photos = JSON.parse(rawPhotos);
  } catch {
    // Malformed / truncated JSON. Do not let one bad row take down the grid.
    return null;
  }

  // Case 3: it parsed, but into the wrong shape. 
  if (!Array.isArray(photos) || photos.length === 0) return null;

  // Case 4: the array exists, the first element must be a real URL string,
  // not a number, not an empty string.
  const first = photos[0];
  if (typeof first !== "string" || first.trim() === "") return null;

  return first;
}