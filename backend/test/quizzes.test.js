// Tests for the quiz API. They need the development database running
// (npm run migrate starts it). Each run creates its own module and users
// with unique names and deletes them afterwards.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const tag = `quiztest-${Date.now()}`;
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwks = { ...(await exportJWK(publicKey)), kid: "quiz-test-key", alg: "RS256", use: "sig" };
const jwksServer = createHttpServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ keys: [jwks] }));
});
await new Promise((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
process.env.AUTH0_DOMAIN = "steward-test.auth0.local";
process.env.AUTH0_AUDIENCE = "https://steward-tree.test/api";
process.env.NODE_ENV = "test";
process.env.ENABLE_TEST_LOGIN = "true";
process.env.AUTH0_JWKS_URI = `http://127.0.0.1:${jwksServer.address().port}/.well-known/jwks.json`;
const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/db/pool.js");
let server;
let baseUrl;
let moduleId;
const users = {};
const emails = {};
let insertedLocalTestUserId;

async function makeUser(name, roles) {
  const email = `${tag}-${name}@example.com`;
  const result = await pool.query(
    `INSERT INTO users (username, email, student, teacher, administrator)
     VALUES ($1, $2, $3, $4, FALSE) RETURNING userID`,
    [`${tag}-${name}`, email, roles.student ?? false, roles.teacher ?? false],
  );
  emails[name] = email;
  return result.rows[0].userid;
}

async function api(path, { as, method = "GET", body, tokenClaims, bearerToken } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (as) {
    const email = emails[as];
    const token = await new SignJWT({
      "https://stewardtree.app/claims/email": email,
      "https://stewardtree.app/claims/email_verified": true,
      ...tokenClaims,
    })
      .setProtectedHeader({ alg: "RS256", kid: jwks.kid })
      .setIssuer("https://steward-test.auth0.local/")
      .setAudience(process.env.AUTH0_AUDIENCE)
      .setSubject(`auth0|${users[as]}`)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    headers.Authorization = `Bearer ${token}`;
  }
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
  const seededStudent = await pool.query(
    "SELECT userID FROM users WHERE LOWER(username) = 'test student 1'",
  );
  if (!seededStudent.rows[0]) {
    const localTestUser = await pool.query(
      `INSERT INTO users (username, email, student, teacher, administrator)
       VALUES ('test student 1', $1, TRUE, FALSE, FALSE) RETURNING userID`,
      [`${tag}-local-test@example.com`],
    );
    insertedLocalTestUserId = localTestUser.rows[0].userid;
  }
  users.teacher = await makeUser("teacher", { teacher: true });
  users.otherTeacher = await makeUser("otherTeacher", { teacher: true });
  users.student = await makeUser("student", { student: true });
  users.outsider = await makeUser("outsider", { student: true });
  await pool.query("INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)", [moduleId, users.teacher]);
  await pool.query("INSERT INTO moduleStudents (moduleID, userID, status) VALUES ($1, $2, 'active')", [moduleId, users.student]);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve());
  await new Promise((resolve) => jwksServer.close(resolve));
  const ids = Object.values(users);
  await pool.query("DELETE FROM quizAttemptAnswers WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizAttempts WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizAnswerChoices WHERE questionID IN (SELECT questionID FROM quizQuestions q JOIN modulePages p USING (modulePageID) WHERE p.moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM quizQuestions WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)", [moduleId]);
  await pool.query("DELETE FROM modulePages WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM moduleTeachers WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM moduleStudents WHERE moduleID = $1", [moduleId]);
  await pool.query("DELETE FROM modules WHERE moduleID = $1", [moduleId]);
  if (insertedLocalTestUserId) {
    await pool.query("DELETE FROM users WHERE userID = $1", [insertedLocalTestUserId]);
  }
  await pool.query("DELETE FROM users WHERE userID = ANY($1)", [ids]);
  await pool.end();
});

let quizId;

test("quiz routes require a signed-in user, but the health check does not", async () => {
  assert.equal((await api(`/modules/${moduleId}/quizzes`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/modules/${moduleId}/quizzes`, { headers: { "X-User-Id": String(users.teacher) } })).status, 401);
  assert.equal((await api("/health")).status, 200);
});

test("Auth0 identity is linked to the pre-provisioned account and supplies its role", async () => {
  const result = await api("/auth/me", { as: "teacher" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user.roles, ["teacher"]);
  const linked = await pool.query("SELECT auth0Sub FROM users WHERE userID = $1", [users.teacher]);
  assert.equal(linked.rows[0].auth0sub, `auth0|${users.teacher}`);
});

test("only verified emails with a provisioned LMS account can authenticate", async () => {
  const unverified = await api("/auth/me", {
    as: "student",
    tokenClaims: { "https://stewardtree.app/claims/email_verified": false },
  });
  assert.equal(unverified.status, 403);

  const unknown = await api("/auth/me", {
    as: "student",
    tokenClaims: {
      "https://stewardtree.app/claims/email": "unknown@example.com",
    },
  });
  assert.equal(unknown.status, 403);
});

test("local test sign-in uses a seeded LMS account and issues a short-lived API token", async () => {
  const login = await api("/auth/test-login", {
    method: "POST",
    body: { account: "student" },
  });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.user.roles, ["student"]);
  assert.ok(login.body.accessToken);

  const identity = await api("/auth/me", { bearerToken: login.body.accessToken });
  assert.equal(identity.status, 200);
  assert.equal(identity.body.user.id, login.body.user.id);
  assert.deepEqual(identity.body.user.roles, ["student"]);

  const invalid = await api("/auth/test-login", {
    method: "POST",
    body: { account: "unknown" },
  });
  assert.equal(invalid.status, 400);
});

test("local test sign-in is unavailable in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = await api("/auth/test-login", {
      method: "POST",
      body: { account: "student" },
    });
    assert.equal(result.status, 404);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

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