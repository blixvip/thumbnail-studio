const {
  app,
  BrowserWindow,
  WebContentsView,
  protocol,
  net,
  ipcMain,
  session,
  clipboard,
  nativeImage,
  shell,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { isChatNavigation, chatBounds, mediaPath } = require("./policy.cjs");
const { loadSkills, buildPrompt } = require("./design-skills.cjs");
const ROOT = path.resolve(__dirname, "..");
const QA = process.env.THUMBNAIL_QA === "1";
const DATA =
  QA && process.env.THUMBNAIL_TEST_LIBRARY
    ? path.resolve(process.env.THUMBNAIL_TEST_LIBRARY)
    : path.join(ROOT, "data");
const skills = loadSkills(path.join(ROOT, "skills"));
const CHAT = QA ? "thumbnail://local/qa-chat.html" : "https://chatgpt.com/";
app.setName("Thumbnail Studio");
app.setAppUserModelId("com.thumbnail.desktop");
app.setPath(
  "userData",
  process.env.THUMBNAIL_PROFILE ||
    path.join(app.getPath("appData"), "Thumbnail"),
);
app.commandLine.appendSwitch("disk-cache-size", "104857600");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "thumbnail",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let win,
  chat,
  references = true,
  template = false,
  state = { status: "loading" };
let library = { images: [], sources: [] },
  known = new Set(),
  allowedLinks = new Set(["https://chatgpt.com/"]);
function status(next) {
  state = next;
  if (win && !win.isDestroyed())
    win.webContents.send("thumbnail:status", state);
}
function layout() {
  if (!win || !chat) return;
  const [width, height] = win.getContentSize();
  const { visible, ...bounds } = chatBounds(width, height, references);
  chat.setBounds(bounds);
  // The thumbnail template covers the chat area, so ChatGPT is hidden while it's open.
  chat.setVisible(visible && state.status === "ready" && !template);
}
function local(event) {
  if (
    !win ||
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame ||
    event.senderFrame.url !== "thumbnail://local/index.html"
  )
    throw new Error("Untrusted caller");
}
async function external(url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return false;
  await shell.openExternal(url);
  return true;
}
function protect(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isChatNavigation(url))
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          parent: win,
          autoHideMenuBar: true,
          webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            partition: "persist:chatgpt",
          },
        },
      };
    external(url).catch(() => {});
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!isChatNavigation(url) && !(QA && url === CHAT)) {
      event.preventDefault();
      external(url).catch(() => {});
    }
  });
  contents.on("will-redirect", (event, url, _inPlace, mainFrame) => {
    if (mainFrame !== false && !isChatNavigation(url) && !(QA && url === CHAT))
      event.preventDefault();
  });
  contents.on("did-create-window", (child) => protect(child.webContents));
}
async function boot() {
  try {
    library = JSON.parse(
      await fs.readFile(path.join(DATA, "manifest.json"), "utf8"),
    );
    if (!Array.isArray(library.images) || !Array.isArray(library.sources))
      throw new Error("Bad manifest");
    for (const item of library.images) {
      known.add(item.file);
      known.add(item.preview);
      for (const source of item.sources || [])
        if (/^https:\/\//.test(source.page)) allowedLinks.add(source.page);
    }
  } catch (error) {
    library = {
      images: [],
      sources: [],
      error:
        error.code === "ENOENT"
          ? null
          : "Your reference library could not be opened. Your saved files are unchanged.",
    };
  }
  protocol.handle("thumbnail", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "local")
      return new Response("Not found", { status: 404 });
    const name = url.pathname.slice(1);
    let file;
    if (
      ["index.html", "app.js", "style.css", "studio.css", "template.js", "template.css"].includes(name) ||
      (QA && name === "qa-chat.html")
    )
      file = path.join(__dirname, name);
    else if (name.startsWith("media/") && mediaPath(name.slice(6), known)) {
      const root = await fs.realpath(DATA);
      try {
        file = await fs.realpath(path.join(root, name.slice(6)));
      } catch {
        return new Response("Not found", { status: 404 });
      }
      if (!file.startsWith(root + path.sep))
        return new Response("Forbidden", { status: 403 });
    } else return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  const chatSession = session.fromPartition(
    QA ? "qa-chatgpt" : "persist:chatgpt",
  );
  if (QA)
    chatSession.protocol.handle("thumbnail", (request) =>
      request.url === CHAT
        ? net.fetch(pathToFileURL(path.join(__dirname, "qa-chat.html")).href)
        : new Response("Not found", { status: 404 }),
    );
  chatSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  chatSession.setPermissionCheckHandler(() => false);
  chatSession.on("will-download", (_event, item) => {
    item.once("done", (_e, outcome) => {
      if (outcome === "completed")
        status({ status: "ready", message: "Image saved." });
      else if (outcome !== "cancelled")
        status({
          status: "ready",
          message: "Download interrupted. Try again in ChatGPT.",
        });
    });
  });
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 380,
    minHeight: 560,
    title: "Thumbnail Studio",
    icon: path.join(__dirname, "thumbnail.ico"),
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenu(null);
  // Template downloads go straight to Downloads (never overwriting) instead of a save dialog.
  win.webContents.session.on("will-download", (_event, item) => {
    const folder = QA ? app.getPath("userData") : app.getPath("downloads");
    const { name, ext } = path.parse(item.getFilename());
    let file = path.join(folder, `${name}${ext}`);
    for (let i = 2; require("node:fs").existsSync(file); i++) file = path.join(folder, `${name}-${i}${ext}`);
    item.setSavePath(file);
    item.once("done", (_e, outcome) =>
      status({ ...state, message: outcome === "completed" ? `Saved to Downloads as ${path.basename(file)}.` : "The thumbnail could not be saved." }),
    );
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  chat = new WebContentsView({
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      session: chatSession,
    },
  });
  win.contentView.addChildView(chat);
  protect(chat.webContents);
  // Loading also fires for history changes and background frames. Only a new
  // top-level document should replace the usable page with our loading screen.
  chat.webContents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) {
      status({ status: "loading" });
      layout();
    }
  });
  const documentReady = () => {
    // Chromium can finish painting its error document after did-fail-load.
    if (state.status === "error") return;
    const url = chat.webContents.getURL();
    status({
      status: isChatNavigation(url) || (QA && url.split("#")[0] === CHAT) ? "ready" : "error",
    });
    layout();
  };
  chat.webContents.on("dom-ready", documentReady);
  chat.webContents.on("did-finish-load", documentReady);
  chat.webContents.on(
    "did-fail-load",
    (_event, code, _description, _url, mainFrame) => {
      if (mainFrame && code !== -3) {
        status({ status: "error" });
        layout();
      }
    },
  );
  chat.webContents.on("render-process-gone", () => {
    status({ status: "error" });
    layout();
  });
  win.on("resize", layout);
  win.on("closed", () => {
    if (!chat.webContents.isDestroyed()) chat.webContents.close();
    win = null;
  });
  await win.loadURL("thumbnail://local/index.html");
  layout();
  chat.webContents.loadURL(CHAT).catch(() => {
    status({ status: "error" });
    layout();
  });
}
ipcMain.handle("thumbnail:library", (event) => {
  local(event);
  return library;
});
ipcMain.handle("thumbnail:status", (event) => {
  local(event);
  return state;
});
ipcMain.handle("thumbnail:references", (event, open) => {
  local(event);
  references = Boolean(open);
  layout();
});
ipcMain.handle("thumbnail:template", (event, open) => {
  local(event);
  template = Boolean(open);
  layout();
});
ipcMain.handle("thumbnail:copy", async (event, id) => {
  local(event);
  const item = library.images.find((image) => image.id === id);
  if (!item) return { ok: false, message: "Reference not found." };
  try {
    const root = await fs.realpath(DATA);
    let image;
    for (const name of [item.file, item.preview]) {
      if (!mediaPath(name, known)) continue;
      const file = await fs.realpath(path.join(root, name));
      if (!file.startsWith(root + path.sep)) continue;
      if ((await fs.stat(file)).size > 30 * 1024 * 1024) continue;
      image = nativeImage.createFromPath(file);
      if (!image.isEmpty()) break;
    }
    if (!image || image.isEmpty())
      return {
        ok: false,
        message: "This image could not be copied. Choose another reference.",
      };
    if (!QA) clipboard.writeImage(image);
    return { ok: true, size: image.getSize() };
  } catch {
    return {
      ok: false,
      message: "This image is unavailable. Try another reference.",
    };
  }
});
ipcMain.handle("thumbnail:chat", async (event, action) => {
  local(event);
  if (action === "new") await chat.webContents.loadURL(CHAT).catch(() => {});
  else if (action === "reload") {
    if (state.status === "error")
      await chat.webContents.loadURL(CHAT).catch(() => {});
    else chat.webContents.reload();
  } else if (action === "browser") await external("https://chatgpt.com/");
});
ipcMain.handle("thumbnail:external", async (event, url) => {
  local(event);
  if (allowedLinks.has(url)) return external(url);
  return false;
});
ipcMain.handle("thumbnail:skills", (event) => {
  local(event);
  return skills;
});
ipcMain.handle("thumbnail:skill-prompt", (event, input) => {
  local(event);
  try {
    if (!input || typeof input !== "object")
      throw new Error("Choose a design skill first.");
    const skill = skills.find((item) => item.id === input.id);
    const prompt = buildPrompt(skill, input.brief);
    if (input.copy === true && !QA) clipboard.writeText(prompt);
    return { ok: true, prompt };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(boot)
    .catch((error) => {
      console.error("Thumbnail startup failed:", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
