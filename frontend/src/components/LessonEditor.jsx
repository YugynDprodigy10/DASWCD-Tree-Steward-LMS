import { useEffect, useRef, useState } from "react";
import LessonContent from "./LessonContent";
import {
  initialLessonContent,
  lessonSummary,
  sanitizeLessonHtml,
} from "../materials/content.js";
import { fileError, materialsApiEnabled, pdfError } from "../materials/service.js";

const newText = () => ({ id: crypto.randomUUID(), type: "text", html: "<p></p>" });

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function TextSection({ item, autoFocus, onChange }) {
  const editor = useRef(null);
  const startingHtml = useRef(item.html);
  useEffect(() => {
    if (!editor.current) return;
    editor.current.innerHTML = sanitizeLessonHtml(startingHtml.current);
    if (autoFocus) editor.current.focus();
  }, [autoFocus]);

  const save = () => onChange(sanitizeLessonHtml(editor.current?.innerHTML));
  const format = (command, value) => {
    editor.current?.focus();
    document.execCommand(command, false, value);
    save();
  };
  // Pasting from Word or a website brings hidden formatting, so paste plain text only.
  const pastePlainText = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const html = text
      .split(/\r?\n\r?\n+/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`)
      .join("");
    document.execCommand("insertHTML", false, html);
    save();
  };
  const keepFocus = (event) => event.preventDefault();

  return (
    <div className="lesson-text-editor">
      <div className="lesson-format-toolbar" role="group" aria-label="Text formatting">
        <label>
          Style
          <select defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}>
            <option value="p">Normal text</option>
            <option value="h2">Heading</option>
            <option value="h3">Smaller heading</option>
          </select>
        </label>
        <button type="button" className="secondary" onMouseDown={keepFocus} onClick={() => format("bold")}>
          <strong>Bold</strong>
        </button>
        <button type="button" className="secondary" onMouseDown={keepFocus} onClick={() => format("italic")}>
          <em>Italic</em>
        </button>
        <button type="button" className="secondary" onMouseDown={keepFocus} onClick={() => format("insertUnorderedList")}>
          Bulleted list
        </button>
        <button type="button" className="secondary" onMouseDown={keepFocus} onClick={() => format("insertOrderedList")}>
          Numbered list
        </button>
      </div>
      <div
        ref={editor}
        className="lesson-text-input"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Lesson text"
        aria-multiline="true"
        onInput={save}
        onPaste={pastePlainText}
      />
    </div>
  );
}

function AddBar({ label, onAddText, onAddPdf }) {
  return (
    <div className="lesson-add-bar" role="group" aria-label={label}>
      <button type="button" className="secondary" onClick={onAddText}>+ Add text</button>
      <button type="button" className="secondary" onClick={onAddPdf}>+ Add PDF</button>
    </div>
  );
}

// A full-page editor for learning materials. A lesson is an ordered list of
// text sections and PDFs; instructors add, reorder, and remove items, then
// save it as a draft or publish it to students.
export default function LessonEditor({ block, user, onSave, onClose }) {
  const isNew = !block?.id;
  const [title, setTitle] = useState(block?.title || "");
  const [content, setContent] = useState(() => {
    const existing = initialLessonContent(block);
    return existing.length ? existing : [newText()];
  });
  const [focusId, setFocusId] = useState(null);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(block?.transcript || "");
  const [removed, setRemoved] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef(null);
  const insertAfter = useRef(null);
  const heading = useRef(null);

  const existingResource = block?.resource || null;
  const legacyVideo =
    content.some((item) => item.type === "video") || existingResource?.kind === "video";
  const unavailable = Boolean(user) && !materialsApiEnabled;
  const wasPublished = Boolean(block?.published);

  useEffect(() => {
    heading.current?.focus();
  }, [preview]);

  function insertItems(afterId, items) {
    setContent((current) => {
      if (afterId === "start") return [...items, ...current];
      const index = current.findIndex((item) => item.id === afterId);
      return index < 0
        ? [...current, ...items]
        : [...current.slice(0, index + 1), ...items, ...current.slice(index + 1)];
    });
  }

  function addText(afterId) {
    const item = newText();
    insertItems(afterId, [item]);
    setFocusId(item.id);
  }

  function choosePdf(afterId) {
    insertAfter.current = afterId;
    fileInput.current?.click();
  }

  function addPdfs(files) {
    const selected = [...files];
    const invalid = selected.find((item) => pdfError(item));
    if (invalid) return setError(pdfError(invalid));
    insertItems(
      insertAfter.current,
      selected.map((item) => ({ id: crypto.randomUUID(), type: "pdf", name: item.name, file: item })),
    );
    setError("");
  }

  function move(index, offset) {
    setContent((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  function remove(index) {
    setRemoved({ item: content[index], index });
    setContent((current) => current.filter((_, position) => position !== index));
  }

  function undoRemove() {
    if (!removed) return;
    setContent((current) => [
      ...current.slice(0, removed.index),
      removed.item,
      ...current.slice(removed.index),
    ]);
    setRemoved(null);
  }

  async function save(published) {
    if (busy || unavailable) return;
    setError("");
    if (!title.trim()) return setError("Give the lesson a title.");
    const hasText = content.some(
      (item) => item.type === "text" && item.html.replace(/<[^>]*>/g, "").trim(),
    );
    const hasPdf = content.some((item) => item.type === "pdf");
    if (legacyVideo) {
      if (file && fileError(file)) return setError(fileError(file));
      if (!transcript.trim()) return setError("Add the video transcript before saving.");
    } else if (!hasText && !hasPdf) {
      return setError("Add some lesson text or a PDF before saving.");
    }
    setBusy(true);
    try {
      await onSave(
        {
          id: block?.id,
          type: "Learning material",
          title: title.trim(),
          description: lessonSummary(content) || block?.description || "",
          published,
          transcript: legacyVideo ? transcript.trim() : "",
          resource: existingResource,
          content,
        },
        legacyVideo ? file : null,
        setProgress,
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <section className="lesson-page" aria-labelledby="lesson-page-title">
        <p className="lesson-preview-banner">This is what students will see.</p>
        <h1 id="lesson-page-title" ref={heading} tabIndex={-1}>
          {title || "Untitled lesson"}
        </h1>
        <LessonContent content={content} fallbackResource={existingResource} fallbackTranscript={transcript} />
        <div className="lesson-save-bar">
          <button type="button" className="primary" onClick={() => setPreview(false)}>
            Back to editing
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="lesson-page" aria-labelledby="lesson-page-title" aria-busy={busy}>
      <button type="button" className="text-button" disabled={busy} onClick={onClose}>
        ← Back without saving
      </button>
      <h1 id="lesson-page-title" ref={heading} tabIndex={-1}>
        {isNew ? "New learning material" : "Edit learning material"}
      </h1>
      <p className="lesson-help">
        Write your lesson below. Use the buttons between sections to add more text or a PDF exactly where students
        should read it.
      </p>

      <label className="lesson-title-label" htmlFor="lesson-title">Lesson title</label>
      <input
        id="lesson-title"
        className="lesson-title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={150}
        disabled={busy}
      />

      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        aria-label="Choose PDF files"
        onChange={(event) => {
          addPdfs(event.target.files || []);
          event.target.value = "";
        }}
      />

      <fieldset className="lesson-sections" disabled={busy}>
        <legend className="visually-hidden">Lesson sections, in the order students will see them</legend>
        <AddBar label="Add at the beginning" onAddText={() => addText("start")} onAddPdf={() => choosePdf("start")} />
        {content.map((item, index) => (
          <div key={item.id} className="lesson-section-wrap">
            <div className="lesson-editor-item">
              <div className="lesson-item-actions">
                <span>
                  Section {index + 1}:{" "}
                  {item.type === "text" ? "Text" : item.type === "video" ? "Video" : `PDF – ${item.name || "Document"}`}
                </span>
                <button type="button" className="text-button" disabled={index === 0} onClick={() => move(index, -1)}>
                  Move up
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={index === content.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Move down
                </button>
                <button type="button" className="text-button" onClick={() => remove(index)}>
                  Remove
                </button>
              </div>
              {item.type === "text" ? (
                <TextSection
                  item={item}
                  autoFocus={focusId === item.id}
                  onChange={(html) =>
                    setContent((current) => current.map((entry) => (entry.id === item.id ? { ...entry, html } : entry)))
                  }
                />
              ) : (
                <LessonContent content={[item]} />
              )}
            </div>
            <AddBar
              label={`Add after section ${index + 1}`}
              onAddText={() => addText(item.id)}
              onAddPdf={() => choosePdf(item.id)}
            />
          </div>
        ))}
      </fieldset>

      {removed && (
        <p role="status" className="lesson-undo">
          Section removed.{" "}
          <button type="button" className="text-button" onClick={undoRemove}>
            Undo
          </button>
        </p>
      )}

      {legacyVideo && (
        <div className="lesson-legacy-video">
          <label htmlFor="legacy-video">Replace the video (optional)</label>
          <input
            id="legacy-video"
            type="file"
            accept="video/mp4,video/webm"
            onChange={(event) => setFile(event.target.files[0] || null)}
          />
          <label htmlFor="video-transcript">Video transcript</label>
          <textarea id="video-transcript" rows={4} value={transcript} onChange={(event) => setTranscript(event.target.value)} />
        </div>
      )}

      <p className="lesson-help">
        {unavailable
          ? "Saving lessons for signed-in accounts will be available once file storage is connected."
          : "In this demo, lessons are saved in this browser only."}
      </p>

      <div className="lesson-save-bar">
        {busy && (
          <div role="status" className="lesson-saving">
            {progress === 100 ? "Upload sent. Waiting for confirmation…" : "Saving…"}
            <progress aria-label="Upload progress" max="100" value={progress ?? undefined} />
          </div>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <div className="lesson-save-buttons">
          <button type="button" className="secondary" disabled={busy} onClick={() => setPreview(true)}>
            Preview
          </button>
          <button type="button" className="secondary" disabled={busy || unavailable} onClick={() => save(false)}>
            {wasPublished ? "Unpublish and save as draft" : "Save as draft"}
          </button>
          <button type="button" className="primary" disabled={busy || unavailable} onClick={() => save(true)}>
            {wasPublished ? "Save changes" : "Publish to students"}
          </button>
        </div>
      </div>
    </section>
  );
}
