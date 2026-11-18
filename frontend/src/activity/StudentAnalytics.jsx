import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import "./student-analytics.css";

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (!minutes) return `${remainingSeconds} sec`;
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes} min`;
  return `${hours} hr ${minutes % 60} min`;
}

export default function StudentAnalytics({ user }) {
  const [moduleState, setModuleState] = useState({
    key: null,
    modules: [],
    loading: Boolean(user),
    error: "",
  });
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [summaryState, setSummaryState] = useState({
    key: null,
    summary: null,
    loading: false,
    error: "",
  });

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const key = user.id;
    apiRequest(user, "/activity/modules")
      .then(({ modules }) => {
        if (!active) return;
        setModuleState({ key, modules, loading: false, error: "" });
        setSelectedModuleId((current) =>
          modules.some((module) => String(module.id) === current)
            ? current
            : String(modules[0]?.id ?? ""),
        );
      })
      .catch((error) => {
        if (active) {
          setModuleState({
            key,
            modules: [],
            loading: false,
            error: error.message,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedModuleId) {
      return undefined;
    }
    let active = true;
    const key = `${user.id}:${selectedModuleId}`;
    apiRequest(user, `/activity/modules/${selectedModuleId}/summary`)
      .then((summary) => {
        if (active) {
          setSummaryState({ key, summary, loading: false, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setSummaryState({
            key,
            summary: null,
            loading: false,
            error: error.message,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [user, selectedModuleId]);

  const moduleKey = user?.id ?? null;
  const currentModules =
    moduleState.key === moduleKey
      ? moduleState
      : { modules: [], loading: Boolean(user), error: "" };
  const summaryKey = user ? `${user.id}:${selectedModuleId}` : null;
  const currentSummary =
    summaryState.key === summaryKey
      ? summaryState
      : {
          summary: null,
          loading: Boolean(user && selectedModuleId),
          error: "",
        };

  if (!user) {
    return (
      <section className="analytics-empty">
        <h2>Student analytics require a signed-in account.</h2>
        <p>Sign in as a teacher or administrator to view recorded module activity.</p>
      </section>
    );
  }
  if (currentModules.loading) return <p role="status">Loading student analytics…</p>;
  if (currentModules.error) {
    return <p className="notice" role="alert">{currentModules.error}</p>;
  }
  if (!currentModules.modules.length) {
    return (
      <section className="analytics-empty">
        <h2>No modules are available for analytics.</h2>
        <p>Teachers can view modules assigned to them; administrators can view all modules.</p>
      </section>
    );
  }

  return (
    <section className="student-analytics">
      <div className="analytics-toolbar">
        <label htmlFor="analytics-module">Module</label>
        <select
          id="analytics-module"
          value={selectedModuleId}
          onChange={(event) => setSelectedModuleId(event.target.value)}
        >
          {currentModules.modules.map((module) => (
            <option key={module.id} value={module.id}>{module.name}</option>
          ))}
        </select>
      </div>
      <p className="analytics-note">
        Percentages are each page&apos;s share of tracked time across this module.
        Home is not logged; only opened module content and quizzes are included.
        Time pauses while a student&apos;s tab is hidden.
      </p>
      {currentSummary.loading ? (
        <p role="status">Loading module activity…</p>
      ) : currentSummary.error ? (
        <p className="notice" role="alert">{currentSummary.error}</p>
      ) : currentSummary.summary?.pages.length ? (
        <section className="analytics-panel" aria-label="Top student pages by time">
          <div className="analytics-panel-heading">
            <div>
              <span className="eyebrow">{currentSummary.summary.module.name}</span>
              <h2>Most-viewed module pages</h2>
            </div>
            <p>
              {formatDuration(currentSummary.summary.totalSeconds)}
              <small>total tracked content time</small>
            </p>
          </div>
          <ol className="analytics-list">
            {currentSummary.summary.pages.map((item) => (
              <li key={item.key}>
                <div className="analytics-page-heading">
                  <strong>{item.title}</strong>
                  <span>{item.percentage.toFixed(1)}%</span>
                </div>
                <progress
                  max="100"
                  value={item.percentage}
                  aria-label={`${item.title}: ${item.percentage.toFixed(1)} percent`}
                />
                <small>
                  {formatDuration(item.seconds)} · {item.students}{" "}
                  {item.students === 1 ? "student" : "students"} · {item.visits}{" "}
                  {item.visits === 1 ? "visit" : "visits"}
                </small>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="analytics-empty">
          <h2>No module content time recorded yet.</h2>
          <p>Statistics appear after students open module content or quizzes.</p>
        </section>
      )}
    </section>
  );
}
