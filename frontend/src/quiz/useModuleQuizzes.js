import { useCallback, useEffect, useState } from 'react';
import { demoQuizzes, quizRequest } from './service';

// Loads a module's quizzes. For students, also loads their latest score on each quiz.
export async function fetchQuizzes(user, moduleId, instructor) {
  const items = user ? (await quizRequest(user, `/modules/${moduleId}/quizzes`)).quizzes : demoQuizzes().filter(q => q.moduleId === moduleId);
  const visible = items.filter(q => instructor || q.published);
  if (instructor || !user) return visible;
  return Promise.all(visible.map(async q => {
    const { attempts } = await quizRequest(user, `/quizzes/${q.id}/attempts/me`);
    const latest = attempts[0];
    return { ...q, lastScore: latest ? { score: latest.score, maxScore: latest.maxScore } : null };
  }));
}

// Keeps a module's quiz list up to date while the module page is showing.
export function useModuleQuizzes(user, moduleId, instructor, enabled) {
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setQuizzes(await fetchQuizzes(user, moduleId, instructor));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [user, moduleId, instructor]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchQuizzes(user, moduleId, instructor)
      .then(items => { if (active) { setQuizzes(items); setError(''); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user, moduleId, instructor, enabled]);
  // Students take quizzes in another tab, so refresh their scores when they come back to this one.
  useEffect(() => {
    if (!enabled || instructor) return;
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled, instructor, reload]);
  return { quizzes, error };
}