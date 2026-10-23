import test from 'node:test';
import assert from 'node:assert/strict';
import { questionError, quizRequest } from '../src/quiz/service.js';
const valid = { text: 'Question', points: 2, choices: [{ text: 'Yes', isCorrect: true }, { text: 'No', isCorrect: false }] };
test('requires one correct answer and 2–6 nonempty choices', () => {
  assert.equal(questionError(valid), '');
  assert.match(questionError({ ...valid, choices: valid.choices.map(c => ({...c,isCorrect:false})) }), /exactly one/);
  assert.match(questionError({ ...valid, choices: valid.choices.map(c => ({...c,isCorrect:true})) }), /exactly one/);
  assert.match(questionError({ ...valid, choices: valid.choices.slice(0,1) }), /2–6/);
  assert.match(questionError({ ...valid, choices: Array(7).fill(valid.choices[0]) }), /2–6/);
  assert.match(questionError({ ...valid, points: 1.5 }), /whole-number/);
});
test('uses API identity and payload; preserves server rejection instead of demo fallback', async () => {
  const previous = globalThis.fetch;
  const user = { id: 7, getAccessTokenSilently: async () => 'test-access-token' };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/quizzes/9/attempts');
      assert.equal(options.headers.Authorization, 'Bearer test-access-token');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { answers: [{ questionId: 1, choiceId: 2 }] });
      return { ok: true, json: async () => ({ attempt: { score: 2, maxScore: 3 } }) };
    };
    assert.equal((await quizRequest(user, '/quizzes/9/attempts', 'POST', {answers:[{questionId:1,choiceId:2}]})).attempt.score, 2);
    globalThis.fetch = async () => ({ok:false,json:async()=>({error:'Questions locked'})});
    await assert.rejects(quizRequest(user, '/quizzes/9/questions', 'POST', valid), /Questions locked/);
    globalThis.fetch = async () => ({ok:true,json:async()=>{throw new Error('HTML')}});
    await assert.rejects(quizRequest(user, '/quizzes/9'), /unavailable/);
    await assert.rejects(quizRequest(null, '/quizzes/9'), /Sign in/);
  } finally { globalThis.fetch = previous; }
});
