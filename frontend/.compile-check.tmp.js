const babel = require("@babel/core");
const path = require("path");
const files = ["src/pages/ListingsPage.js", "src/components/PropertySort.js", "src/utils/filters.js"];
let bad = false;
for (const f of files) {
  try {
    babel.transformFileSync(path.resolve(f), {
      presets: [require.resolve("babel-preset-react-app")],
      babelrc: false, configFile: false,
    });
    console.log("OK   " + f);
  } catch (e) {
    bad = true;
    console.log("FAIL " + f + "\n     " + e.message.split("\n")[0]);
  }
}
process.exit(bad ? 1 : 0);
