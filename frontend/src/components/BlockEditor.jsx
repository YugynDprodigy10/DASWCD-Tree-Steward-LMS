import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import LessonContent from "./LessonContent";
import { initialLessonContent, lessonSummary, sanitizeLessonHtml } from "../materials/content.js";
import { fileError, materialsApiEnabled, pdfError } from "../materials/service.js";

function TextBlockEditor({ block, onChange, onFocus }) {
  const editor = useRef(null);
  const startingHtml = useRef(block.html);
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = sanitizeLessonHtml(startingHtml.current);
  }, []);
  const runFormat = (command, value) => {
    editor.current?.focus();
    document.execCommand(command, false, value);
    onChange(sanitizeLessonHtml(editor.current?.innerHTML));
  };
  return <section className="lesson-text-editor" aria-label="Lesson text">
    <div className="lesson-format-toolbar" role="group" aria-label="Text formatting">
      <label>Format <select aria-label="Text style" defaultValue="p" onChange={(event) => runFormat("formatBlock", event.target.value)}>
        <option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option>
      </select></label>
      <button type="button" className="secondary" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("bold") }><strong>B</strong></button>
      <button type="button" className="secondary" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("italic")}><em>I</em></button>
      <button type="button" className="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("insertUnorderedList")}>Bulleted list</button>
      <button type="button" className="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("insertOrderedList")}>Numbered list</button>
    </div>
    <div ref={editor} className="lesson-text-input" contentEditable suppressContentEditableWarning role="textbox" aria-label="Lesson text editor" aria-multiline="true" onFocus={onFocus} onInput={() => onChange(sanitizeLessonHtml(editor.current?.innerHTML))} />
  </section>;
}

