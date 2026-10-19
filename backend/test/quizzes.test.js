// Tests for the quiz API. They need the development database running
// (npm run migrate starts it). Each run creates its own module and users
// with unique names and deletes them afterwards.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import pool from "../src/db/pool.js";

const tag = `quiztest-${Date.now()}`;
let server;
let baseUrl;
let moduleId;
const users = {};

async function makeUser(name, roles) {
  const result = await pool.query(
    `INSERT INTO users (username, email, passwordTemp, student, teacher, administrator)
     VALUES ($1, $2, 'not-used', $3, $4, FALSE) RETURNING userID`,
    [`${tag}-${name}`, `${tag}-${name}@example.com`, roles.student ?? false, roles.teacher ?? false],
  );
  return result.rows[0].userid;
}

function api(path, { as, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (as) headers["X-User-Id"] = String(users[as]);
  return fetch(`${baseUrl}/api${path}`, { method, headers, body: body && JSON.stringify(body) })
    .then(async (response) => ({ status: response.status, body: await response.json() }));
}

const question = (text, points, correctIndex, count = 3) => ({
  text,
  points,
  choices: Array.from({ length: count }, (_, i) => ({ text: `${text} option ${i + 1}`, isCorrect: i === correctIndex })),
});

before(async () => {
  const moduleRow = await pool.query("INSERT INTO modules (name) VALUES ($1) RETURNING moduleID", [tag]);
  moduleId = moduleRow.rows[0].moduleid;
  users.teacher = await makeUser("teacher", { teacher: true });
  users.otherTeacher = await makeUser("other-teacher", { teacher: true });
  users.student = await makeUser("student", { student: true });
  users.outsider = await makeUser("outsider", { student: true });
  await pool.query("INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)", [moduleId, users.teacher]);
  await pool.query("INSERT INTO moduleStudents (moduleID, userID, status) VALUES ($1, $2, 'active')", [moduleId, users.student]);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  const ids = Object.values(users);
  await pool.query("DELETE FROM quizAttemptAnswers WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizAttempts WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizAnswerChoices WHERE questionID IN (SELECT questionID FROM quizQuestions q JOIN modulePages p USING (modulePageID) WHERE p.moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizQuestions WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM modulePages WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM moduleTeachers WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM moduleStudents WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM modules WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM users WHERE userID = ANY($1)", [ids]);
  await pool.end();
});

let quizId;

test("quiz routes require a signed-in user, but the health check does not", async () => {
  assert.equal((await api(`/modules/${moduleId}/quizzes`)).status, 401);
  assert.equal((await api("/health")).status, 200);
});

test("only the module's instructor can create a quiz, and it starts as a draft", async () => {
  const denied = await api(`/modules/${moduleId}/quizzes`, { as: "otherTeacher", method: "POST", body: { title: "Nope" } });
  assert.equal(denied.status, 403);

  const created = await api(`/modules/${moduleId}/quizzes`, { as: "teacher", method: "POST", body: { title: "  Native trees  " } });
  assert.equal(created.status, 201);
  assert.equal(created.body.quiz.title, "Native trees");
  assert.equal(created.body.quiz.published, false);
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
  assert.equal(list.status, 200);
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