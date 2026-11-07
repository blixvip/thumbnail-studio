# Contributing to Thumbnail Studio

> 💬 **Before you open a PR, join the [blix open source Discord](https://discord.gg/grokbot).** It's the home for contributors across every blixvip repo: ask questions, run ideas by us, and talk through your PR.

Thanks for helping! Questions and ideas are welcome in the **[Discord](https://discord.gg/grokbot)**. Report bugs in [GitHub issues](https://github.com/blixvip/thumbnail-studio/issues/new).

## Finding something to work on

- [Good first issues](https://github.com/blixvip/thumbnail-studio/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are small, and each one lists the files to touch.
- [Help wanted](https://github.com/blixvip/thumbnail-studio/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issues are bigger.
- Comment on the issue to claim it so two people don't build the same thing. If you go quiet for a week, it opens up again.
- Have your own idea? For anything larger than a bug fix, open an issue or ask in the Discord first.

By contributing, you agree your work is released under the project's [MIT License](LICENSE).

## Setup

Thumbnail Studio is **Windows-only** today. You need **Node.js 24+** and **Git**, plus **Python 3.11+** for the importer and its tests. Importing references also needs **Google Chrome**.

```sh
git clone https://github.com/<you>/thumbnail-studio.git
cd thumbnail-studio
npm ci
npm run install:electron                    # downloads the pinned Electron runtime
python -m pip install -r requirements.txt   # Pillow, for the importer
npm run desktop
```

To reuse an Electron you already have, set `THUMBNAIL_ELECTRON` to its absolute path and skip `install:electron`.

Working on macOS or Linux? `npm run test:desktop` and the Python tests (`python3 -m unittest discover -s tests -v`) run fine, but the app won't launch yet. `scripts/find-electron.cjs` only looks for `electron.exe`, and `npm test` calls a bare `python`. Fixing that is genuinely wanted; see the `platform` label.

## Before you open a pull request

```sh
npm test                 # Python importer tests (tests/test_library.py)
npm run test:desktop     # Node unit tests: navigation policy, media paths, layout, skills
npm run verify:desktop   # Windows: Electron end-to-end with a fake ChatGPT page and synthetic images
```

If you changed the Template, also run `node scripts/verify-template.mjs <photo> <result>` with any two images.

- Keep changes small and focused, one fix or feature per pull request.
- Check UI changes in the real app and add a screenshot.
- There is no linter or formatter. Match the style of the file you're editing.
- Don't commit anything in `data/` (imported third-party portfolio images and captures) or `artifacts/` (screenshots from the verify scripts).
- Don't add a runtime dependency without explaining why in the pull request.
- Keep the security boundaries intact. The ChatGPT view stays sandboxed with no preload. IPC handlers in `main.cjs` must keep calling `local(event)`. The `thumbnail://` protocol must only serve allowlisted files and `data/` paths checked by `mediaPath`. The importer must reject non-HTTPS and private-network URLs on every redirect hop.
- Never make the app send a ChatGPT message, upload a file, or read the conversation automatically. Copying to the clipboard is as far as it goes.

## Where things live

- `desktop/main.cjs`: the Electron main process. It loads the manifest, serves the `thumbnail://` protocol, sets up the sandboxed ChatGPT `WebContentsView`, handles navigation and permission rules, saves Template downloads, and holds every IPC handler.
- `desktop/policy.cjs`: pure helpers for allowed ChatGPT and sign-in hosts, chat view bounds, and media-path validation. Unit-tested.
- `desktop/design-skills.cjs`: loads `skills/catalog.json` and each `skills/<id>/SKILL.md`, and builds the copied prompt.
- `desktop/preload.cjs`: the `window.thumbnail` API exposed to the UI.
- `desktop/index.html`, `app.js`, `style.css`, `studio.css`: the References and Skills side panel.
- `desktop/template.js`, `template.css`: the 1920×1080 Template canvas, image slots, text wrapping, and PNG/JPG download.
- `skills/`: the twelve design workflows as editable Markdown, with titles and categories in `catalog.json`.
- `thumbnail_library/`: the Python importer (`importer.py`), the optional read-only browser gallery server (`server.py`), and the CLI (`__main__.py`). The gallery front end is in `web/`.
- `scripts/`: the launcher, Electron finder, Playwright capture (`capture.mjs`), and end-to-end checks (`verify-*.mjs`).
- `tests/`: Python `unittest` tests for the importer and `node:test` tests for the desktop helpers.

Made a thumbnail with it? Show it off in the [Discord](https://discord.gg/grokbot).
