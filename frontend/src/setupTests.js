// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// KEY: jsdom does not provide TextEncoder/TextDecoder, but react-router v7
// expects them on the global object. Without this polyfill every suite that
// imports a router hook fails to load with "TextEncoder is not defined".
// Node has had both in "util" since v11, so this just re-exposes them.
import { TextEncoder, TextDecoder } from "util";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}
