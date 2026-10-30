import { useState } from "react";
import Modal from "../components/Modal";
import { questionError } from "./service.js";

export default function QuestionEditor({ question, onSave, onClose, busy, serverError }) {
  const [value, setValue] = useState(
    question || {
      text: "",
      points: 1,
      choices: [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
    },
  );
  const [error, setError] = useState("");
  function choice(index, change) {
    setValue({
      ...value,
      choices: value.choices.map((c, i) =>
        i === index ? { ...c, ...change } : c,
      ),
    });
  }
  return (
    <Modal
      title={question ? "Edit question" : "Add question"}
      onClose={busy ? () => {} : onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const error = questionError(value);
          setError(error);
          if (!error)
            onSave({
              ...value,
              text: value.text.trim(),
              points: Number(value.points),
              choices: value.choices.map((c) => ({
                ...c,
                text: c.text.trim(),
              })),
            });
        }}
      >
        <fieldset disabled={busy} className="quiz-fields">
          <label htmlFor="question-text">Question</label>
          <textarea
            id="question-text"
            required
            maxLength={1000}
            value={value.text}
            onChange={(e) => setValue({ ...value, text: e.target.value })}
          />
          <label htmlFor="question-points">Points</label>
          <input
            id="question-points"
            type="number"
            min="1"
            max="100"
            step="1"
            required
            value={value.points}
            onChange={(e) => setValue({ ...value, points: e.target.value })}
          />
          <fieldset>
            <legend>Answer choices — select the correct answer</legend>
            {value.choices.map((c, i) => (
              <div className="choice-editor" key={i}>
                <input
                  type="radio"
                  name="correct"
                  aria-label={`Choice ${i + 1} is correct`}
                  checked={c.isCorrect}
                  onChange={() =>
                    setValue({
                      ...value,
                      choices: value.choices.map((item, j) => ({
                        ...item,
                        isCorrect: j === i,
                      })),
                    })
                  }
                />
                <input
                  aria-label={`Choice ${i + 1} text`}
                  required
                  maxLength={300}
                  value={c.text}
                  onChange={(e) => choice(i, { text: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove choice ${i + 1}`}
                  disabled={value.choices.length <= 2}
                  onClick={() =>
                    setValue({
                      ...value,
                      choices: value.choices.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={value.choices.length >= 6}
              onClick={() =>
                setValue({
                  ...value,
                  choices: [...value.choices, { text: "", isCorrect: false }],
                })
              }
            >
              Add choice
            </button>
          </fieldset>
          {(error || serverError) && <p role="alert">{error || serverError}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">Save question</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

