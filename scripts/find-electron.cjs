const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
module.exports = (root) => {
  let shared;
  try {
    shared = JSON.parse(
      readFileSync(path.join(root, ".desktop-runtime.json"), "utf8"),
    ).electron;
  } catch {}
  const candidates = [
    process.env.THUMBNAIL_ELECTRON,
    path.join(root, "node_modules/electron/dist/electron.exe"),
    shared,
  ];
  return candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      path.isAbsolute(candidate) &&
      existsSync(candidate),
  );
};
