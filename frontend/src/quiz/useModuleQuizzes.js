import { useEffect, useState } from "react";
import { demoQuizzes, quizRequest } from "./service";

// Loads a module's quizzes. For students, also loads their latest score on each quiz.
export async function fetchQuizzes(user, moduleId, instructor) {
  const items = user
    ? (await quizRequest(user, `/modules/${moduleId}/quizzes`)).quizzes
    : demoQuizzes().filter((q) => q.moduleId === moduleId);
  const visible = items.filter((q) => instructor || q.published);
  if (instructor || !user) return visible;
  return Promise.all(
    visible.map(async (q) => {
      const { attempts } = await quizRequest(
        user,
        `/quizzes/${q.id}/attempts/me`,
      );
      const latest = attempts[0];
      return {
        ...q,
        attemptsTaken: attempts.length,
        lastScore: latest
          ? { score: latest.score, maxScore: latest.maxScore }
          : null,
      };
    }),
  );
}

// Keeps a module's quiz list up to date while the module page is showing.
export function useModuleQuizzes(user, moduleId, instructor, enabled) {
  const key = `${user?.id ?? 'demo'}:${moduleId}:${instructor}`;
  const [state, setState] = useState({ key: null, quizzes: [], error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let requestNumber = 0;
    async function reload() {
      const request = ++requestNumber;
      try {
        const quizzes = await fetchQuizzes(user, moduleId, instructor);
        if (active && request === requestNumber) setState({ key, quizzes, error: '' });
      } catch (error) {
        if (active && request === requestNumber) setState({ key, quizzes: [], error: error.message });
      }
    }
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    reload();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user, moduleId, instructor, enabled, key]);
  return enabled && state.key === key ? state : { quizzes: [], error: '' };
}
