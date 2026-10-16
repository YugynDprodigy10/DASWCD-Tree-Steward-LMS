import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { demoQuizzes, demoSave, launchQuiz, quizRequest, questionError } from './service';
import './quiz.css';

function QuestionEditor({ question, onSave, onClose, busy, serverError }) {
  const [value, setValue] = useState(question || { text: '', points: 1, choices: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] });
  const [error, setError] = useState('');
  function choice(index, change) { setValue({ ...value, choices: value.choices.map((c, i) => i === index ? { ...c, ...change } : c) }); }
  return <Modal title={question ? 'Edit question' : 'Add question'} onClose={busy ? () => {} : onClose}>
    <form onSubmit={e => { e.preventDefault(); const error = questionError(value); setError(error); if (!error) onSave({ ...value, text: value.text.trim(), points: Number(value.points), choices: value.choices.map(c => ({ ...c, text: c.text.trim() })) }); }}>
      <fieldset disabled={busy} className="quiz-fields">
        <label htmlFor="question-text">Question</label><textarea id="question-text" required maxLength={1000} value={value.text} onChange={e => setValue({ ...value, text: e.target.value })} />
        <label htmlFor="question-points">Points</label><input id="question-points" type="number" min="1" max="100" step="1" required value={value.points} onChange={e => setValue({ ...value, points: e.target.value })} />
        <fieldset><legend>Answer choices — select the correct answer</legend>
          {value.choices.map((c, i) => <div className="choice-editor" key={i}>
            <input type="radio" name="correct" aria-label={`Choice ${i + 1} is correct`} checked={c.isCorrect} onChange={() => setValue({ ...value, choices: value.choices.map((item, j) => ({ ...item, isCorrect: j === i })) })} />
            <input aria-label={`Choice ${i + 1} text`} required maxLength={300} value={c.text} onChange={e => choice(i, { text: e.target.value })} />
            <button type="button" aria-label={`Remove choice ${i + 1}`} disabled={value.choices.length <= 2} onClick={() => setValue({ ...value, choices: value.choices.filter((_, j) => j !== i) })}>Remove</button>
          </div>)}
          <button type="button" disabled={value.choices.length >= 6} onClick={() => setValue({ ...value, choices: [...value.choices, { text: '', isCorrect: false }] })}>Add choice</button>
        </fieldset>
        {(error || serverError) && <p role="alert">{error || serverError}</p>}
        <div className="dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save question</button></div>
      </fieldset>
    </form>
  </Modal>;
}

