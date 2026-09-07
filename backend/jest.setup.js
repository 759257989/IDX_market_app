// Shared test setup.
//
// The request logger writes a line to stdout for every request, and the routes
// log the underlying error before returning a 500. Both are wanted in
// production and both are pure noise in a test run -- worse, the error lines
// look like failures when they are the exact behaviour a test is asserting.
// Silence them here, but keep the spies so a test can inspect the calls.
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
