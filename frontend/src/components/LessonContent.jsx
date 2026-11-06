import { useEffect, useMemo } from "react";
import { sanitizeLessonHtml } from "../materials/content.js";

function InlinePdf({ item }) {
  const url = useMemo(() => item.file ? URL.createObjectURL(item.file) : item.url || item.resource?.url || "", [item.file, item.url, item.resource?.url]);
  useEffect(() => {
    if (!item.file || !url) return undefined;
    return () => URL.revokeObjectURL(url);
  }, [item.file, url]);
  if (!url) return <p className="notice">PDF preview is unavailable.</p>;
  return (
    <figure className="lesson-pdf">
      <figcaption>{item.name || item.file?.name || "Lesson PDF"}</figcaption>
      <iframe title={`PDF preview: ${item.name || item.file?.name || "lesson document"}`} src={url} />
      <a href={url} target="_blank" rel="noreferrer">Open PDF in a new tab</a>
    </figure>
  );
}

export default function LessonContent({ content = [], fallbackResource, fallbackTranscript }) {
  const items = content.length ? content : fallbackResource ? [{ type: fallbackResource.kind === "video" ? "video" : "pdf", resource: fallbackResource, transcript: fallbackTranscript }] : [];
  if (!items.length) return <p className="notice">Your instructor has not added lesson content yet.</p>;
  return <div className="lesson-content">{items.map((item, index) => {
    if (item.type === "text") return <div className="lesson-text" key={item.id || index} dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(item.html) }} />;
    if (item.type === "video") return <div className="lesson-video" key={item.id || index}>
      <video controls preload="metadata" aria-label="Lesson video" src={item.url || item.resource?.url} />
      {item.transcript && <><h3>Transcript</h3><p className="detail-copy">{item.transcript}</p></>}
    </div>;
    return <InlinePdf key={item.id || index} item={item} />;
  })}</div>;
}
