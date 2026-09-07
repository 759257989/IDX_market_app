// Jest configuration for the backend.
module.exports = {
  // Node, not jsdom: there is no DOM here, and the browser environment would
  // only slow every suite down for nothing.
  testEnvironment: "node",

  // Runs after the test framework is installed, so it can call jest.spyOn.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Only the code we actually own. db.js is replaced by a mock in every suite,
  // and server.js does nothing but bind a port, so neither belongs in the
  // denominator -- leaving them in would understate how well the real logic is
  // covered.
  collectCoverageFrom: [
    "app.js",
    "routes/**/*.js",
    "middleware/**/*.js",
    "!**/*.test.js",
  ],

  // KEY: the assignment asks for 70% line coverage, so the number is enforced
  // rather than merely reported. Below the bar, `npm run test:coverage` exits
  // non-zero and a CI run fails -- a threshold nobody checks is not a threshold.
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      branches: 70,
      functions: 70,
    },
  },

  coverageReporters: ["text", "lcov"],
};
