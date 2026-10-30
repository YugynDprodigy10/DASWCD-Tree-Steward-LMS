export function formatScore(attempt) {
  if (!attempt) return "Not taken yet";
  const percentage =
    attempt.maxScore > 0
      ? ` (${Math.round((attempt.score / attempt.maxScore) * 100)}%)`
      : "";
  return `${attempt.score} / ${attempt.maxScore} points${percentage}`;
}

// Undefined means the current API has not implemented retake policy yet.
export function attemptsRemaining(quiz, attemptsTaken) {
  return Number.isInteger(quiz.maxAttempts) && quiz.maxAttempts > 0
    ? Math.max(0, quiz.maxAttempts - attemptsTaken)
    : null;
}

export function policyError(maxAttempts) {
  return Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 10
    ? ""
    : "Choose 1–10 total attempts, including the first attempt.";
}
