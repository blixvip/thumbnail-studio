# Importing reference images

The desktop app works without a library. Its design skills and ChatGPT view are available immediately. Imported references are optional and stay on your computer.

## Capture and import

Requires Python 3.11+, Pillow from `requirements.txt`, Node.js, npm dependencies, and Google Chrome.

```powershell
python -m pip install -r requirements.txt
npm run capture
npm run import
```

The capture script opens a disposable headless Chrome instance, scrolls each configured portfolio page, and collects visible raster images, lazy-loaded images, and CSS backgrounds. The importer downloads exposed originals, generates previews, records sources and dimensions, and deduplicates identical files. To refresh the desktop app's library after importing, close and reopen Thumbnail Studio.

Edit `sources.json` to add portfolio pages. Each entry uses `name` and `url`. To capture one configured source, use `node scripts/capture.mjs "Dava Studios"`. Existing captures are reused by the importer; capture again to discover new images.

## Browser library

```powershell
npm start
```

Open `http://127.0.0.1:4317`. This optional gallery includes image previews and original downloads. The desktop app does not require this server. Favorites in the browser library and desktop app are stored independently.

## Local storage and limits

- `data/images/`: original raster files.
- `data/previews/`: gallery previews.
- `data/manifest.json`: metadata, provenance, and import reports.
- `data/captures/`: captured pages and browser downloads.

The Git repository excludes these files. Imported portfolio work is third-party reference material, not generated output and not bundled with the app. Source labels link to the originating pages. Use references to guide original work.

The importer does not sign in, bypass gated content, or crawl entire domains. It skips videos, SVG icons, tiny tracking images, invalid or oversized images, and failed requests. Extra gallery pagination may require adding dedicated page URLs. The 16:9 filter is an approximate dimensions-based classification, not a content judgment.

`npm run verify-ui` checks the optional browser gallery with the local server running and at least one imported image.
