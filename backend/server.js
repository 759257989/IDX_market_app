// Entry point: takes the app built in app.js and puts it on a port.
// Keeping the listen call here (and nowhere else) is what lets the test suite
// import the app without a server starting behind its back.
const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
