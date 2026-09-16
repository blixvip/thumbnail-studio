import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createLibraryFixture } from "./desktop-fixture.mjs";
const require = createRequire(import.meta.url);
const root = process.cwd();
const executablePath = require("./find-electron.cjs")(root);
assert(executablePath, "Electron must be installed");
const profile = await mkdtemp(path.join(os.tmpdir(), "thumbnail-qa-"));
await mkdir("artifacts", { recursive: true });
const fixture = await createLibraryFixture(profile);
const env = {
  ...process.env,
  THUMBNAIL_QA: "1",
  THUMBNAIL_PROFILE: profile,
  THUMBNAIL_TEST_LIBRARY: fixture,
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ executablePath, args: [root], env });
try {
  let page = await app.firstWindow();
  for (let i = 0; i < 100; i++) {
    const shell = app
      .windows()
      .find((candidate) => candidate.url() === "thumbnail://local/index.html");
    if (shell) {
      page = shell;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log("Testing shell:", page.url());
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .locator(".card")
    .first()
    .waitFor()
    .catch(async (error) => {
      console.log(await page.locator("body").innerText());
      throw error;
    });
  await page.waitForFunction(
    () => document.body.classList.contains("has-chat"),
    null,
    { timeout: 15000 },
  );
  const total = await page.locator("#count").textContent();
  assert.match(total, /\d/);
  await page.locator(".image").first().click();
  await page
    .getByText("Copied. Click the ChatGPT message box and press Ctrl+V.")
    .waitFor();
  await page.locator(".favorite").first().click();
  await page.getByLabel("Show favorites").click();
  assert.equal(await page.locator(".card").count(), 1);
  await page.reload();
  await page.locator(".card").first().waitFor();
  await page.getByLabel("Show favorites").click();
  assert.equal(await page.locator(".card").count(), 1);
  await page.getByLabel("Show favorites").click();
  for (const [width, height] of [
    [1360, 900],
    [760, 820],
    [390, 844],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0].setContentSize(...size),
      [width, height],
    );
    await page.waitForTimeout(180);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}`,
    );
    await page.screenshot({ path: `artifacts/desktop-${width}.png` });
  }
  await page.getByRole("button", { name: "References", exact: true }).click();
  assert(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("collapsed")),
  );
  const hiddenBounds = await app.evaluate(({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children.find(
      (v) => v.webContents?.getURL().includes("qa-chat"),
    );
    return view.getBounds();
  });
  assert.equal(hiddenBounds.x, 0);
  assert.equal(hiddenBounds.width, 390);
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page.getByLabel("Search references").fill("nothing-matches-239348");
  await page.getByText("No references found.").waitFor();
  await page.screenshot({ path: "artifacts/desktop-empty.png" });
  await page.getByLabel("Search references").fill("");
  await page.evaluate(() => window.thumbnail.chat("new"));
  await app.evaluate(async ({ webContents }) => {
    const remote = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("qa-chat.html"));
    await remote.loadURL("http://127.0.0.1:1/unavailable").catch(() => {});
  });
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page.getByText("ChatGPT couldn’t load.").waitFor();
  await page.screenshot({ path: "artifacts/desktop-error.png" });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForFunction(() =>
    document.body.classList.contains("has-chat"),
  );
  const boundary = await app.evaluate(async ({ webContents }) => {
    const remote = webContents
      .getAllWebContents()
      .find((w) => w.getURL().includes("qa-chat.html"));
    return remote.executeJavaScript(
      "({ node: typeof require, bridge: typeof window.thumbnail })",
    );
  });
  assert.deepEqual(boundary, { node: "undefined", bridge: "undefined" });
  const denied = await page.evaluate(() => window.thumbnail.copy("../secret"));
  assert.equal(denied.ok, false);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  assert.equal(await page.locator(".skill-card").count(), 12);
  await page.getByRole("button", { name: "Refine", exact: true }).click();
  assert.equal(await page.locator(".skill-card").count(), 2);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator('[data-skill="hook-strategy"]').click();
  assert(
    await page
      .getByRole("button", { name: "Copy prompt", exact: true })
      .isDisabled(),
  );
  await page
    .getByLabel("Your video idea")
    .fill(
      "I built a gaming PC for $300. Clear budget constraint, minimal text.",
    );
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await page
    .getByText("Prompt copied. Paste into ChatGPT with Ctrl+V.")
    .waitFor();
  assert.match(
    await page.getByLabel("Prepared prompt").inputValue(),
    /gaming PC/,
  );
  assert.match(
    await page.getByLabel("Prepared prompt").inputValue(),
    /Find the hook/,
  );
  await page.screenshot({ path: "artifacts/studio-skill-390.png" });
  await page.getByRole("button", { name: "← All skills", exact: true }).click();
  await page.screenshot({ path: "artifacts/studio-skills-390.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1360, 900),
  );
  await page.screenshot({ path: "artifacts/studio-skills-1360.png" });
  await page.reload();
  await page.locator(".card").first().waitFor();
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.locator('[data-skill="mobile-check"]').click();
  assert.match(
    await page.getByLabel("Your video idea").inputValue(),
    /gaming PC/,
  );
  const badPrompt = await page.evaluate(() =>
    window.thumbnail.skillPrompt("../secret", "a brief", true),
  );
  assert.equal(badPrompt.ok, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native ChatGPT boundary, responsive layouts, reference copy, favorites, search, failure/retry, 12 skills, categories, prompt composition/copy, draft persistence, invalid inputs.",
  );
} finally {
  await app.close();
  // This is the isolated profile created above, never the user's ChatGPT profile.
  if (
    path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
    path.basename(profile).startsWith("thumbnail-qa-")
  )
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 200,
    });
}
