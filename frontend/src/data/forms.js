export function isGoogleForm(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ((url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")) ||
       (url.hostname === "forms.gle" && url.pathname.length > 1));
  } catch { return false; }
}

