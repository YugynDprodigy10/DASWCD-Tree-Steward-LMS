import { useEffect, useRef, useState } from 'react';
import { demoQuizzes, demoSave, launchContext, quizRequest } from './service';
import './quiz.css';

export default function QuizRunner() {
  const [context] = useState(launchContext);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const resultHeading = useRef(null);
  useEffect(() => {
    let active = true;
    (async () => { try {
      if (!context) throw new Error('This quiz window has expired. Open the quiz again from your course.');
      const q = context.user ? (await quizRequest(context.user, `/quizzes/${context.quizId}`)).quiz : demoQuizzes().find(q => q.id === context.quizId);
      if (!q || (!q.published && !context.preview)) throw new Error('This quiz is not currently published.');
      if (!q.questions.length) throw new Error('This quiz has no questions yet.');
      if (active) setQuiz(q);
    } catch(e) { if(active) setError(e.message); } finally { if(active) setLoading(false); } })();
    return () => { active = false; };
  }, [context, retry]);
  useEffect(() => { if(result) resultHeading.current?.focus(); }, [result]);
  useEffect(() => {
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    if (!result && Object.keys(answers).length) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [answers, result]);
  async function submit(e) {
    e.preventDefault(); if (busy || result) return;
    setError(''); setBusy(true);
    try {
      if (!launchContext()) throw new Error('Your quiz session ended. Open it again from your course.');
      if (quiz.questions.some(q => !answers[q.id])) throw new Error('Answer every question before submitting.');
      if (context.preview) { setResult({ preview: true }); return; }
      let attempt;
      if (context.user) attempt = (await quizRequest(context.user, `/quizzes/${quiz.id}/attempts`, 'POST', { answers: quiz.questions.map(q => ({ questionId: q.id, choiceId: Number(answers[q.id]) })) })).attempt;
      else {
        const current = demoQuizzes().find(q => q.id === quiz.id);
        if (!current?.published) throw new Error('This quiz is no longer published.');
        if (JSON.stringify(current.questions) !== JSON.stringify(quiz.questions)) throw new Error('The quiz changed. Reopen it from your course before submitting.');
        attempt = { score: quiz.questions.reduce((sum,q) => sum + (q.choices.find(c => c.id === answers[q.id])?.isCorrect ? q.points : 0),0), maxScore: quiz.questions.reduce((sum,q) => sum+q.points,0) };
        demoSave({ ...current, locked: true });
      }
      setResult(attempt);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="quiz-window"><a className="skip-link" href="#quiz-main">Skip to quiz</a><header><strong>Steward Tree</strong><p>{context?.preview ? 'Instructor preview · No submission recorded' : context?.user ? 'Course quiz' : 'Demo quiz · No official grade'}</p></header>
    <main id="quiz-main" tabIndex={-1}>
      <h1>{quiz?.title || 'Quiz'}</h1>
      {loading && <p role="status">Loading quiz…</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      {!quiz && !loading && context && <button onClick={() => { setError(''); setLoading(true); setRetry(retry+1); }}>Retry loading quiz</button>}
      {quiz && !result && <form onSubmit={submit}>
        <p>{quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · Select one answer per question.</p>
        <p aria-live="polite">{Object.keys(answers).length} of {quiz.questions.length} answered</p>
        <fieldset disabled={busy} className="quiz-fields">
          {quiz.questions.map((q,i) => <fieldset className="question-card" key={q.id}><legend>{i+1}. {q.text} <span>({q.points} points)</span></legend>
            {q.choices.map(c => <label className="answer-choice" key={c.id}><input type="radio" name={`question-${q.id}`} value={c.id} checked={answers[q.id] === c.id} onChange={() => setAnswers({ ...answers, [q.id]: c.id })} required /><span>{c.text}</span></label>)}
          </fieldset>)}
          <button className="primary" disabled={busy}>{busy ? 'Submitting…' : context.preview ? 'Finish preview' : 'Submit quiz'}</button>
        </fieldset>
      </form>}
      {result && <section className="question-card"><h2 ref={resultHeading} tabIndex={-1}>{result.preview ? 'Preview complete' : 'Quiz submitted'}</h2>{!result.preview && <p className="quiz-score">{result.score} / {result.maxScore} points{result.maxScore > 0 ? ` · ${Math.round(result.score/result.maxScore*100)}%` : ''}</p>}<p>{result.preview ? 'No answers or scores were submitted.' : context.user ? 'Your score was returned by the quiz server.' : 'This practice score is calculated locally and is not an official grade.'}</p><p>You can close this window and return to your course.</p></section>}
    </main>
  </div>;
}
