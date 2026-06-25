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

## License

MIT