export default function BlockEditor({ block, user, onSave, onClose }) {
  const [type, setType] = useState(block?.type || "Announcement");
  const [title, setTitle] = useState(block?.title || "");
  const [description, setDescription] = useState(block?.description || "");
  const [published, setPublished] = useState(block?.published || false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(block?.transcript || "");
  const [content, setContent] = useState(() => initialLessonContent(block));
  const [activeTextId, setActiveTextId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef(null);
  const existing = block?.type === "Learning material" ? block.resource : null;
  const isMaterial = type === "Learning material";
  const legacyVideo = content.some((item) => item.type === "video") || file?.type.startsWith("video/") || existing?.kind === "video";
  const unavailable = Boolean(user) && isMaterial && !materialsApiEnabled;

  function updateText(id, html) {
    setContent((items) => items.map((item) => item.id === id ? { ...item, html } : item));
  }

  function addText(afterId) {
    const textBlock = { id: crypto.randomUUID(), type: "text", html: "<p></p>" };
    setContent((items) => {
      const index = items.findIndex((item) => item.id === afterId);
      return index < 0 ? [...items, textBlock] : [...items.slice(0, index + 1), textBlock, ...items.slice(index + 1)];
    });
    setActiveTextId(textBlock.id);
  }

  function addPdfs(files) {
    const selected = [...files];
    const invalid = selected.find((item) => pdfError(item));
    if (invalid) return setError(pdfError(invalid));
    const pdfs = selected.map((item) => ({ id: crypto.randomUUID(), type: "pdf", name: item.name, file: item }));
    setContent((items) => {
      const index = items.findIndex((item) => item.id === activeTextId);
      return index < 0 ? [...items, ...pdfs] : [...items.slice(0, index + 1), ...pdfs, ...items.slice(index + 1)];
    });
    setError("");
  }

  function moveContent(index, offset) {
    setContent((items) => {
      const destination = index + offset;
      if (destination < 0 || destination >= items.length) return items;
      const next = [...items];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || unavailable) return;
    setError("");
    if (!title.trim()) return setError("Enter a title for this lesson.");
    if (isMaterial) {
      if (legacyVideo) {
        const videoFile = file || (existing?.kind === "video" ? existing : null);
        if (file && fileError(file)) return setError(fileError(file));
        if (!videoFile || !transcript.trim()) return setError("Add the video transcript before saving.");
      } else if (!content.some((item) => item.type === "pdf" || (item.type === "text" && item.html.replace(/<[^>]*>/g, "").trim()))) {
        return setError("Add lesson text or a PDF before saving.");
      }
    } else if (!description.trim()) return setError("Enter a description.");
    setBusy(true);
    try {
      const summary = isMaterial ? lessonSummary(content) || description.trim() : description.trim();
      await onSave({
        id: block?.id, type, title: title.trim(), description: summary, published,
        transcript: isMaterial && legacyVideo ? transcript.trim() : "",
        resource: isMaterial ? existing : null,
        content: isMaterial ? content : undefined,
      }, isMaterial && legacyVideo ? file : null, setProgress);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={preview ? "Student preview" : block?.id ? "Edit content" : "Add content"} onClose={() => { if (!busy) onClose(); }}>
    {preview ? <div className="lesson-student-preview">
      <span className="eyebrow">LEARNING MATERIAL</span><h2>{title || "Untitled lesson"}</h2>
      <LessonContent content={content} fallbackResource={existing} fallbackTranscript={transcript} />
      <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setPreview(false)}>Back to editing</button></div>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="quiz-fields">
        <label htmlFor="block-type">Content type</label>
        <select id="block-type" disabled={Boolean(block?.id)} value={type} onChange={(event) => { setType(event.target.value); setError(""); }}>
          {["Announcement", "Learning material"].map((value) => <option key={value}>{value}</option>)}
        </select>
        <label htmlFor="block-title">Title</label>
        <input id="block-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} required />
        {isMaterial ? <>
          <p className="helper">Build the lesson in order. Add text, then insert a PDF wherever students should read it.</p>
          <div className="lesson-editor-content" aria-label="Ordered lesson content">
            {content.map((item, index) => <div className="lesson-editor-item" key={item.id || index}>
              <div className="lesson-item-actions">
                <span>{item.type === "text" ? "Text" : item.type === "video" ? "Video" : `PDF · ${item.name || "Document"}`}</span>
                <button type="button" className="text-button" disabled={index === 0} aria-label={`Move item ${index + 1} up`} onClick={() => moveContent(index, -1)}>Move up</button>
                <button type="button" className="text-button" disabled={index === content.length - 1} aria-label={`Move item ${index + 1} down`} onClick={() => moveContent(index, 1)}>Move down</button>
                <button type="button" className="text-button" aria-label={`Remove ${item.type === "pdf" ? item.name : item.type} item`} onClick={() => setContent((items) => items.filter((entry) => entry.id !== item.id))}>Remove</button>
              </div>
              {item.type === "text" ? <TextBlockEditor block={item} onChange={(html) => updateText(item.id, html)} onFocus={() => setActiveTextId(item.id)} /> : <LessonContent content={[item]} />}
              <button type="button" className="add-block lesson-add-text" onClick={() => addText(item.id)}>+ Add text after this</button>
            </div>)}
          </div>
          <input ref={fileInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { addPdfs(event.target.files || []); event.target.value = ""; }} aria-label="Choose PDF lesson files" />
          <div className="lesson-add-actions">
            <button type="button" className="secondary" onClick={() => addText()}>+ Add text</button>
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>Add File (PDF)</button>
          </div>
          {user ? <p className="helper">Shared lesson saving is unavailable until backend file storage is connected.</p> : <p className="helper">PDFs and lesson text are saved in this browser only; they are not shared with other users.</p>}
          {legacyVideo && <>
            <label htmlFor="legacy-video">Replace legacy video (optional)</label><input id="legacy-video" type="file" accept="video/mp4,video/webm" onChange={(event) => setFile(event.target.files[0] || null)} />
            <label htmlFor="video-transcript">Video transcript</label><textarea id="video-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} />
          </>}
        </> : <><label htmlFor="block-description">Description</label><textarea id="block-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required /></>}
        <label className="checkbox-label"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Visible to students</label>
        {busy && <div role="status"><p>{user && isMaterial ? progress === 100 ? "Upload sent. Waiting for confirmation…" : "Uploading…" : "Saving…"}</p><progress aria-label="File upload progress" max="100" value={progress ?? undefined} /></div>}
        {error && <p role="alert" className="notice">{error} You can retry without choosing the files again.</p>}
        <div className="dialog-actions">
          {isMaterial && <button type="button" className="secondary" onClick={() => setPreview(true)}>Preview</button>}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={unavailable}>{busy ? "Saving…" : error ? "Retry saving" : "Save content"}</button>
        </div>
      </fieldset>
    </form>}
  </Modal>;
}
