import { useState } from "react";
import Modal from "./Modal";

// Edits an announcement. Learning materials use the full-page LessonEditor.
export default function BlockEditor({ block, onSave, onClose }) {
  const [title, setTitle] = useState(block?.title || "");
  const [description, setDescription] = useState(block?.description || "");
  const [published, setPublished] = useState(block?.published || false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!title.trim()) return setError("Enter a title.");
    if (!description.trim()) return setError("Enter the announcement text.");
    setBusy(true);
    try {
      await onSave({ id: block?.id, type: "Announcement", title: title.trim(), description: description.trim(), published });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={block?.id ? "Edit announcement" : "New announcement"} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="quiz-fields">
          <label htmlFor="block-title">Title</label>
          <input id="block-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} required />
          <label htmlFor="block-description">Announcement</label>
          <textarea id="block-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} required />
          <label className="checkbox-label">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
            Visible to students
          </label>
          {error && <p role="alert" className="notice">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">{busy ? "Saving…" : "Save announcement"}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
