const AUTH_HOSTS = new Set([
  "chatgpt.com",
  "www.chatgpt.com",
  "chat.openai.com",
  "auth.openai.com",
  "auth0.openai.com",
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "appleid.apple.com",
]);
exports.isChatNavigation = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && AUTH_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};
exports.chatBounds = (width, height, references) => ({
  x: references && width >= 760 ? 340 : 0,
  y: 60,
  width: Math.max(1, width - (references && width >= 760 ? 340 : 0)),
  height: Math.max(1, height - 60),
  visible: !(references && width < 760),
});
exports.mediaPath = (value, known) =>
  typeof value === "string" &&
  /^(images|previews)\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(value) &&
  known.has(value)
    ? value
    : null;
