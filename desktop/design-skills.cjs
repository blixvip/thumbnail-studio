const fs = require("node:fs");
const path = require("node:path");

exports.loadSkills = (root) =>
  JSON.parse(fs.readFileSync(path.join(root, "catalog.json"), "utf8")).map(
    (skill) => {
      if (!/^[a-z0-9-]+$/.test(skill.id)) throw new Error("Invalid skill ID");
      const markdown = fs.readFileSync(
        path.join(root, skill.id, "SKILL.md"),
        "utf8",
      );
      return {
        ...skill,
        instructions: markdown
          .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
          .trim(),
      };
    },
  );
exports.buildPrompt = (skill, brief) => {
  if (
    !skill ||
    typeof brief !== "string" ||
    !brief.trim() ||
    brief.length > 2400
  )
    throw new Error("Add a video idea or brief (up to 2,400 characters).");
  return `THUMBNAIL STUDIO / ${skill.title}\n\nYou are my thumbnail art director. Follow the workflow below for my video brief. Default to a 16:9, 1280 × 720 composition unless I request something else. Keep the concept truthful to the video, readable at small sizes, and original. References are inspiration, not templates to duplicate. Never guarantee clicks or invent performance metrics. Only claim you inspected assets or generated an image when you actually did. If image generation is available and appropriate, use it; otherwise provide a production-ready prompt and state that no image was generated.\n\nVIDEO BRIEF\n${brief.trim()}\n\nDESIGN WORKFLOW\n${skill.instructions}`;
};
