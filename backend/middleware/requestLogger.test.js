// The logger is small but it sits in front of every request, so its two
// behaviours are worth pinning: it must always call next(), and it must log
// only once the response has finished.
const requestLogger = require("./requestLogger");
const EventEmitter = require("node:events");

// A response object is anything with a "finish" event and a status code, so an
// EventEmitter stands in for one without needing a server.
function makeResponse(statusCode = 200) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  return res;
}

const req = { method: "GET", originalUrl: "/api/properties?city=Portland" };

let logSpy;

beforeEach(() => {
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

// KEY: middleware that forgets next() hangs the request forever -- the client
// waits until it times out, with no error anywhere to explain why.
test("passes control down the chain immediately", () => {
  const next = jest.fn();

  requestLogger(req, makeResponse(), next);

  expect(next).toHaveBeenCalledTimes(1);
});

test("logs nothing until the response finishes", () => {
  const res = makeResponse();

  requestLogger(req, res, jest.fn());
  expect(logSpy).not.toHaveBeenCalled();

  // The status code is only final at this point, which is exactly why the log
  // line is written on "finish" rather than on the way in.
  res.emit("finish");
  expect(logSpy).toHaveBeenCalledTimes(1);
});

test("the line carries the method, the url, the status and a duration", () => {
  const res = makeResponse(404);

  requestLogger(req, res, jest.fn());
  res.emit("finish");

  const line = logSpy.mock.calls[0][0];
  expect(line).toContain("GET");
  expect(line).toContain("/api/properties?city=Portland");
  expect(line).toContain("404");
  expect(line).toMatch(/\d+\.\dms/);
});

test("a fast request is not flagged as slow", () => {
  const res = makeResponse();

  requestLogger(req, res, jest.fn());
  res.emit("finish");

  expect(logSpy.mock.calls[0][0]).not.toContain("SLOW");
});

// KEY: the slow marker is the whole reason for measuring the duration, so it
// gets its own test. Faking the clock is what makes that testable -- waiting
// out a real 500ms would put half a second into every future test run.
test("a request over 500ms is flagged SLOW", () => {
  const start = process.hrtime.bigint();
  const spy = jest
    .spyOn(process.hrtime, "bigint")
    .mockReturnValueOnce(start) // read on the way in
    .mockReturnValueOnce(start + 750_000_000n); // read on finish: 750ms later

  const res = makeResponse();
  requestLogger(req, res, jest.fn());
  res.emit("finish");

  expect(logSpy.mock.calls[0][0]).toContain("SLOW");
  expect(logSpy.mock.calls[0][0]).toContain("750.0ms");

  spy.mockRestore();
});
