const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadSkills, buildPrompt } = require("../desktop/design-skills.cjs");
const skills = loadSkills(path.resolve(__dirname, "..", "skills"));

test("twelve distinct, useful thumbnail workflows ship with the app", () => {
  assert.equal(skills.length, 12);
  assert.equal(new Set(skills.map((s) => s.id)).size, 12);
  for (const skill of skills) {
    assert(skill.title && skill.description);
    assert(skill.instructions.length > 350);
    assert(!skill.instructions.includes("TODO"));
  }
});
test("a prompt includes the selected workflow and the literal user brief", () => {
  const prompt = buildPrompt(
    skills[0],
    "Why small batteries fail\nNo text, use my attached photo.",
  );
  assert.match(prompt, /Why small batteries fail/);
  assert.match(prompt, /No text, use my attached photo/);
  assert(prompt.includes(skills[0].instructions));
  assert.match(prompt, /1280/);
  assert.match(prompt, /never guarantee/i);
});
test("empty, oversized, and invalid briefs are rejected before clipboard writes", () => {
  for (const brief of ["", "   ", null, 42, "x".repeat(2401)]) {
    assert.throws(() => buildPrompt(skills[0], brief));
  }
});
