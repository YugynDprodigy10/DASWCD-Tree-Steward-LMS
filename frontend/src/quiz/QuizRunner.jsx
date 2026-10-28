import { useEffect, useRef, useState } from "react";
import { demoQuizzes, quizRequest, submitDemoAttempt } from "./service.js";
import { attemptsRemaining, formatScore } from "./policy.js";
import "./quiz.css";

function readDraft(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

export default function QuizRunner({ quizId, user, preview, onBack }) {
  const draftKey = `quiz-draft:${user?.id ?? "demo"}:${preview ? "preview" : "student"}:${quizId}`;
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const heading = useRef(null);
  const submitLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function loadQuiz() {
      try {
        const loaded = user
          ? (await quizRequest(user, `/quizzes/${encodeURIComponent(quizId)}`))
              .quiz
          : demoQuizzes().find((item) => String(item.id) === String(quizId));
        if (!loaded || (!loaded.published && !preview))
          throw new Error("This quiz is not available.");
        if (!loaded.questions.length)
          throw new Error("This quiz has no questions yet.");
        const history = preview
          ? []
          : user
            ? (
                await quizRequest(
                  user,
                  `/quizzes/${encodeURIComponent(quizId)}/attempts/me`,
                )
              ).attempts
            : loaded.attempts || [];
        const draft = readDraft(draftKey);
        const matches = draft.signature === JSON.stringify(loaded.questions);
        if (active) {
          setQuiz(loaded);
          setAttempts(history);
          setAnswers(matches ? draft.answers || {} : {});
        }
      } catch (failure) {
        if (active) setError(failure.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadQuiz();
    return () => {
      active = false;
    };
  }, [quizId, user, preview, draftKey, retry]);

  useEffect(() => {
    if (!loading) heading.current?.focus();
  }, [loading, result]);

  function answerQuestion(questionId, choiceId) {
    const next = { ...answers, [questionId]: choiceId };
    // Save immediately so browser Back and refresh do not race an effect.
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          signature: JSON.stringify(quiz.questions),
          answers: next,
        }),
      );
    } catch {
      setError(
        "This browser cannot save your draft. Keep this page open until you submit.",
      );
    }
    setAnswers(next);
  }

  async function submit(event) {
    event.preventDefault();
    if (submitLock.current || result) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (quiz.questions.some((question) => answers[question.id] === undefined))
        throw new Error("Answer every question before submitting.");
      if (!preview && attemptsRemaining(quiz, attempts.length) === 0)
        throw new Error("No attempts remaining.");
      const attempt = preview
        ? { preview: true }
        : user
          ? (
              await quizRequest(user, `/quizzes/${quiz.id}/attempts`, "POST", {
                answers: quiz.questions.map((question) => ({
                  questionId: question.id,
                  choiceId: Number(answers[question.id]),
                })),
              })
            ).attempt
          : submitDemoAttempt(quiz, answers);
      if (!preview) setAttempts((previous) => [attempt, ...previous]);
      setResult(attempt);
      sessionStorage.removeItem(draftKey);
    } catch (failure) {
      setError(failure.message);
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  const remaining = quiz ? attemptsRemaining(quiz, attempts.length) : null;
  const canAttempt = preview || remaining !== 0;
  return (
    <div className="quiz-window">
      <a className="skip-link" href="#quiz-main">
        Skip to quiz
      </a>
      <header>
        <strong>Steward Tree</strong>
        <p>
          {preview
            ? "Instructor preview · No submission recorded"
            : user
              ? "Course quiz"
              : "Demo quiz · No official grade"}
        </p>
        <button type="button" disabled={busy} onClick={onBack}>
          ← Back to module
        </button>
      </header>
      <main id="quiz-main" tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1}>
          {quiz?.title || "Quiz"}
        </h1>
        {loading && <p role="status">Loading quiz…</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {!quiz && !loading && (
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Retry loading quiz
          </button>
        )}
        {quiz && !preview && (
          <p role="status">
            {remaining === null
              ? "Attempt limits are not provided by the quiz service yet."
              : `${remaining} of ${quiz.maxAttempts} attempts remaining.`}
          </p>
        )}
        {quiz && !result && canAttempt && (
          <form onSubmit={submit}>
            <p>
              {quiz.questions.length} questions · Select one answer per
              question.
            </p>
            <p className="helper">
              Answers are saved in this tab while you work. They are not
              submitted until you select Submit quiz.
            </p>
            <p aria-live="polite">
              {Object.keys(answers).length} of {quiz.questions.length} answered
            </p>
            <fieldset disabled={busy} className="quiz-fields">
              {quiz.questions.map((question, index) => (
                <fieldset className="question-card" key={question.id}>
                  <legend>
                    {index + 1}. {question.text}{" "}
                    <span>({question.points} points)</span>
                  </legend>
                  {question.choices.map((choice) => (
                    <label className="answer-choice" key={choice.id}>
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={answers[question.id] === choice.id}
                        onChange={() => answerQuestion(question.id, choice.id)}
                        required
                      />
                      <span>{choice.text}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <button className="primary">
                {busy
                  ? "Submitting…"
                  : preview
                    ? "Finish preview"
                    : "Submit quiz"}
              </button>
            </fieldset>
          </form>
        )}
        {result && (
          <section className="question-card" aria-live="polite">
            <h2>{result.preview ? "Preview complete" : "Quiz submitted"}</h2>
            {!result.preview && (
              <p className="quiz-score">{formatScore(result)}</p>
            )}
            {canAttempt && (
              <button
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                {" "}
                {preview ? "Restart preview" : "Retake quiz"}
              </button>
            )}
          </section>
        )}
        {!preview && attempts.length > 0 && (
          <section aria-label="Your attempts">
            <h2>Your attempts</h2>
            <ol>
              {attempts.map((attempt, index) => (
                <li key={attempt.id || index}>
                  {formatScore(attempt)}
                  {attempt.submittedAt &&
                    ` · ${new Date(attempt.submittedAt).toLocaleString()}`}
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
