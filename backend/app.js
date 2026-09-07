// The Express application, with no server attached to it.
//
// KEY: this file exists so the app can be built without opening a TCP port.
// server.js listens; this file only wires middleware and routes together.
// Supertest needs exactly that -- it starts and stops its own ephemeral server
// around each request, so importing a module that had already called
// app.listen() would leave a real port bound for the whole test run.
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const propertiesRouter = require("./routes/properties");
const requestLogger = require("./middleware/requestLogger");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
// Logger Middleware
app.use(requestLogger);

// Routes
app.use("/api/properties", propertiesRouter);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Error handling middleware.
//
// KEY: the four-argument signature is what marks this as an error handler.
// Drop the unused `next` and Express treats it as ordinary middleware, and
// every next(err) from a route would fall through to the default handler
// instead, leaking the stack trace to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
