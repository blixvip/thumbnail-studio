const api = window.thumbnail;
const $ = (s) => document.querySelector(s);
let library = { images: [], sources: [] },
  limit = 60,
  onlyFavorites = false,
  open = true,
  panel = "references";
let skills = [],
  selectedSkill = null,
  category = "All";
let favorites;
try {
  favorites = new Set(
    JSON.parse(localStorage.getItem("thumbnail-favorites") || "[]"),
  );
} catch {
  favorites = new Set();
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function notice(text, kind = "") {
  const el = $("#notice");
  el.textContent = text;
  el.className = `panel-foot ${kind}`;
}
async function copy(item, button) {
  button.disabled = true;
  try {
    const result = await api.copy(item.id);
    if (!result.ok) throw new Error(result.message);
    document
      .querySelectorAll(".copied")
      .forEach((el) => el.classList.remove("copied"));
    button.classList.add("copied");
    notice(
      "Copied. Click the ChatGPT message box and press Ctrl+V.",
      "success",
    );
  } catch (error) {
    notice(
      error.message || "Could not copy this image. Try another reference.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
}
function card(item) {
  const article = node("article", "", "card"),
    image = node("button", "", "image");
  const source = item.sources?.[0] || { name: "Reference" };
  image.setAttribute("aria-label", `Copy reference from ${source.name}`);
  image.title = "Copy image";
  const img = node("img");
  img.src = `thumbnail://local/media/${item.preview}`;
  img.alt = item.alt || source.name;
  img.loading = "lazy";
  img.decoding = "async";
  image.append(img);
  image.onclick = () => copy(item, image);
  const meta = node("div", "", "card-bottom"),
    label = node("button", source.name, "source-link");
  label.title = `View source: ${source.name}`;
  label.onclick = () => api.external(source.page);
  const favorite = node(
    "button",
    favorites.has(item.id) ? "♥" : "♡",
    "favorite",
  );
  favorite.setAttribute("aria-label", `Favorite reference from ${source.name}`);
  favorite.setAttribute("aria-pressed", String(favorites.has(item.id)));
  favorite.onclick = () => {
    favorites.has(item.id) ? favorites.delete(item.id) : favorites.add(item.id);
    try {
      localStorage.setItem(
        "thumbnail-favorites",
        JSON.stringify([...favorites]),
      );
    } catch {}
    render();
  };
  meta.append(label, favorite);
  article.append(image, meta);
  return article;
}
function render() {
  const search = $("#search").value.trim().toLowerCase(),
    source = $("#source").value;
  const items = library.images.filter(
    (item) =>
      (!$("#thumbnails").checked || item.kind === "thumbnail") &&
      (!onlyFavorites || favorites.has(item.id)) &&
      (!source || item.sources.some((s) => s.name === source)) &&
      (!search ||
        `${item.alt || ""} ${item.sources.map((s) => s.name).join(" ")}`
          .toLowerCase()
          .includes(search)),
  );
  $("#gallery").replaceChildren(...items.slice(0, limit).map(card));
  $("#gallery").setAttribute("aria-busy", "false");
  $("#count").textContent = `${items.length.toLocaleString()} references`;
  $("#more").hidden = items.length <= limit;
  $("#empty").hidden = items.length > 0;
  $("#empty-title").textContent = library.images.length
    ? "No references found."
    : "Your library is empty.";
  $("#empty-detail").textContent = library.images.length
    ? "Try another search, source, or filter."
    : "Your imported references will appear here.";
}
function chatStatus(state) {
  document.body.classList.toggle("has-chat", state.status === "ready");
  $("#chat-state").hidden = state.status === "error";
  $("#chat-error").hidden = state.status !== "error";
  if (state.message) notice(state.message);
}
async function selectPanel(next) {
  open = panel === next ? !open : true;
  panel = next;
  document.body.classList.toggle("collapsed", !open);
  $("#toggle").setAttribute(
    "aria-pressed",
    String(open && panel === "references"),
  );
  $("#skills-toggle").setAttribute(
    "aria-pressed",
    String(open && panel === "skills"),
  );
  $("#reference-panel").hidden = panel !== "references";
  $("#skills-panel").hidden = panel !== "skills";
  notice(
    panel === "skills"
      ? "A focused workflow, ready for your next thumbnail."
      : "Copy an image, then paste it into ChatGPT.",
  );
  await api.references(open);
}
$("#toggle").onclick = () => selectPanel("references");
$("#skills-toggle").onclick = () => selectPanel("skills");
$("#search").oninput = () => {
  limit = 60;
  render();
};
$("#source").onchange = $("#thumbnails").onchange = () => {
  limit = 60;
  render();
};
$("#favorites").onclick = () => {
  onlyFavorites = !onlyFavorites;
  $("#favorites").setAttribute("aria-pressed", String(onlyFavorites));
  limit = 60;
  render();
};
$("#more").onclick = () => {
  limit += 60;
  render();
};
$("#new").onclick = () => api.chat("new");
$("#reload").onclick = $("#retry").onclick = () => api.chat("reload");
$("#browser").onclick = () => api.chat("browser");
api.onStatus(chatStatus);
api.status().then(chatStatus);
for (let i = 0; i < 8; i++) $("#gallery").append(node("div", "", "skeleton"));
api
  .library()
  .then((result) => {
    if (result.error) throw new Error(result.error);
    library = result;
    for (const source of library.sources) {
      const option = node("option", source.name);
      option.value = source.name;
      $("#source").append(option);
    }
    render();
  })
  .catch((error) => {
    $("#gallery").replaceChildren();
    $("#gallery").setAttribute("aria-busy", "false");
    $("#count").textContent = "Library unavailable";
    $("#empty").hidden = false;
    $("#empty-title").textContent = "Could not load references.";
    $("#empty-detail").textContent = "Reopen Thumbnail Studio to try again.";
    notice(error.message, "error");
  });

function renderSkills() {
  $("#skill-list").replaceChildren(
    ...skills
      .filter((skill) => category === "All" || skill.category === category)
      .map((skill) => {
        const button = node("button", "", "skill-card");
        button.dataset.skill = skill.id;
        const text = node("span", "", "skill-copy");
        text.append(
          node("strong", skill.title),
          node("span", skill.description),
        );
        const arrow = node("span", "↗", "skill-arrow");
        arrow.setAttribute("aria-hidden", "true");
        button.append(text, arrow);
        button.onclick = () => chooseSkill(skill);
        return button;
      }),
  );
}
function updateBrief() {
  const brief = $("#video-brief").value;
  $("#brief-count").textContent = `${brief.length.toLocaleString()} / 2,400`;
  $("#copy-skill").disabled = !selectedSkill || !brief.trim();
  $("#copy-skill").textContent = "Copy prompt";
  $("#prompt-preview").hidden = true;
  try {
    localStorage.setItem("thumbnail-design-brief", brief);
  } catch {}
}
function chooseSkill(skill) {
  selectedSkill = skill;
  $("#skill-browser").hidden = true;
  $("#skill-detail").hidden = false;
  $("#skill-category").textContent = skill.category;
  $("#skill-title").textContent = skill.title;
  $("#skill-description").textContent = skill.description;
  $("#skill-instructions").replaceChildren(
    ...skill.instructions.split(/\n\s*\n/).map((text) => node("p", text)),
  );
  $("#references").scrollTop = 0;
  updateBrief();
  $("#video-brief").focus({ preventScroll: true });
}
$("#back-skills").onclick = () => {
  $("#skill-detail").hidden = true;
  $("#skill-browser").hidden = false;
  $("#references").scrollTop = 0;
};
$("#video-brief").oninput = updateBrief;
try {
  $("#video-brief").value = (
    localStorage.getItem("thumbnail-design-brief") || ""
  ).slice(0, 2400);
} catch {}
$("#copy-skill").onclick = async () => {
  const button = $("#copy-skill");
  button.disabled = true;
  button.textContent = "Preparing…";
  try {
    const result = await api.skillPrompt(
      selectedSkill.id,
      $("#video-brief").value,
      true,
    );
    if (!result.ok) throw new Error(result.message);
    $("#prepared-prompt").value = result.prompt;
    $("#prompt-preview").hidden = false;
    button.textContent = "Copied — paste in ChatGPT";
    notice("Prompt copied. Paste into ChatGPT with Ctrl+V.", "success");
  } catch (error) {
    button.textContent = "Try copying again";
    notice(
      error.message || "Could not prepare the prompt. Try again.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
};
document.querySelectorAll("[data-category]").forEach(
  (button) =>
    (button.onclick = () => {
      category = button.dataset.category;
      document
        .querySelectorAll("[data-category]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      renderSkills();
    }),
);
async function loadSkills() {
  $("#skill-loading").hidden = false;
  $("#skill-loading").textContent = "Loading design skills…";
  $("#retry-skills").hidden = true;
  try {
    skills = await api.skills();
    renderSkills();
    $("#skill-loading").hidden = true;
  } catch {
    $("#skill-loading").textContent = "Could not load design skills.";
    $("#retry-skills").hidden = false;
  }
}
$("#retry-skills").onclick = loadSkills;
loadSkills();
