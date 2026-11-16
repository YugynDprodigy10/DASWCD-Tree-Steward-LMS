import { useState } from "react";
import Modal from "./Modal";
import { adminRequest } from "../admin/service";

export default function AdminModules({
  modules,
  instructors,
  user,
  onChange,
  onAssign,
  onNotice,
}) {
  const [editor, setEditor] = useState(null);
  const [audience, setAudience] = useState("Administrator");
  const visible = modules.filter(
    (module) =>
      audience === "Administrator" ||
      (audience === "Student"
        ? module.studentsVisible
        : module.instructorsVisible),
  );
  function save(values) {
    if (editor.id) {
      onChange(
        modules.map((module) =>
          module.id === editor.id ? { ...module, ...values } : module,
        ),
      );
    } else {
      onChange([
        ...modules,
        {
          ...values,
          id: Math.max(0, ...modules.map((module) => module.id)) + 1,
          studentsVisible: false,
          instructorsVisible: false,
        },
      ]);
    }
    onNotice(
      editor.id
        ? "Module details updated in this demo."
        : "Module added, hidden from both students and instructors until you release it.",
    );
    setEditor(null);
  }
  function toggle(module, field) {
    async function saveVisibility() {
      try {
        const updated = user?.getAccessTokenSilently
          ? (await adminRequest(
              user,
              `/admin/modules/${module.id}/visibility`,
              "PATCH",
              { [field]: !module[field] },
            )).module
          : { ...module, [field]: !module[field] };
        onChange(
          modules.map((item) => item.id === module.id ? { ...item, ...updated } : item),
        );
        onNotice(
          `${module.title} is now ${updated[field] ? "visible to" : "hidden from"} ${field === "studentsVisible" ? "all students" : "instructors"}${user?.getAccessTokenSilently ? "." : " in the module preview."}`,
        );
      } catch (error) {
        onNotice(error.message, true);
      }
    }
    saveVisibility();
  }
  return (
    <>
      <div className="module-management-toolbar">
        <div>
          <h2>Course modules</h2>
          <p className="muted">
            Review module visibility and assign instructors. These changes by
            signed-in admins are saved to the LMS; module details remain a preview.
          </p>
        </div>
        <button className="primary" onClick={() => setEditor({})}>
          + Add module
        </button>
      </div>
      <div className="audience-control">
        <label htmlFor="module-audience">Preview module visibility</label>
        <select
          id="module-audience"
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
        >
          <option>Administrator</option>
          <option>Student</option>
          <option>Instructor</option>
        </select>
        <p className="helper">
          {audience === "Administrator"
            ? "Administrators always see every module. Visibility does not grant editing permission."
            : `${audience} catalog preview: only modules released to this audience are listed.`}
        </p>
      </div>
      <p role="status" className="helper">
        {visible.length} of {modules.length} modules shown
      </p>
      <section className="admin-module-list" aria-label="Course modules">
        {visible.map((module) => (
          <article className="admin-panel" key={module.id}>
            <span className="eyebrow">
              MODULE {String(module.id).padStart(2, "0")}
            </span>
            <h2>{module.title}</h2>
            <p>{module.description || "No description yet."}</p>
            {audience === "Administrator" && (
              <>
                <fieldset className="visibility-controls">
                  <legend>Who can see this module?</legend>
                  <label>
                    <span>
                      All students
                      <small>
                        {module.studentsVisible ? "Visible" : "Hidden"}
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`Visible to students: ${module.title}`}
                      checked={module.studentsVisible}
                      onChange={() => toggle(module, "studentsVisible")}
                    />
                  </label>
                  <label>
                    <span>
                      Instructors
                      <small>
                        {module.instructorsVisible ? "Visible" : "Hidden"}
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`Visible to instructors: ${module.title}`}
                      checked={module.instructorsVisible}
                      onChange={() => toggle(module, "instructorsVisible")}
                    />
                  </label>
                </fieldset>
                <p className="helper">
                  Assigned instructors:{" "}
                  {
                    instructors
                    .filter((instructor) =>
                      user?.getAccessTokenSilently
                        ? (module.teacherIds || []).includes(instructor.id)
                        : instructor.modules.includes(module.id),
                    )
                    .map((instructor) => instructor.name)
                    .join(", ") || "None"
                  }
                </p>
                <div className="admin-actions">
                  <button
                    className="secondary"
                    onClick={() => setEditor(module)}
                  >
                    Edit module
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      onAssign(
                        module,
                        user?.getAccessTokenSilently
                          ? module.teacherIds || []
                          : instructors
                              .filter((instructor) =>
                                instructor.modules.includes(module.id),
                              )
                              .map((instructor) => instructor.id),
                      )
                    }
                  >
                    Assign instructors
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>
      {!visible.length && (
        <div className="empty-state">
          <h2>No modules released yet.</h2>
          <p>
            Switch back to Administrator to choose what this audience can see.
          </p>
        </div>
      )}
      {editor && (
        <ModuleEditor
          module={editor}
          existing={modules}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}

function ModuleEditor({ module, existing, onSave, onClose }) {
  const [title, setTitle] = useState(module.title || "");
  const [description, setDescription] = useState(module.description || "");
  const [error, setError] = useState("");
  return (
    <Modal
      title={module.id ? "Edit module" : "Add a course module"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError("Enter a module title.");
            return;
          }
          if (
            existing.some(
              (item) =>
                item.id !== module.id &&
                item.title.trim().toLowerCase() === title.trim().toLowerCase(),
            )
          ) {
            setError("A module with that title already exists.");
            return;
          }
          onSave({ title: title.trim(), description: description.trim() });
        }}
      >
        <label htmlFor="module-title">Module title</label>
        <input
          id="module-title"
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="module-description">Description</label>
        <textarea
          id="module-description"
          rows={4}
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {!module.id && (
          <p className="notice">
            New modules start hidden from students and instructors. Release them
            when you are ready.
          </p>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {module.id ? "Save module" : "Add module"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
