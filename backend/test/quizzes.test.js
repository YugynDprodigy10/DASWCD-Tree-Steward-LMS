// Quiz behavior tests use the shared authentication fixtures in test-support.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("quiztest");
const { api, pool, users } = context;
let moduleId;
const question = (text, points, correctIndex, count = 3) => ({
  text,
  points,
  choices: Array.from({ length: count }, (_, i) => ({ text: `${text} option ${i + 1}`, isCorrect: i === correctIndex })),
});

before(async () => {
  await context.setup();
  moduleId = context.moduleId;
});

after(() => context.cleanup());

let quizId;

test("only the module's instructor can create a quiz, and it starts as a draft", async () => {
  const denied = await api(`/modules/${moduleId}/quizzes`, { as: "otherTeacher", method: "POST", body: { title: "Nope" } });
  assert.equal(denied.status, 403);

  const created = await api(`/modules/${moduleId}/quizzes`, { as: "teacher", method: "POST", body: { title: "  Native trees  " } });
  assert.equal(created.status, 201);
  assert.equal(created.body.quiz.title, "Native trees");
  assert.equal(created.body.quiz.published, false);
  assert.ok(Number.isInteger(created.body.quiz.order) && created.body.quiz.order >= 1, "new quizzes report their position in the module");
  quizId = created.body.quiz.id;
});

test("questions must have 2 to 6 choices and exactly one correct answer", async () => {
  const noCorrect = await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Q", 1, -1) });
  assert.equal(noCorrect.status, 400);
  const oneChoice = await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Q", 1, 0, 1) });
  assert.equal(oneChoice.status, 400);
  const twoCorrect = { text: "Q", choices: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] };
  assert.equal((await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: twoCorrect })).status, 400);
});

test("an empty quiz can't be published", async () => {
  const result = await api(`/quizzes/${quizId}/publish`, { as: "teacher", method: "POST" });
  assert.equal(result.status, 400);
});

test("instructors build questions; students can't see drafts", async () => {
  await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Which tree is native?", 2, 1) });
  const second = await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Best watering time?", 3, 0) });
  assert.equal(second.status, 201);
  assert.equal(second.body.quiz.questions.length, 2);
  assert.equal(second.body.quiz.totalPoints, 5);

  assert.equal((await api(`/quizzes/${quizId}`, { as: "student" })).status, 404);
  const list = await api(`/modules/${moduleId}/quizzes`, { as: "student" });
  assert.equal(list.body.quizzes.length, 0);
});

test("editing a question replaces its choices; deleting removes it", async () => {
  const added = await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Temporary", 1, 0) });
  const temp = added.body.quiz.questions.at(-1);
  const edited = await api(`/quizzes/${quizId}/questions/${temp.id}`, { as: "teacher", method: "PUT", body: question("Edited", 4, 1, 2) });
  const editedQuestion = edited.body.quiz.questions.at(-1);
  assert.equal(editedQuestion.text, "Edited");
  assert.equal(editedQuestion.choices.length, 2);
  assert.equal(editedQuestion.choices[1].isCorrect, true);

  const removed = await api(`/quizzes/${quizId}/questions/${temp.id}`, { as: "teacher", method: "DELETE" });
  assert.equal(removed.body.quiz.questions.length, 2);
});

test("published quizzes are visible to enrolled students without the answers", async () => {
  assert.equal((await api(`/quizzes/${quizId}/publish`, { as: "teacher", method: "POST" })).status, 200);
  const view = await api(`/quizzes/${quizId}`, { as: "student" });
  assert.equal(view.status, 200);
  for (const item of view.body.quiz.questions) {
    for (const choice of item.choices) assert.equal("isCorrect" in choice, false);
  }
  assert.equal((await api(`/quizzes/${quizId}`, { as: "outsider" })).status, 404);
});

