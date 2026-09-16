import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
// A synthetic pixel fixture, never a user's reference image or ChatGPT profile.
export async function createLibraryFixture(profile) {
  const root = path.join(profile, "fixture-library");
  await mkdir(path.join(root, "images"), { recursive: true });
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAGklEQVR4nGMMzt/LQApgIkk1w6gG4gDJwQoAobcBkRYkNaAAAAAASUVORK5CYII=",
    "base64",
  );
  const images = [];
  for (const [letter, kind] of [
    ["a", "thumbnail"],
    ["b", "other"],
  ]) {
    const id = letter.repeat(64),
      file = `images/${id}.png`;
    await writeFile(path.join(root, file), pixel);
    images.push({
      id,
      file,
      preview: file,
      width: 1280,
      height: 720,
      kind,
      sources: [{ name: "Test reference", page: "https://example.com/" }],
      alt: "Test reference",
      bytes: pixel.length,
    });
  }
  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({
      images,
      sources: [{ name: "Test reference", errors: [] }],
    }),
  );
  return root;
}
