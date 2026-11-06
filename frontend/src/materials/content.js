const allowedTags = new Set(["P", "BR", "H2", "H3", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI"]);

export function sanitizeLessonHtml(html) {
  if (typeof DOMParser === "undefined") {
    return String(html || "")
      .replace(/<\s*(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
      .replace(/<(\/?)([a-z\d]+)\b[^>]*>/gi, (tag, closing, name) =>
        allowedTags.has(name.toUpperCase()) ? `<${closing}${name.toLowerCase()}>` : "",
      );
  }
  const document = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const root = document.body.firstElementChild;
  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== 1) continue;
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(child.tagName)) {
        child.remove();
      } else if (!allowedTags.has(child.tagName)) {
        clean(child);
        child.replaceWith(...child.childNodes);
      } else {
        [...child.attributes].forEach((attribute) => child.removeAttribute(attribute.name));
        clean(child);
      }
    }
  };
  clean(root);
  return root.innerHTML;
}

export function plainTextHtml(text) {
  return String(text || "").split(/\n+/).map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`).join("");
}

export function initialLessonContent(block) {
  if (block?.content?.length) return block.content;
  const content = [];
  if (block?.description?.trim()) content.push({ id: crypto.randomUUID(), type: "text", html: plainTextHtml(block.description) });
  if (block?.resource) content.push({ id: crypto.randomUUID(), type: block.resource.kind === "video" ? "video" : "pdf", name: block.resource.name, url: block.resource.url, blob: block.resource.blob, resource: block.resource, transcript: block.transcript || "" });
  return content;
}

export function lessonSummary(content) {
  const firstText = sanitizeLessonHtml(content.find((item) => item.type === "text")?.html || "");
  return firstText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function storedLessonContent(content) {
  return content.map((item) => {
    if (item.type === "text") return { id: item.id || crypto.randomUUID(), type: "text", html: sanitizeLessonHtml(item.html) };
    if (item.type === "pdf") return { id: item.id || crypto.randomUUID(), type: "pdf", name: item.name || item.file?.name, file: item.file, blob: item.blob };
    if (item.type === "video") return {
      id: item.id || crypto.randomUUID(), type: "video", name: item.name || item.resource?.name,
      transcript: item.transcript || "", resource: item.resource?.blob ? { name: item.resource.name, kind: "video", blob: item.resource.blob } : undefined,
    };
    return item;
  });
}
