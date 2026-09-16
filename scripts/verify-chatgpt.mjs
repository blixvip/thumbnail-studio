import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = process.cwd(),
  profile = await mkdtemp(path.join(os.tmpdir(), "thumbnail-live-"));
const executablePath = require("./find-electron.cjs")(root);
const env = { ...process.env, THUMBNAIL_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.THUMBNAIL_QA;
const app = await electron.launch({ executablePath, args: [root], env });
try {
  let page = await app.firstWindow();
  page.setDefaultTimeout(25000);
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
  await page.locator(".brand").waitFor();
  await page.waitForFunction(() => document.body.classList.contains("has-chat"));
  // Give ChatGPT's background frames and SPA navigation time to settle. These
  // previously hid the native view after the initial successful page load.
  await page.waitForTimeout(5000);
  async function assertVisible() {
    assert.equal((await page.evaluate(() => window.thumbnail.status())).status, "ready");
    assert(await app.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0].contentView.children.find(v => v.webContents);
      return view.getVisible();
    }), "The real native ChatGPT view must be visible");
  }
  await assertVisible();
  const remotePage = app.windows().find(p => p.url().startsWith("https://"));
  assert(remotePage, "ChatGPT page must exist");
  const email = remotePage.locator('input[type="email"]');
  const composer = remotePage.locator('[contenteditable="true"], textarea').first();
  const input = await email.count() ? email : composer;
  await input.waitFor({ timeout: 15000 });
  const draft = await email.count() ? "test@example.invalid" : "Thumbnail Studio input check";
  await input.fill(draft);
  await input.press("End");
  await input.press("Backspace");
  const value = await input.evaluate(el => el.isContentEditable ? el.textContent : el.value);
  assert.equal(value, draft.slice(0, -1), "ChatGPT must accept keyboard edits");
  await input.fill("");
  await remotePage.evaluate(() => history.replaceState(history.state, "", location.href));
  await page.waitForTimeout(300);
  await assertVisible();
  await mkdir("artifacts", { recursive: true });
  const capture = await app.evaluate(async ({ webContents }) => {
    const remote = webContents
      .getAllWebContents()
      .find((w) => w.getURL().startsWith("https://"));
    return remote
      ? (await remote.capturePage()).toPNG().toString("base64")
      : null;
  });
  if (capture)
    await writeFile(
      "artifacts/chatgpt-live.png",
      Buffer.from(capture, "base64"),
    );
  await page.screenshot({ path: "artifacts/desktop-live-shell.png" });
  console.log("PASS: live ChatGPT view stays visible after background loads and same-document navigation; input accepts typing and keyboard edits. No credentials or messages submitted.");
} finally {
  await app.close();
  if (
    path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
    path.basename(profile).startsWith("thumbnail-live-")
  )
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 200,
    });
}
