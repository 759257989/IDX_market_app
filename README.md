# IDX Market App


## Tech Stack

- **Node.js** / **Express** — HTTP server & routing
- **mysql2** — MySQL connection pool (promise API)
- **dotenv** — environment variable management
- **cors** — cross-origin requests
- **nodemon** (dev) — auto-restart on file changes

## Project Structure

```
backend/
├── db.js            # MySQL connection pool module
├── server.js        # Express app & routes
├── .env             # DB credentials (NOT committed)
├── .gitignore
├── package.json
└── package-lock.json
```

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Create a `backend/.env` file (this file is gitignored — never commit it):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
PORT=3000
```

### 3. Run the server

```bash
npm run dev     # development, auto-restarts on changes (nodemon)
npm start       # production
```

The server starts on `http://localhost:3000`.

## API

### `GET /api/health`

Checks database connectivity.

| Condition | Status | Response |
|-----------|--------|----------|
| MySQL reachable | `200` | `{ "status": "ok", "database": "connected" }` |
| MySQL unreachable | `500` | `{ "status": "error", "database": "disconnected" }` |

```bash
curl http://localhost:3000/api/health
```

### `GET /api/properties`

Returns a paginated, filterable list of properties.

**Query parameters** (all optional):

| Param | Type | Notes |
|-------|------|-------|
| `limit` | integer 1-100 | Page size, default 20 |
| `offset` | integer >= 0 | Rows to skip, default 0 |
| `city` | string | Case and whitespace insensitive |
| `zipcode` | string | Exact match |
| `minPrice` | integer >= 0 | Lower price bound |
| `maxPrice` | integer >= 0 | Upper price bound |
| `beds` | integer >= 0 | Minimum bedrooms |
| `baths` | number >= 0 | Minimum bathrooms, decimals allowed |

Invalid values return `400` with a descriptive message.

```bash
curl "http://localhost:3000/api/properties?city=Portland&minPrice=300000&beds=3&limit=20&offset=0"
```

Response shape:

```json
{ "total": 87, "limit": 20, "offset": 0, "results": [ ... ] }
```

## Database Indexes

The filter columns are indexed. See [`backend/sql/indexes.sql`](backend/sql/indexes.sql):

```sql
CREATE INDEX idx_price ON rets_property (L_SystemPrice);
CREATE INDEX idx_beds  ON rets_property (L_Keyword2);
CREATE INDEX idx_baths ON rets_property (LM_Dec_3);
CREATE INDEX idx_zip   ON rets_property (L_Zip);
CREATE INDEX idx_city_price
  ON rets_property ((LOWER(TRIM(L_City))), L_SystemPrice);
```

`idx_city_price` is a composite functional index. It matches the exact
`LOWER(TRIM(L_City))` expression the query uses for city, and also carries price
as a second column so the common city plus price filter is served by one index.

### Performance: before vs after indexes

Measured on the `rets_property` table (53,122 rows, MySQL 8.0.46) with
`EXPLAIN` for the chosen index and `EXPLAIN ANALYZE` for the actual time
(best of several warm runs). "Before" was taken with the five indexes dropped.

| Query | Before: index used | Before: time | After: index used | After: time | Speedup |
|-------|--------------------|--------------|-------------------|-------------|---------|
| `city = Portland` | idx_L_City (full index scan, 35k rows) | ~11 ms | idx_city_price (1 row) | ~0.01 ms | ~1000x |
| `minPrice >= 300000` | none, full table scan (35k rows) | ~149 ms | idx_price (range) | ~11 ms | ~13x |
| `city + minPrice + beds` | none, full table scan (35k rows) | ~145 ms | idx_city_price (1 row) | ~0.01 ms | ~10000x |

Takeaways:

- Without indexes, price and combined filters fall back to a full table scan
  that reads every row. Adding `idx_price` and `idx_city_price` lets MySQL jump
  straight to the matching rows.
- The `key` column in `EXPLAIN` goes from `NULL` (full scan) to a named index
  after the indexes are added, confirming they are actually used.
- The composite `idx_city_price` is the biggest win for the combined filter
  because it resolves city and price together instead of scanning.

Reproduce anytime:

```bash
# which index a query uses
EXPLAIN SELECT COUNT(*) FROM rets_property WHERE L_SystemPrice >= 300000;
# actual measured time
EXPLAIN ANALYZE SELECT COUNT(*) FROM rets_property WHERE L_SystemPrice >= 300000;
# confirm the indexes exist
SHOW INDEXES FROM rets_property;
```

## License

MIT