export default function QuizWorkspace({ moduleId, user, instructor, preview, canEdit }) {
  const [quizzes, setQuizzes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    const items = user ? (await quizRequest(user, `/modules/${moduleId}/quizzes`)).quizzes : demoQuizzes().filter(q => q.moduleId === moduleId);
    setQuizzes(items.filter(q => instructor || q.published));
  }
  useEffect(() => {
    let active = true;
    (async () => { try {
      const items = user ? (await quizRequest(user, `/modules/${moduleId}/quizzes`)).quizzes : demoQuizzes().filter(q => q.moduleId === moduleId);
      if (active) setQuizzes(items.filter(q => instructor || q.published));
    } catch(e) { if(active) setError(e.message); } finally { if(active) setLoading(false); } })();
    return () => { active = false; };
  }, [moduleId, user, instructor]);
  async function run(action) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function open(quiz) { await run(async () => { const q = user ? (await quizRequest(user, `/quizzes/${quiz.id}`)).quiz : quiz; setSelected(q); setTitle(q.title); }); }
  async function updateQuestion(value) {
    await run(async () => {
      let next;
      if (user) next = (await quizRequest(user, `/quizzes/${selected.id}/questions${editing.question ? `/${editing.question.id}` : ''}`, editing.question ? 'PUT' : 'POST', value)).quiz;
      else {
        if (demoQuizzes().find(q => q.id === selected.id)?.locked) throw new Error('Questions are locked after a demo submission.');
        const q = { ...value, id: value.id || crypto.randomUUID(), choices: value.choices.map(c => ({ ...c, id: c.id || crypto.randomUUID() })) };
        next = demoSave({ ...selected, questions: editing.question ? selected.questions.map(item => item.id === q.id ? q : item) : [...selected.questions, q] });
      }
      setSelected(next); setEditing(null); setNotice('Question saved.'); await load();
    });
  }
  const editable = canEdit && !selected?.published && !selected?.locked;
  return <section className="quiz-workspace" aria-label="Quizzes">
    <h2>Quizzes</h2>
    {!user && <p className="helper">Demo quizzes are stored in this browser. No official grades are recorded.</p>}
    {error && <p role="alert" className="notice">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading quizzes…</p> : <>
      {!selected && <>
        {quizzes.map(q => <article className="content-card quiz" key={q.id}>
          <span className="type-tag">{q.published ? 'Published quiz' : 'Draft quiz'}</span>
          <h3>{instructor ? <button className="card-title" disabled={busy} onClick={() => open(q)}>{q.title}</button> : <button className="card-title" onClick={() => launchQuiz(q, user, preview)}>{q.title} ↗<span className="helper"> Opens in a new tab or window</span></button>}</h3>
          <p>{q.questionCount ?? q.questions?.length ?? 0} question{(q.questionCount ?? q.questions?.length ?? 0) === 1 ? "" : "s"} · Multiple choice</p>
          {instructor && <button className="secondary" disabled={busy} onClick={() => open(q)}>Open builder</button>}
        </article>)}
        {!quizzes.length && <p>No {instructor ? '' : 'published '}quizzes in this module.</p>}
        {canEdit && <form onSubmit={e => { e.preventDefault(); if(!title.trim()) return; run(async () => { const q = user ? (await quizRequest(user, `/modules/${moduleId}/quizzes`, 'POST', { title: title.trim() })).quiz : demoSave({ id: crypto.randomUUID(), moduleId, title: title.trim(), published: false, questions: [] }); setSelected(q); setTitle(q.title); await load(); }); }}>
          <label htmlFor="new-quiz-title">New quiz title</label><input id="new-quiz-title" required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /><button className="primary" disabled={busy}>Create draft quiz</button>
        </form>}
        <button className="text-button" disabled={busy} onClick={() => run(load)}>Refresh quizzes</button>
      </>}
      {selected && <>
        <button className="text-button" disabled={busy} onClick={() => { setSelected(null); setTitle(''); }}>← All quizzes</button>
        <h3>{selected.title}</h3><p>{selected.published ? 'Published — unpublish before editing questions.' : 'Draft'}{selected.locked ? ' · Questions locked after submission.' : ''}</p>
        {canEdit && <form onSubmit={e => { e.preventDefault(); if (!title.trim()) return; run(async () => { const q = user ? (await quizRequest(user, `/quizzes/${selected.id}`, 'PATCH', { title: title.trim() })).quiz : demoSave({ ...selected, title: title.trim() }); setSelected(q); await load(); setNotice('Title saved.'); }); }}>
          <label htmlFor="quiz-title">Quiz title</label><input id="quiz-title" required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} /><button disabled={busy}>Save title</button>
        </form>}
        {selected.questions.map((q, i) => <article className="question-card" key={q.id}><h4>{i + 1}. {q.text}</h4><p>{q.points} points</p><ul>{q.choices.map(c => <li key={c.id}>{c.text}{c.isCorrect ? ' — Correct answer' : ''}</li>)}</ul>
          {editable && <div className="dialog-actions"><button disabled={busy} onClick={() => setEditing({ question: q })}>Edit question {i + 1}</button><button disabled={busy} onClick={() => run(async () => { const next = user ? (await quizRequest(user, `/quizzes/${selected.id}/questions/${q.id}`, 'DELETE')).quiz : demoSave({ ...selected, questions: selected.questions.filter(item => item.id !== q.id) }); setSelected(next); await load(); setNotice('Question removed.'); })}>Delete question {i + 1}</button></div>}
        </article>)}
        <div className="dialog-actions">
          {editable && <button disabled={busy} onClick={() => setEditing({ question: null })}>Add question</button>}
          {canEdit && <button className="primary" disabled={busy || (!selected.published && !selected.questions.length)} onClick={() => run(async () => { const next = user ? (await quizRequest(user, `/quizzes/${selected.id}/${selected.published ? 'unpublish' : 'publish'}`, 'POST')).quiz : demoSave({ ...selected, published: !selected.published }); setSelected(next); await load(); setNotice(next.published ? 'Quiz published.' : 'Quiz unpublished.'); })}>{selected.published ? 'Unpublish quiz' : 'Publish quiz'}</button>}
          <button disabled={!selected.questions.length} onClick={() => launchQuiz(selected, user, true)}>Preview quiz in new window</button>
        </div>
      </>}
    </>}
    {editing && <QuestionEditor question={editing.question} onSave={updateQuestion} onClose={() => setEditing(null)} busy={busy} serverError={error} />}
  </section>;
}
