const KEY = "steward-quiz-demo-v1";
const seed = [
  {
    id: "demo-tree",
    moduleId: 2,
    title: "Tree identification",
    published: true,
    maxAttempts: 1,
    attempts: [],
    order: 1,
    questions: [
      {
        id: "q1",
        text: "Which observation helps identify a tree?",
        points: 2,
        choices: [
          { id: "c1", text: "Leaf shape and arrangement", isCorrect: true },
          { id: "c2", text: "The day of the week", isCorrect: false },
        ],
      },
    ],
  },
];
export function demoQuizzes() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || JSON.stringify(seed));
    return items.map((quiz) => ({
      ...quiz,
      maxAttempts: quiz.maxAttempts ?? 1,
      attempts: quiz.attempts || (quiz.lastScore ? [quiz.lastScore] : []),
    }));
  } catch {
    return structuredClone(seed);
  }
}
function store(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}
export function resetDemoQuizzes() {
  localStorage.removeItem(KEY);
}
export { apiRequest as quizRequest } from "../api/client.js";
export function demoSave(quiz) {
  const items = demoQuizzes();
  const index = items.findIndex((q) => q.id === quiz.id);
  if (index < 0) items.push(quiz);
  else items[index] = quiz;
  store(items);
  return quiz;
}
export function demoDelete(id) {
  store(demoQuizzes().filter((q) => q.id !== id));
}
export function questionError(q) {
  if (!q.text.trim() || q.text.length > 1000)
    return "Enter question text (up to 1,000 characters).";
  if (!Number.isInteger(Number(q.points)) || q.points < 1 || q.points > 100)
    return "Use 1–100 whole-number points.";
  if (
    q.choices.length < 2 ||
    q.choices.length > 6 ||
    q.choices.some((c) => !c.text.trim() || c.text.length > 300)
  )
    return "Enter 2–6 choices, each up to 300 characters.";
  if (q.choices.filter((c) => c.isCorrect).length !== 1)
    return "Select exactly one correct answer.";
  return "";
}
export function submitDemoAttempt(quiz, answers) {
  const current = demoQuizzes().find(
    (item) => String(item.id) === String(quiz.id),
  );
  if (!current?.published) throw new Error("This quiz is no longer published.");
  if (JSON.stringify(current.questions) !== JSON.stringify(quiz.questions)) {
    throw new Error("The quiz changed. Return to the module and reopen it.");
  }
  const attempts = current.attempts || [];
  if (attempts.length >= (current.maxAttempts ?? 1))
    throw new Error("No attempts remaining.");
  const attempt = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    score: 0,
    maxScore: 0,
  };
  for (const question of current.questions) {
    const choice = question.choices.find(
      (item) => String(item.id) === String(answers[question.id]),
    );
    if (!choice) throw new Error("Answer every question before submitting.");
    attempt.maxScore += Number(question.points);
    if (choice.isCorrect) attempt.score += Number(question.points);
  }
  demoSave({
    ...current,
    locked: true,
    attempts: [attempt, ...attempts],
    lastScore: attempt,
  });
  return attempt;
}
