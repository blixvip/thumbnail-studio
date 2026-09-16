<p align="center"><img src="docs/brand/mark.svg" width="72" alt="Thumbnail Studio mark"></p>

<h1 align="center">Thumbnail Studio</h1>

<p align="center">Your references. A better brief. ChatGPT beside you.</p>

A minimal Windows workspace for designing YouTube thumbnails: the real ChatGPT website in a native browser view, an optional local reference library, and **12 built-in thumbnail-design skills**.

## Start creating

Requires **Windows**, **Node.js 24+**, and **Git**. The desktop app needs no API key or Python server.

```powershell
git clone https://github.com/blixvip/thumbnail-studio.git
cd thumbnail-studio
npm ci
npm run desktop
```

After setup, double-click **Start Thumbnail Studio.vbs** to launch without a terminal. Sign in to ChatGPT inside the app; its image-generation features and usage limits depend on your account. Thumbnail Studio is an independent app, not an OpenAI product.

For a desktop shortcut, run `powershell -ExecutionPolicy Bypass -File scripts/install-shortcut.ps1`.

1. Open **Skills** and pick a workflow, such as **Find the hook** or **Remix a reference**.
2. Describe your video, audience, and constraints. Click **Copy prompt**.
3. Paste it into ChatGPT and send. For visual references, copy an image from **References** and paste it into ChatGPT first.

**References** and **Skills** share one collapsible side panel. **New chat** starts a fresh conversation. ChatGPT handles image generation and downloads through its normal controls.

## Twelve ways to improve a thumbnail

| Plan              | Design                  | Explore & refine         |
| ----------------- | ----------------------- | ------------------------ |
| Find the hook     | Build the composition   | Explore three directions |
| Remix a reference | Write thumbnail text    | Check the small version  |
|                   | Fix color & contrast    | Give it a final pass     |
|                   | Direct the expression   |                          |
|                   | Spotlight a product     |                          |
|                   | Show the transformation |                          |
|                   | Design without a face   |                          |

Every skill is a readable, editable Markdown workflow in [`skills/`](skills/). [See how design skills work](docs/DESIGN-SKILLS.md).

<details><summary>Preview the design workflow</summary>
<p><img src="docs/images/design-skill.png" width="340" alt="Thumbnail Studio's Find the hook skill, with a video brief and a copied prompt ready to paste into ChatGPT"></p>
</details>

## Bring your reference library

Search imported images, filter by source, save favorites, and copy references with one click. A fresh checkout starts with an empty library; the application does not include third-party portfolio images. The skills work immediately without imports.

The optional importer requires Python 3.11+, Pillow, and Google Chrome. [Import and refresh references](docs/REFERENCE-LIBRARY.md).

## Local data and sign-in

- ChatGPT sign-in stays in a separate app profile at `%APPDATA%\Thumbnail`. This existing folder name is preserved so an app rename does not reset your session.
- Favorites and the current video brief are stored locally. Reference files live in `data/`, outside Git.
- ChatGPT is sandboxed with no Node.js or reference-bridge access. Microphone, camera, and other browser permissions are disabled in this minimal version.
- Copying a reference or prompt changes the clipboard. It does **not** submit a message or automatically upload files.
- ChatGPT handles its own authentication and may request verification. Your regular browser's cookies are not copied into the app.
- The app requests a 100 MB browser disk-cache limit; this does not cap downloaded images, imported references, or all profile storage.

To reuse an existing compatible Electron runtime, set `THUMBNAIL_ELECTRON` to its absolute executable path. The optional `.desktop-runtime.json` local file can also point to an existing runtime; it is excluded from Git. Normal `npm ci` installs the pinned runtime.

## Verification

```powershell
python -m pip install -r requirements.txt
npm test
npm run test:desktop
npm run verify:desktop
npm audit
```

The Python tests cover the importer. Node tests cover navigation restrictions, media paths, responsive layout bounds, and design-prompt validation. Electron checks use synthetic reference images, a disposable profile, and a local chat stand-in; they verify layout, copying, favorites, filtering, failure recovery, design skills, and brief persistence. They do not send ChatGPT messages or alter the OS clipboard.

`node scripts/verify-chatgpt.mjs` separately opens the real sign-in page without credentials or messages. It requires internet access and checks loading, not successful authentication or image generation.

Brand assets and interface guidance are in [`docs/brand/`](docs/brand/). No project-wide redistribution license has been assigned.
