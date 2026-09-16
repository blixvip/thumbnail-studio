import { _electron as electron } from "playwright";
import { existsSync } from "node:fs";
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
  const deadline = Date.now() + 45000;
  let result;
  do {
    result = await app.evaluate(async ({ webContents }) => {
      const remote = webContents
        .getAllWebContents()
        .find((w) => w.getURL().startsWith("https://"));
      if (!remote) return null;
      return {
        url: remote.getURL(),
        title: remote.getTitle(),
        loading: remote.isLoading(),
        text: await remote
          .executeJavaScript("document.body?.innerText?.slice(0,1800)")
          .catch(() => null),
      };
    });
    if (result?.text && !result.loading) break;
    await page.waitForTimeout(1000);
  } while (Date.now() < deadline);
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
  console.log(JSON.stringify(result, null, 2));
  if (!result?.text || !/chatgpt/i.test(result.title))
    throw new Error("ChatGPT did not reach its real page");
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
