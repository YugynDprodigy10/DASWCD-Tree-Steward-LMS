import { useState } from "react";
import { policyError } from "./policy.js";

export default function RetakeSettings({ quiz, supported, busy, onSave }) {
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts ?? 1);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const message = policyError(maxAttempts);
        setError(message);
        if (!message) onSave(maxAttempts);
      }}
    >
      <fieldset disabled={!supported || busy}>
        <legend>Quiz attempts</legend>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={maxAttempts > 1}
            onChange={(event) => setMaxAttempts(event.target.checked ? 2 : 1)}
          />
          Allow retakes
        </label>
        {maxAttempts > 1 && (
          <>
            <label htmlFor="attempt-limit">
              Total attempts, including the first
            </label>
            <input
              id="attempt-limit"
              type="number"
              min="2"
              max="10"
              required
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
            />
          </>
        )}
        <p className="helper">
          {supported
            ? "One attempt unless retakes are enabled. Previous scores are kept."
            : "Retake settings need backend support and cannot be saved for this account yet."}
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Save attempt settings</button>
      </fieldset>
    </form>
  );
}