test("other instructors can view published quizzes read-only, without the answers", async () => {
  const list = await api(`/modules/${moduleId}/quizzes`, { as: "otherTeacher" });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.quizzes.length, 1);
  const view = await api(`/quizzes/${quizId}`, { as: "otherTeacher" });
  assert.equal(view.status, 200);
  assert.equal("isCorrect" in view.body.quiz.questions[0].choices[0], false);
  const edit = await api(`/quizzes/${quizId}`, { as: "otherTeacher", method: "PATCH", body: { title: "Hijacked" } });
  assert.equal(edit.status, 403);
});

test("students must answer every question, and the server scores the attempt", async () => {
  const quiz = (await api(`/quizzes/${quizId}`, { as: "teacher" })).body.quiz;
  const [first, second] = quiz.questions;
  const correctFirst = first.choices.find((choice) => choice.isCorrect).id;
  const wrongSecond = second.choices.find((choice) => !choice.isCorrect).id;

  const partial = await api(`/quizzes/${quizId}/attempts`, { as: "student", method: "POST", body: { answers: [{ questionId: first.id, choiceId: correctFirst }] } });
  assert.equal(partial.status, 400);

  const wrongPairing = await api(`/quizzes/${quizId}/attempts`, {
    as: "student", method: "POST",
    body: { answers: [{ questionId: first.id, choiceId: wrongSecond }, { questionId: second.id, choiceId: correctFirst }] },
  });
  assert.equal(wrongPairing.status, 400);

  const attempt = await api(`/quizzes/${quizId}/attempts`, {
    as: "student", method: "POST",
    body: { answers: [{ questionId: first.id, choiceId: correctFirst }, { questionId: second.id, choiceId: wrongSecond }] },
  });
  assert.equal(attempt.status, 201);
  assert.equal(attempt.body.attempt.score, 2);
  assert.equal(attempt.body.attempt.maxScore, 5);
  assert.deepEqual(attempt.body.attempt.results.map((r) => r.correct), [true, false]);

  const mine = await api(`/quizzes/${quizId}/attempts/me`, { as: "student" });
  assert.equal(mine.body.attempts.length, 1);

  const outsider = await api(`/quizzes/${quizId}/attempts`, { as: "outsider", method: "POST", body: { answers: [] } });
  assert.equal(outsider.status, 404);
});

test("questions are locked once a student has taken the quiz", async () => {
  const locked = await api(`/quizzes/${quizId}/questions`, { as: "teacher", method: "POST", body: question("Late", 1, 0) });
  assert.equal(locked.status, 409);
});

test("a quiz students have taken can't be deleted, so their scores are kept", async () => {
  const refused = await api(`/quizzes/${quizId}`, { as: "teacher", method: "DELETE" });
  assert.equal(refused.status, 409);
  assert.equal((await api(`/quizzes/${quizId}`, { as: "teacher" })).status, 200);
});

test("only the module's instructor can delete an untaken quiz, and it is fully removed", async () => {
  const created = await api(`/modules/${moduleId}/quizzes`, { as: "teacher", method: "POST", body: { title: "Disposable" } });
  const id = created.body.quiz.id;
  await api(`/quizzes/${id}/questions`, { as: "teacher", method: "POST", body: question("Gone soon", 1, 0) });

  assert.equal((await api(`/quizzes/${id}`, { as: "otherTeacher", method: "DELETE" })).status, 403);
  assert.equal((await api(`/quizzes/${id}`, { as: "student", method: "DELETE" })).status, 403);

  const deleted = await api(`/quizzes/${id}`, { as: "teacher", method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.equal((await api(`/quizzes/${id}`, { as: "teacher" })).status, 404);
  const list = await api(`/modules/${moduleId}/quizzes`, { as: "teacher" });
  assert.equal(list.body.quizzes.some((quiz) => quiz.id === id), false);
  const leftovers = await pool.query("SELECT 1 FROM quizQuestions WHERE modulePageID = $1", [id]);
  assert.equal(leftovers.rowCount, 0);
});