const test = require("node:test");
const assert = require("node:assert/strict");
const {
  chatBounds,
  isChatNavigation,
  mediaPath,
} = require("../desktop/policy.cjs");

test("ChatGPT and sign-in URLs stay embedded; unrelated or unsafe URLs do not", () => {
  assert.equal(isChatNavigation("https://chatgpt.com/c/example"), true);
  assert.equal(isChatNavigation("https://auth.openai.com/authorize"), true);
  for (const url of [
    "https://chatgpt.com.evil.example",
    "file:///C:/secret",
    "javascript:alert(1)",
    "http://chatgpt.com",
  ]) {
    assert.equal(isChatNavigation(url), false);
  }
});
test("ChatGPT fills the window when references are closed", () => {
  assert.deepEqual(chatBounds(1200, 800, false), {
    x: 0,
    y: 60,
    width: 1200,
    height: 740,
    visible: true,
  });
  assert.deepEqual(chatBounds(1200, 800, true), {
    x: 340,
    y: 60,
    width: 860,
    height: 740,
    visible: true,
  });
});
test("narrow references use the whole area without covering native ChatGPT controls", () => {
  assert.equal(chatBounds(390, 800, true).visible, false);
  assert.equal(chatBounds(390, 800, false).width, 390);
});
test("only known image paths are accepted; traversal and unlisted files fail", () => {
  const file = "images/" + "a".repeat(64) + ".jpg";
  assert.equal(mediaPath(file, new Set([file])), file);
  for (const value of [
    "../secrets.json",
    "images/../../secret",
    "images/unknown.jpg",
    file + "?x",
  ]) {
    assert.equal(mediaPath(value, new Set([file])), null);
  }
});
