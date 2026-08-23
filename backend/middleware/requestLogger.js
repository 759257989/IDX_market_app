// Logs request: when , what was asked for, how themserver answered, and how long it took.
function requestLogger(req, res, next) {
  
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  // Flag slow requests so they stand out in a wall of log lines. 500ms is a
  // reasonable bar for a local API backed by an indexed table.
  const slowMarker = durationMs > 500 ? "  SLOW" : "";

  console.log(
    [
      new Date().toISOString(),
      req.method,
      req.originalUrl,
      res.statusCode,
      `${durationMs.toFixed(1)}ms`,
    ].join(" ") + slowMarker
  );
});

  // Pass control down the chain.
  next();
}

module.exports = requestLogger;