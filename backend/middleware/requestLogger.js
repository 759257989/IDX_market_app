// Logs request: when , what was asked for, how themserver answered, and how long it took.
function requestLogger(req, res, next) {
  
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNs) / 1e6;

    console.log(
      [
        new Date().toISOString(), // timestamp
        req.method,               // GET, POST, ...
        req.originalUrl,          // full path including the query string
        res.statusCode,           // 200, 404, 400, 500
        `${durationMs.toFixed(1)}ms`,
      ].join(" ")
    );
  });

  // Pass control down the chain.
  next();
}

module.exports = requestLogger;