import { useState } from "react";
import Modal from "./Modal";



export default function BlockEditor({ block, onSave, onClose }) {
  const [type, setType] = useState(block?.type || "Announcement");
  const [title, setTitle] = useState(block?.title || "");
  const [description, setDescription] = useState(block?.description || "");
  const [published, setPublished] = useState(block?.published || false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(block?.transcript || "");
  const [error, setError] = useState("");
  const existing = block?.type === "Learning material" ? block.resource : null;
  const video = file ? file.type.startsWith("video/") : existing?.kind === "video";
  function submit(event) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return setError("Enter a title and description.");
    if (type === "Learning material") {
      if (!file && !existing) return setError("Choose a PDF or video file.");
      if (file && (!(file.type === "application/pdf" || ["video/mp4", "video/webm"].includes(file.type)) || file.size > 100 * 1024 * 1024 || file.size === 0)) return setError("Choose a nonempty PDF, MP4, or WebM file up to 100 MB.");
      if (video && !transcript.trim()) return setError("Add a text transcript for the video.");
    }
    onSave({ type, title: title.trim(), description: description.trim(), published,
      transcript: type === "Learning material" && video ? transcript.trim() : "",
      resource: type === "Learning material" ? (file ? { url: URL.createObjectURL(file), name: file.name, kind: video ? "video" : "pdf" } : existing) : null,
    });
  }
  return <Modal title={block?.id ? "Edit content" : "Add content"} onClose={onClose}>
    <form onSubmit={submit}>
      <label htmlFor="block-type">Content type</label>
      <select id="block-type" value={type} onChange={e => { setType(e.target.value); setError(""); }}>
        {["Announcement", "Learning material"].map(value => <option key={value}>{value}</option>)}
      </select>
      <label htmlFor="block-title">Title</label>
      <input id="block-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required />
      <label htmlFor="block-description">Description</label>
      <textarea id="block-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} required />
      {type === "Learning material" && <>
        <label htmlFor="material-file">PDF or video file</label>
        <input id="material-file" type="file" accept="application/pdf,video/mp4,video/webm" onChange={e => { setFile(e.target.files[0] || null); setError(""); }} aria-describedby="material-help" />
        <p id="material-help" className="helper">PDF, MP4, or WebM · Up to 100 MB. Files stay in this browser session and are not uploaded to a server.</p>
        {existing && <p className="helper">Current file: {existing.name}. Choose a file only to replace it.</p>}
        {video && <><label htmlFor="video-transcript">Video transcript</label><textarea id="video-transcript" value={transcript} onChange={e => setTranscript(e.target.value)} rows={5} required /><p className="helper">Include spoken content and important visual information. Use captioned videos and accessible, selectable-text PDFs.</p></>}
      </>}
      <label className="checkbox-label"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />Visible to students</label>
      <p className="helper">Unchecked content stays a draft. Changes reset on refresh or sign out.</p>
      {error && <p role="alert" className="notice">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save content</button></div>
    </form>
  </Modal>;
}
