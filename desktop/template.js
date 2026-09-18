// Thumbnail template: your photo (top right), the chat message under it, and the result image
// (bottom left) on black, drawn at 1920×1080 for YouTube. Shown in place of ChatGPT.
(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.thumbnail;
  const canvas = $("tpl-canvas"), ctx = canvas.getContext("2d");
  const W = 1920, H = 1080, FONT = "'Segoe UI', Arial, sans-serif";

  // Layout measured from the reference and scaled to 1080 tall.
  const PHOTO = { x: 1315, y: 69, w: 565, h: 317, r: 34 };
  const RESULT = { x: 31, y: 536, w: 905, h: 509, r: 38 };
  const BUBBLE = { right: 1880, top: 393, maxWidth: 800, pad: 22, line: 35, size: 22.5, r: 26, extra: 100 };

  const state = { photo: null, result: null, prompt: $("tpl-prompt").value };
  let target = "photo", open = false;

  function roundedImage(image, box, label) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, box.r);
    ctx.clip();
    if (image) {
      // Cover the slot, centred.
      const scale = Math.max(box.w / image.width, box.h / image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    } else {
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = "#6f6f6f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(`+  ${label}`, box.x + box.w / 2, box.y + box.h / 2);
    }
    ctx.restore();
  }

  // Wrap at spaces; a word wider than the bubble is broken across lines.
  function wrap(text, width) {
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (let word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= width) { line = next; continue; }
        if (line) lines.push(line);
        while (ctx.measureText(word).width > width) {
          let cut = word.length - 1;
          while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > width) cut--;
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        line = word;
      }
      lines.push(line);
    }
    return lines;
  }

  // The small "Create image" picture icon.
  function imageIcon(x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * 0.24);
    const sky = ctx.createLinearGradient(x, y, x + size, y + size);
    sky.addColorStop(0, "#9fd8ff");
    sky.addColorStop(1, "#4f9ff0");
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(x + size * 0.34, y + size * 0.34, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size * 0.42, y + size * 0.52);
    ctx.lineTo(x + size * 0.66, y + size * 0.74);
    ctx.lineTo(x + size * 0.8, y + size * 0.62);
    ctx.lineTo(x + size, y + size * 0.85);
    ctx.lineTo(x + size, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Right-aligned under your photo, as wide and tall as the message needs.
  function bubble(text) {
    const { right, top, maxWidth, pad, line, size, r, extra } = BUBBLE;
    ctx.font = `400 ${size}px ${FONT}`;
    const lines = wrap(text.trim() || " ", maxWidth - pad * 2);
    const longest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.font = `600 ${size}px ${FONT}`;
    const chip = size + 10 + ctx.measureText("Create image").width;
    const width = Math.min(maxWidth, Math.max(longest, chip) + pad * 2 + extra);
    const height = pad * 2 + line * (lines.length + 1) - 6;
    const x = right - width;
    ctx.fillStyle = "#303030";
    ctx.beginPath();
    ctx.roundRect(x, top, width, height, r);
    ctx.fill();
    ctx.fillStyle = "#ececec";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${size}px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, x + pad, top + pad + line * i + line / 2 - 3));
    const chipY = top + pad + line * lines.length + line / 2 - 3;
    imageIcon(x + pad, chipY - size / 2, size);
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Create image", x + pad + size + 10, chipY);
  }

  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    roundedImage(state.photo, PHOTO, "Your photo");
    bubble(state.prompt);
    roundedImage(state.result, RESULT, "Result image");
  }

  // Click targets sit exactly over the two pictures.
  for (const [id, box] of [["tpl-slot-photo", PHOTO], ["tpl-slot-result", RESULT]]) {
    Object.assign($(id).style, {
      left: `${(box.x / W) * 100}%`, top: `${(box.y / H) * 100}%`,
      width: `${(box.w / W) * 100}%`, height: `${(box.h / H) * 100}%`,
    });
  }

  async function load(file, slot) {
    if (!file || !file.type.startsWith("image/")) return;
    const image = await createImageBitmap(file).catch(() => null);
    if (!image) return;
    state[slot] = image;
    render();
  }
  const choose = (slot) => { target = slot; $("tpl-file").click(); };
  $("tpl-file").onchange = (e) => { load(e.target.files[0], target); e.target.value = ""; };
  for (const [slot, ids] of [["photo", ["tpl-slot-photo", "tpl-pick-photo"]], ["result", ["tpl-slot-result", "tpl-pick-result"]]]) {
    for (const id of ids) $(id).onclick = () => choose(slot);
    const zone = $(`tpl-slot-${slot}`);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("dragging"); };
    zone.ondragleave = () => zone.classList.remove("dragging");
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("dragging"); load(e.dataTransfer.files[0], slot); };
  }
  // Pasting (e.g. a copied reference) fills your photo first, then the result.
  addEventListener("paste", (e) => {
    if (!open) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    load(file, !state.photo ? "photo" : "result");
  });

  const prompt = $("tpl-prompt");
  const fit = () => { prompt.style.height = "auto"; prompt.style.height = `${prompt.scrollHeight + 2}px`; };
  prompt.oninput = () => { state.prompt = prompt.value; fit(); render(); };

  $("tpl-download").onclick = async () => {
    render();
    // PNG when it fits YouTube's 2 MB limit, otherwise a high-quality JPG.
    let blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    let ext = "png";
    if (blob.size > 2 * 1024 * 1024) { blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.94)); ext = "jpg"; }
    const name = state.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "thumbnail";
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${name}.${ext}` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  };

  $("template-toggle").onclick = async () => {
    open = !open;
    document.body.classList.toggle("template-open", open);
    $("template").hidden = !open;
    $("template-toggle").setAttribute("aria-pressed", String(open));
    if (open) { fit(); render(); }
    await api.template(open);
  };

  render();
})();
