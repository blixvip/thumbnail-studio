const { spawn } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const executable = require("./find-electron.cjs")(root);
if (!executable) {
  console.error("Electron is missing. Run npm install, then npm run desktop.");
  process.exit(1);
}
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, [root], {
  cwd: root,
  env,
  detached: true,
  stdio: "ignore",
  windowsHide: false,
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.unref();
