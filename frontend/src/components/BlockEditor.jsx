import { useState } from "react";
import Modal from "./Modal";
import { fileError, materialsApiEnabled } from "../materials/service.js";

export default function BlockEditor({ block, user, onSave, onClose }) {
  const [type, setType] = useState(block?.type || "Announcement");
  const [title, setTitle] = useState(block?.title || "");
  const [description, setDescription] = useState(block?.description || "");
  const [published, setPublished] = useState(block?.published || false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(block?.transcript || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const existing = block?.type === "Learning material" ? block.resource : null;
  const isMaterial = type === "Learning material";
  const video = file
    ? file.type.startsWith("video/")
    : existing?.kind === "video";
  const unavailable = Boolean(user) && isMaterial && !materialsApiEnabled;

  async function submit(event) {
    event.preventDefault();
    if (busy || unavailable) return;
    setError("");
    if (!title.trim() || !description.trim())
      return setError("Enter a title and description.");
    if (isMaterial) {
      if (!file && !existing) return setError("Choose a PDF or video file.");
      if (file && fileError(file)) return setError(fileError(file));
      if (video && !transcript.trim())
        return setError("Add a text transcript for the video.");
    }
    setBusy(true);
    try {
      await onSave(
        {
          id: block?.id,
          type,
          title: title.trim(),
          description: description.trim(),
          published,
          transcript: isMaterial && video ? transcript.trim() : "",
          resource: isMaterial ? existing : null,
        },
        isMaterial ? file : null,
        setProgress,
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={block?.id ? "Edit content" : "Add content"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="quiz-fields">
          <label htmlFor="block-type">Content type</label>
          <select
            id="block-type"
            disabled={Boolean(block?.id)}
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setError("");
            }}
          >
            {["Announcement", "Learning material"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <label htmlFor="block-title">Title</label>
          <input
            id="block-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={150}
            required
          />
          <label htmlFor="block-description">Description</label>
          <textarea
            id="block-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            required
          />
          {isMaterial && (
            <>
              <label htmlFor="material-file">PDF or video file</label>
              <input
                id="material-file"
                type="file"
                accept="application/pdf,video/mp4,video/webm"
                disabled={unavailable}
                onChange={(event) => {
                  setFile(event.target.files[0] || null);
                  setError("");
                }}
                aria-describedby="material-help"
              />
              <p id="material-help" className="helper">
                PDF, MP4, or WebM · Up to 100 MB.
              </p>
              <p className="helper">
                {user
                  ? materialsApiEnabled
                    ? "Files are uploaded to course storage."
                    : "Shared uploads need backend support. File saving is unavailable for this account."
                  : "Demo files are saved only in this browser, including after refresh. They are not shared with other users."}
              </p>
              {(file || existing) && <p>File: {file?.name || existing.name}</p>}
              {video && (
                <>
                  <label htmlFor="video-transcript">Video transcript</label>
                  <textarea
                    id="video-transcript"
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    rows={5}
                    required
                  />
                  <p className="helper">
                    Include spoken content and important visual information. Use
                    captioned videos and selectable-text PDFs.
                  </p>
                </>
              )}
            </>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Visible to students
          </label>
          {busy && (
            <div role="status">
              <p>
                {user && isMaterial
                  ? progress === 100
                    ? "Upload sent. Waiting for confirmation…"
                    : "Uploading…"
                  : "Saving…"}
              </p>
              <progress
                aria-label="File upload progress"
                max="100"
                value={progress ?? undefined}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="notice">
              {error} You can retry without choosing the file again.
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={unavailable}>
              {busy ? "Saving…" : error ? "Retry saving" : "Save content"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
