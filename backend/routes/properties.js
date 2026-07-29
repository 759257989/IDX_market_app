const express = require("express");
const pool = require("../db"); // reuse the existing pool, don't make a new one

const router = express.Router();

// integer only and can be up to 20 digits long.
const LISTING_ID_MAX_LENGTH = 20;
const LISTING_ID_PATTERN = /^\d+$/;

// takes a raw value from the URL and makes sure it is a valid listing id
function parseListingId(raw) {
  if (!LISTING_ID_PATTERN.test(raw)) {
    return { error: "id must be a numeric listing id" };
  }
  if (raw.length > LISTING_ID_MAX_LENGTH) {
    return { error: `id must be at most ${LISTING_ID_MAX_LENGTH} digits` };
  }
  return { value: raw };
}

// Takes a raw value from the URL and makes sure it is a plain whole number
// return either an error message or the clean value

function parseIntParam(raw, name, { min = null, max = null } = {}) {
  if (!/^\d+$/.test(raw)) {
    return { error: `${name} must be a non-negative integer` };
  }
  const value = Number(raw);
  if (min !== null && value < min)
    return { error: `${name} must be >= ${min}` };
  if (max !== null && value > max)
    return { error: `${name} must be <= ${max}` };
  return { value };
}

//  accepts numbers with a decimal point
// for bathrooms where half counts exist.
function parseNumberParam(raw, name, { min = null } = {}) {
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { error: `${name} must be a number` };
  }
  const value = Number(raw);
  if (min !== null && value < min)
    return { error: `${name} must be >= ${min}` };
  return { value };
}

// handles GET requests for the list of properties. supports paging
// (limit and offset) and optional filters
router.get("/", async (req, res) => {
  //defaults: show 20 results, start from the top.
  const { limit: rawLimit, offset: rawOffset } = req.query;
  let limit = 20;
  let offset = 0;

  // If specific page size, check it is a valid number
  // between 1 and 100.
  if (rawLimit !== undefined) {
    const r = parseIntParam(rawLimit, "limit", { min: 1, max: 100 });
    if (r.error) return res.status(400).json({ error: r.error }); // stop on bad input
    limit = r.value;
  }

  // check for offset, how many rows to skip.
  if (rawOffset !== undefined) {
    const r = parseIntParam(rawOffset, "offset", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    offset = r.value;
  }

  // build the WHERE part of the SQL.
  const conditions = [];
  const values = [];

  // all the possible filters.
  const { city, zipcode, minPrice, maxPrice, beds, baths, minBeds, minBaths } =
    req.query;

  // City match
  if (city !== undefined) {
    conditions.push("LOWER(TRIM(L_City)) = LOWER(TRIM(?))");
    values.push(city);
  }

  // Exact zip code match.
  if (zipcode !== undefined) {
    conditions.push("L_Zip = ?");
    values.push(zipcode);
  }

  // Lowest price. Must be a valid number.
  if (minPrice !== undefined) {
    const r = parseIntParam(minPrice, "minPrice", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("L_SystemPrice >= ?");
    values.push(r.value); // push the NUMBER, not the raw string
  }

  // Highest the caller will accept.
  if (maxPrice !== undefined) {
    const r = parseIntParam(maxPrice, "maxPrice", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("L_SystemPrice <= ?");
    values.push(r.value);
  }

  // Exact number of bedrooms: beds=3 means exactly 3, not 3-or-more.
  if (beds !== undefined) {
    const r = parseIntParam(beds, "beds", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("L_Keyword2 = ?");
    values.push(r.value);
  }

  // Exact number of bathrooms.
  if (baths !== undefined) {
    const r = parseNumberParam(baths, "baths", { min: 0 }); // decimal-friendly
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("LM_Dec_3 = ?");
    values.push(r.value);
  }

  // Open-ended lower bound, backing the UI's "5+" choice. Kept as its own
  // param so `beds` can stay an unambiguous exact match.
  if (minBeds !== undefined) {
    const r = parseIntParam(minBeds, "minBeds", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("L_Keyword2 >= ?");
    values.push(r.value);
  }

  if (minBaths !== undefined) {
    const r = parseNumberParam(minBaths, "minBaths", { min: 0 });
    if (r.error) return res.status(400).json({ error: r.error });
    conditions.push("LM_Dec_3 >= ?");
    values.push(r.value);
  }

  // If at least one filter, together with AND to make a WHERE clause. If none, return everything.
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    //  how many rows match,
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM rets_property ${whereClause}`,
      values,
    );
    const total = countRows[0].total;

    // the actual page of results and sort by ID.
    const [results] = await pool.query(
      `SELECT L_ListingID, L_Address, L_City, L_State, L_Zip,
          L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
          LM_Int2_3 AS sqft, L_Photos
     FROM rets_property
     ${whereClause}
     ORDER BY L_ListingID
     LIMIT ? OFFSET ?`,
      [...values, limit, offset], // filter values FIRST, then limit/offset
    );

    // returns back the total, the paging info we used, and the rows themselves.
    res.json({ total, limit, offset, results });
  } catch (err) {
    // Something went wrong talking to the database.
    console.error("GET /api/properties failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Single property get by listing ID.
router.get("/:id", async (req, res, next) => {
  const parsed = parseListingId(req.params.id);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const listingId = parsed.value;

  try {
    // SELECT * return the whole record.
    // LIMIT 1  MySQL stop as soon as finds the row.
    const [rows] = await pool.query(
      "SELECT * FROM rets_property WHERE L_ListingID = ? LIMIT 1",
      [listingId],
    );

    //  empty result 404
    // something that does not exist
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No property found with listing id ${listingId}` });
    }

    res.json(rows[0]);
  } catch (err) {
    // Hand database failures to the error middleware in server.js.
    next(err);
  }
});

// Open house events for one property.
router.get("/:id/openhouses", async (req, res, next) => {
  const parsed = parseListingId(req.params.id);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const listingId = parsed.value;

  try {
    // check the property exists first.
    const [propertyRows] = await pool.query(
      "SELECT L_ListingID FROM rets_property WHERE L_ListingID = ? LIMIT 1",
      [listingId],
    );

    if (propertyRows.length === 0) {
      return res
        .status(404)
        .json({ error: `No property found with listing id ${listingId}` });
    }

    const [openHouses] = await pool.query(
      `SELECT id, L_ListingID, OpenHouseDate, OH_StartTime, OH_EndTime, all_data
         FROM rets_openhouse
        WHERE L_ListingID = ?
        ORDER BY OpenHouseDate, OH_StartTime`, // date first, then time within the day
      [listingId],
    );

    // empty array is ok: the property exists, it just
    // has nothing scheduled. That is not an error, so a 200.
    res.json(openHouses);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
