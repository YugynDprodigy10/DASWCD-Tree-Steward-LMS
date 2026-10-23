const KEY = 'steward-quiz-demo-v1';
const seed = [{ id: 'demo-tree', moduleId: 2, title: 'Tree identification', published: true, order: 1, questions: [{ id: 'q1', text: 'Which observation helps identify a tree?', points: 2, choices: [{ id: 'c1', text: 'Leaf shape and arrangement', isCorrect: true }, { id: 'c2', text: 'The day of the week', isCorrect: false }] }] }];
export function demoQuizzes() { return JSON.parse(localStorage.getItem(KEY) || JSON.stringify(seed)); }
function store(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
export function resetDemoQuizzes() { localStorage.removeItem(KEY); for (const key of Object.keys(localStorage)) { if (key.startsWith('quiz-launch:')) localStorage.removeItem(key); } }
export async function quizRequest(user, path, method = 'GET', body) {
  if (!user?.id) throw new Error('Sign in to use saved quizzes.');
  let response;
  try { response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-User-Id': String(user.id) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error('Cannot reach the quiz service. Check your connection and try again.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || 'Quiz service unavailable. Run the backend with the quiz API from PR #12.');
  return result;
}
export function demoSave(quiz) {
  const items = demoQuizzes();
  const index = items.findIndex(q => q.id === quiz.id);
  if (index < 0) items.push(quiz); else items[index] = quiz;
  store(items); return quiz;
}
export function demoDelete(id) {
  store(demoQuizzes().filter(q => q.id !== id));
}
export function launchQuiz(quiz, user, preview = false) {
  const token = crypto.randomUUID();
  // Prototype identity only, not an authentication token. Never stores a password.
  localStorage.setItem(`quiz-launch:${token}`, JSON.stringify({ quizId: quiz.id, user: user ? { id: user.id } : null, preview, expires: Date.now() + 2 * 60 * 60 * 1000 }));
  window.open(`${window.location.pathname}?quiz=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
}
export function launchContext() {
  try {
    const token = new URLSearchParams(location.search).get('quiz');
    const context = JSON.parse(localStorage.getItem(`quiz-launch:${token}`));
    return context?.expires > Date.now() ? context : null;
  } catch { return null; }
}
export function questionError(q) {
  if (!q.text.trim() || q.text.length > 1000) return 'Enter question text (up to 1,000 characters).';
  if (!Number.isInteger(Number(q.points)) || q.points < 1 || q.points > 100) return 'Use 1–100 whole-number points.';
  if (q.choices.length < 2 || q.choices.length > 6 || q.choices.some(c => !c.text.trim() || c.text.length > 300)) return 'Enter 2–6 choices, each up to 300 characters.';
  if (q.choices.filter(c => c.isCorrect).length !== 1) return 'Select exactly one correct answer.';
  return '';
}