import { formatScore } from "./policy.js";

// One quiz in a module's content list, styled like the other content cards.
export default function QuizCard({ quiz, instructor, onOpen }) {
  const count = quiz.questionCount ?? quiz.questions?.length ?? 0;
  const points =
    quiz.totalPoints ??
    quiz.questions?.reduce((sum, q) => sum + Number(q.points), 0) ??
    0;
  const action = () => onOpen(quiz);
  return (
    <article className="content-card quiz">
      <div className="card-top">
        <span className="type-tag quiz">Quiz</span>
        {instructor && !quiz.published && (
          <span className="draft-tag">Draft · Hidden from students</span>
        )}
      </div>
      <h2>
        <button className="card-title" onClick={action}>
          {quiz.title}
        </button>
      </h2>
      <p>
        {count} question{count === 1 ? "" : "s"} · {points} point
        {points === 1 ? "" : "s"} · Multiple choice
      </p>
      <div className="card-footer">
        <span className={instructor ? undefined : "quiz-score-line"}>
          {instructor
            ? quiz.published
              ? "Published"
              : "Draft"
            : formatScore(quiz.lastScore)}
        </span>
        <button className="text-button" onClick={action}>
          {instructor
            ? "Open quiz builder"
            : quiz.lastScore
              ? "View quiz and attempts"
              : "Take quiz"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

