import test from 'node:test';
import assert from 'node:assert/strict';
import { readRoute, routeSearch } from '../src/navigation/route.js';
import { attemptsRemaining, formatScore, policyError } from '../src/quiz/policy.js';
import { fileError, MAX_FILE_BYTES, saveMaterial } from '../src/materials/service.js';
import { apiRequest } from '../src/api/client.js';
import { demoQuizzes, demoSave, submitDemoAttempt } from '../src/quiz/service.js';

test('URLs preserve module, quiz, builder and preview; invalid routes get safe defaults', () => {
  const route = { moduleId: 4, page: 'Quizzes', quizId: 'quiz/one', builderId: '12', preview: true };
  assert.deepEqual(readRoute(routeSearch(route)), route);
  assert.equal(readRoute('?module=999&page=Anything').moduleId, 2);
  assert.equal(readRoute('?module=2.5&page=Anything').page, 'Home');
});

test('attempt policy handles exhausted limits and an API without policy support', () => {
  assert.equal(attemptsRemaining({ maxAttempts: 2 }, 1), 1);
  assert.equal(attemptsRemaining({ maxAttempts: 1 }, 3), 0);
  assert.equal(attemptsRemaining({}, 3), null);
  assert.equal(policyError(2), '');
  for (const value of [0, 11, 1.5, NaN]) assert.ok(policyError(value));
  assert.equal(formatScore({ score: 3, maxScore: 4 }), '3 / 4 points (75%)');
  assert.equal(formatScore({ score: 0, maxScore: 0 }), '0 / 0 points');
});

test('file validation rejects empty, unsupported, and oversized files', async () => {
  assert.equal(fileError({ type: 'application/pdf', size: MAX_FILE_BYTES }), '');
  assert.equal(fileError({ type: 'video/webm', size: 10 }), '');
  for (const file of [null, { type: 'text/html', size: 10 }, { type: 'video/mp4', size: 0 }, { type: 'application/pdf', size: MAX_FILE_BYTES + 1 }]) {
    assert.ok(fileError(file));
  }
  await assert.rejects(saveMaterial({ id: 1 }, 2, {}, null, () => {}), /not connected/);
});

test('demo attempts retain scores, enforce limits, and reject stale questions', () => {
  const original = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  try {
    const quiz = demoSave({ ...demoQuizzes()[0], maxAttempts: 2 });
    const correct = { q1: 'c1' };
    assert.equal(submitDemoAttempt(quiz, correct).score, 2);
    assert.equal(submitDemoAttempt(quiz, { q1: 'c2' }).score, 0);
    assert.equal(demoQuizzes()[0].attempts.length, 2);
    assert.throws(() => submitDemoAttempt(quiz, correct), /No attempts/);
    assert.throws(() => submitDemoAttempt({ ...quiz, questions: [] }, correct), /changed/);
  } finally { globalThis.localStorage = original; }
});

test('401 requests prompt reauthentication; 403 keeps the session and reports permissions', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type) };
  try {
    const user = { id: 1, getAccessTokenSilently: async () => 'test-token' };
    let sentHeaders;
    globalThis.fetch = async (url, options) => { sentHeaders = options.headers; return { status: 401, ok: false, json: async () => ({ error: 'Expired' }) }; };
    await assert.rejects(apiRequest(user, '/quizzes/1'), /sign in again/);
    assert.equal(sentHeaders.Authorization, 'Bearer test-token');
    assert.equal('X-User-Id' in sentHeaders, false);
    assert.deepEqual(events, ['session-expired']);
    globalThis.fetch = async () => ({ status: 403, ok: false, json: async () => ({ error: 'Not assigned to module' }) });
    await assert.rejects(apiRequest(user, '/quizzes/1'), /Not assigned/);
    assert.equal(events.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});
