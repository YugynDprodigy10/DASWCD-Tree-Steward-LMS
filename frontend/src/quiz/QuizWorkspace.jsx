import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import {
  demoDelete,
  demoQuizzes,
  demoSave,
  quizRequest,
} from "./service";
import "./quiz.css";
import QuestionEditor from "./QuestionEditor.jsx";
import RetakeSettings from "./RetakeSettings.jsx";

// Creates a new quiz, or edits the quiz with openQuizId.
export default function QuizWorkspace({
  moduleId,
  user,
  canEdit,
  openQuizId = null,
  onCreated,
  onBack,
  onDone,
  onDeleted,
  onPreview,
}) {
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(openQuizId));
  useEffect(() => {
    if (!openQuizId) return;
    let active = true;
    (async () => {
      try {
        const q = user
          ? (await quizRequest(user, `/quizzes/${openQuizId}`)).quiz
          : demoQuizzes().find(
              (item) => String(item.id) === String(openQuizId),
            );
        if (!q) throw new Error("Quiz not found.");
        if (active) {
          setSelected(q);
          setTitle(q.title);
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [openQuizId, user]);
  async function run(action) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function updateQuestion(value) {
    await run(async () => {
      let next;
      if (user)
        next = (
          await quizRequest(
            user,
            `/quizzes/${selected.id}/questions${editing.question ? `/${editing.question.id}` : ""}`,
            editing.question ? "PUT" : "POST",
            value,
          )
        ).quiz;
      else {
        if (demoQuizzes().find((q) => q.id === selected.id)?.locked)
          throw new Error("Questions are locked after a demo submission.");
        const q = {
          ...value,
          id: value.id || crypto.randomUUID(),
          choices: value.choices.map((c) => ({
            ...c,
            id: c.id || crypto.randomUUID(),
          })),
        };
        next = demoSave({
          ...selected,
          questions: editing.question
            ? selected.questions.map((item) => (item.id === q.id ? q : item))
            : [...selected.questions, q],
        });
      }
      setSelected(next);
      setEditing(null);
      setNotice("Question saved.");
    });
  }
  function createQuiz(event) {
    event.preventDefault();
    if (!title.trim()) return;
    run(async () => {
      const q = user
        ? (
            await quizRequest(user, `/modules/${moduleId}/quizzes`, "POST", {
              title: title.trim(),
            })
          ).quiz
        : demoSave({
            id: crypto.randomUUID(),
            moduleId,
            title: title.trim(),
            published: false,
            maxAttempts: 1,
            attempts: [],
            questions: [],
            order:
              Math.max(
                0,
                ...demoQuizzes()
                  .filter((item) => item.moduleId === moduleId)
                  .map((item) => item.order ?? 0),
              ) + 1,
          });
      setSelected(q);
      setTitle(q.title);
      onCreated?.(q);
    });
  }
  async function deleteQuiz() {
    setBusy(true);
    setError("");
    try {
      if (user) await quizRequest(user, `/quizzes/${selected.id}`, "DELETE");
      else {
        if (demoQuizzes().find((q) => q.id === selected.id)?.locked)
          throw new Error(
            "This demo quiz has a submission, so it can’t be deleted. Unpublish it instead.",
          );
        demoDelete(selected.id);
      }
      setConfirmDelete(false);
      onDeleted?.(selected);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const editable = canEdit && !selected?.published && !selected?.locked;
  return (
    <section className="quiz-workspace" aria-label="Quiz builder">
      {!user && (
        <p className="helper">
          Demo quizzes are stored in this browser. No official grades are
          recorded.
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Loading quiz…</p>
      ) : (
        <>
          {!selected && !openQuizId && (
            <button className="text-button" onClick={onBack}>
              ← Back to Create
            </button>
          )}
          {!selected && !openQuizId && canEdit && (
            <form onSubmit={createQuiz}>
              <label htmlFor="new-quiz-title">New quiz title</label>
              <input
                id="new-quiz-title"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
              <button className="primary" disabled={busy}>
                Create draft quiz
              </button>
            </form>
          )}
          {selected && (
            <>
              <button className="text-button" disabled={busy} onClick={onDone}>
                ← Back to module
              </button>
              <h3>{selected.title}</h3>
              <p>
                {selected.published
                  ? "Published — unpublish before editing questions."
                  : "Draft"}
                {selected.locked ? " · Questions locked after submission." : ""}
              </p>
              {canEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!title.trim()) return;
                    run(async () => {
                      const q = user
                        ? (
                            await quizRequest(
                              user,
                              `/quizzes/${selected.id}`,
                              "PATCH",
                              { title: title.trim() },
                            )
                          ).quiz
                        : demoSave({ ...selected, title: title.trim() });
                      setSelected(q);
                      setNotice("Title saved.");
                    });
                  }}
                >
                  <label htmlFor="quiz-title">Quiz title</label>
                  <input
                    id="quiz-title"
                    required
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <button disabled={busy}>Save title</button>
                </form>
              )}
              {canEdit && (
                <RetakeSettings
                  key={`${selected.id}-${selected.maxAttempts}`}
                  quiz={selected}
                  supported={
                    !user || selected.capabilities?.retakePolicy === true
                  }
                  busy={busy}
                  onSave={(maxAttempts) =>
                    run(async () => {
                      const updated = user
                        ? (
                            await quizRequest(
                              user,
                              `/quizzes/${selected.id}`,
                              "PATCH",
                              { title: selected.title, maxAttempts },
                            )
                          ).quiz
                        : demoSave({ ...selected, maxAttempts });
                      setSelected(updated);
                      setNotice("Attempt settings saved.");
                    })
                  }
                />
              )}
              {selected.questions.map((q, i) => (
                <article className="question-card" key={q.id}>
                  <h4>
                    {i + 1}. {q.text}
                  </h4>
                  <p>{q.points} points</p>
                  <ul>
                    {q.choices.map((c) => (
                      <li key={c.id}>
                        {c.text}
                        {c.isCorrect ? " — Correct answer" : ""}
                      </li>
                    ))}
                  </ul>
                  {editable && (
                    <div className="dialog-actions">
                      <button
                        disabled={busy}
                        onClick={() => setEditing({ question: q })}
                      >
                        Edit question {i + 1}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const next = user
                              ? (
                                  await quizRequest(
                                    user,
                                    `/quizzes/${selected.id}/questions/${q.id}`,
                                    "DELETE",
                                  )
                                ).quiz
                              : demoSave({
                                  ...selected,
                                  questions: selected.questions.filter(
                                    (item) => item.id !== q.id,
                                  ),
                                });
                            setSelected(next);
                            setNotice("Question removed.");
                          })
                        }
                      >
                        Delete question {i + 1}
                      </button>
                    </div>
                  )}
                </article>
              ))}
              <div className="dialog-actions">
                {editable && (
                  <button
                    disabled={busy}
                    onClick={() => setEditing({ question: null })}
                  >
                    Add question
                  </button>
                )}
                {canEdit && (
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      (!selected.published && !selected.questions.length)
                    }
                    onClick={() =>
                      run(async () => {
                        const next = user
                          ? (
                              await quizRequest(
                                user,
                                `/quizzes/${selected.id}/${selected.published ? "unpublish" : "publish"}`,
                                "POST",
                              )
                            ).quiz
                          : demoSave({
                              ...selected,
                              published: !selected.published,
                            });
                        setSelected(next);
                        setNotice(
                          next.published
                            ? "Quiz published."
                            : "Quiz unpublished.",
                        );
                      })
                    }
                  >
                    {selected.published ? "Unpublish quiz" : "Publish quiz"}
                  </button>
                )}
                <button
                  disabled={!selected.questions.length}
                  onClick={() => onPreview(selected)}
                >
                  Preview quiz
                </button>
                {canEdit && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setConfirmDelete(true);
                    }}
                  >
                    Delete quiz
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
      {confirmDelete && (
        <Modal
          title="Delete this quiz?"
          onClose={busy ? () => {} : () => setConfirmDelete(false)}
        >
          <p>
            This permanently deletes “{selected.title}” and all of its
            questions. This can’t be undone.
          </p>
          <p className="helper">
            If students have already taken it, it can’t be deleted. Unpublish it
            instead to hide it.
          </p>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={deleteQuiz}
            >
              {busy ? "Deleting…" : "Delete quiz"}
            </button>
          </div>
        </Modal>
      )}
      {editing && (
        <QuestionEditor
          question={editing.question}
          onSave={updateQuestion}
          onClose={() => setEditing(null)}
          busy={busy}
          serverError={error}
        />
      )}
    </section>
  );
}
