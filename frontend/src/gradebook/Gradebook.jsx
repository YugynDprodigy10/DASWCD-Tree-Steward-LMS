import { useEffect, useState } from "react";
import { quizRequest } from "../quiz/service.js";
import "./gradebook.css";

function formatPercent(value) {
  return value === null ? "—" : `${Number(value).toFixed(2)}%`;
}

function formatScore(quiz) {
  if (quiz.percentage === null) return "Not attempted";
  return `${quiz.score}/${quiz.maxScore} · ${formatPercent(quiz.percentage)}`;
}

export default function Gradebook({ user, role }) {
  const [state, setState] = useState({
    key: null,
    modules: [],
    error: "",
    loading: Boolean(user),
  });
  const key = `${user?.id ?? "demo"}:${role}`;

  useEffect(() => {
    if (!user) return undefined;

    let active = true;
    quizRequest(user, "/gradebook")
      .then(({ modules }) => {
        if (active) setState({ key, modules, error: "", loading: false });
      })
      .catch((error) => {
        if (active) {
          setState({ key, modules: [], error: error.message, loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, [key, user]);

  const current = state.key === key
    ? state
    : { modules: [], error: "", loading: Boolean(user) };
  if (current.loading) return <p role="status">Loading gradebook…</p>;
  if (current.error) return <p className="notice" role="alert">{current.error}</p>;
  if (!user) {
    return (
      <section className="gradebook-empty">
        <h2>Official grades are not available in the demo.</h2>
        <p>Sign in with an enrolled student or assigned instructor account to view quiz grades.</p>
      </section>
    );
  }
  if (current.modules.length === 0) {
    return (
      <section className="gradebook-empty">
        <h2>No gradebook modules yet.</h2>
        <p>
          {role === "teacher"
            ? "You are not assigned to a module with an active student roster."
            : "You are not actively enrolled in a module yet."}
        </p>
      </section>
    );
  }

  return (
    <div className="gradebook">
      <p className="gradebook-note">
        Published quizzes count equally toward each module grade. The module
        grade appears after every published quiz has a submitted attempt; the
        latest attempt for each quiz is used.
      </p>
      {current.modules.map((module) => (
        <section className="gradebook-module" key={module.moduleId}>
          <h2>{module.moduleName}</h2>
          <p className="muted">
            {module.quizCount} published {module.quizCount === 1 ? "quiz" : "quizzes"}
          </p>
          {role === "teacher" ? (
            module.students.length === 0 ? (
              <p className="muted">No active students are enrolled in this module.</p>
            ) : (
              <div className="gradebook-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      {module.quizzes.map((quiz) => (
                        <th scope="col" key={quiz.quizId}>{quiz.title}</th>
                      ))}
                      <th scope="col">Module grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {module.students.map((student) => (
                      <tr key={student.studentId}>
                        <th scope="row">
                          <span>{student.name}</span>
                          <small>{student.email}</small>
                        </th>
                        {student.quizzes.map((quiz) => (
                          <td key={quiz.quizId}>{formatScore(quiz)}</td>
                        ))}
                        <td>
                          <strong>{formatPercent(student.grade)}</strong>
                          {student.grade === null && module.quizCount > 0 && (
                            <small>
                              {student.completedQuizCount}/{module.quizCount} quizzes complete
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <>
              <p className="gradebook-module-grade">
                Module grade: <strong>{formatPercent(module.grade)}</strong>
                {module.grade === null && module.quizCount > 0 && (
                  <span>
                    {module.completedQuizCount}/{module.quizCount} quizzes complete
                  </span>
                )}
              </p>
              {module.quizCount === 0 ? (
                <p className="muted">No published quizzes count toward this module yet.</p>
              ) : (
                <ul className="gradebook-quiz-list">
                  {module.quizzes.map((quiz) => (
                    <li key={quiz.quizId}>
                      <span>{quiz.title}</span>
                      <span>{formatScore(quiz)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
