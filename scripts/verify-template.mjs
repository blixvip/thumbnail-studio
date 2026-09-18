// Checks the thumbnail template inside the real desktop app (QA mode, no ChatGPT login):
// open the Template tab, add both photos, type messages (including one long unbroken word),
// download, and confirm the file was saved. Screenshots go to artifacts/.
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createLibraryFixture } from "./desktop-fixture.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const [photo, result] = process.argv.slice(2);
assert(photo && result, "Usage: node scripts/verify-template.mjs <photo> <result>");
const profile = await mkdtemp(path.join(os.tmpdir(), "thumbnail-template-"));
await mkdir("artifacts", { recursive: true });
const env = { ...process.env, THUMBNAIL_QA: "1", THUMBNAIL_PROFILE: profile, THUMBNAIL_TEST_LIBRARY: await createLibraryFixture(profile) };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ executablePath: require("./find-electron.cjs")(root), args: [root], env });
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    page = app.windows().find((w) => w.url() === "thumbnail://local/index.html");
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = async (file) => writeFile(file, Buffer.from(await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString("base64")), "base64"));
  await page.locator("#template-toggle").click();
  await page.locator("#template").waitFor();
  const chatVisible = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children[0].getVisible());
  assert.equal(chatVisible, false, "ChatGPT is hidden while the template is open");
  for (const [slot, file] of [["photo", photo], ["result", result]]) {
    const chooser = page.waitForEvent("filechooser");
    await page.locator(`#tpl-slot-${slot}`).click();
    await (await chooser).setFiles(file);
  }
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  await shot("artifacts/template.png");
  await page.locator("#tpl-prompt").fill("s".repeat(150));
  await page.waitForTimeout(150);
  await shot("artifacts/template-long-word.png");
  await page.locator("#tpl-prompt").fill("make me a thumbnail for my video about how I turned $1,000 into $100,000 trading gold in 30 days without quitting my job");
  await page.locator("#tpl-download").click();
  await page.locator("#notice").filter({ hasText: "Saved to Downloads" }).waitFor();
  const saved = (await readdir(profile)).filter((f) => /^make-me-a-thumbnail.*\.(png|jpg)$/.test(f));
  assert.equal(saved.length, 1, "Thumbnail file saved");
  const bytes = (await stat(path.join(profile, saved[0]))).size;
  await page.locator("#template-toggle").click();
  const chatBack = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children[0].getVisible());
  assert.equal(chatBack, true, "ChatGPT returns when the template closes");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ saved: saved[0], bytes, chatHidden: !chatVisible, chatBack }));
} finally {
  await app.close();
}
