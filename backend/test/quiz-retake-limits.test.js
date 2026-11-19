import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("retakes");
const { api } = context;

before(() => context.setup());
after(() => context.cleanup());

async function publishedQuiz(title) {
  const created = await api(`/modules/${context.moduleId}/quizzes`, {
    as: "teacher",
    method: "POST",
    body: { title },
  });
  assert.equal(created.status, 201);
  const quizId = created.body.quiz.id;
  const added = await api(`/quizzes/${quizId}/questions`, {
    as: "teacher",
    method: "POST",
    body: {
      text: "Which tree is native to the Chihuahuan Desert?",
      points: 1,
      choices: [
        { text: "Desert willow", isCorrect: true },
        { text: "Tree of heaven", isCorrect: false },
      ],
    },
  });
  assert.equal(added.status, 201);
  assert.equal(
    (await api(`/quizzes/${quizId}/publish`, { as: "teacher", method: "POST" })).status,
    200,
  );
  return { quizId, question: added.body.quiz.questions[0] };
}

function submit({ quizId, question }, as = "student") {
  return api(`/quizzes/${quizId}/attempts`, {
    as,
    method: "POST",
    body: { answers: [{ questionId: question.id, choiceId: question.choices[0].id }] },
  });
}

function setLimit(quizId, maxAttempts, as = "teacher") {
  return api(`/quizzes/${quizId}`, { as, method: "PATCH", body: { maxAttempts } });
}

test("a new quiz allows one attempt and tells the builder retakes are supported", async () => {
  const quiz = await publishedQuiz("One try");
  const view = await api(`/quizzes/${quiz.quizId}`, { as: "teacher" });
  assert.equal(view.body.quiz.maxAttempts, 1);
  assert.equal(view.body.quiz.capabilities.retakePolicy, true);

  const list = await api(`/modules/${context.moduleId}/quizzes`, { as: "student" });
  assert.equal(list.body.quizzes.find((item) => item.id === quiz.quizId).maxAttempts, 1);

  assert.equal((await submit(quiz)).status, 201);
  const second = await submit(quiz);
  assert.equal(second.status, 409);
  assert.match(second.body.error, /already taken/);
});

test("students can retake up to the instructor's limit, and every score is kept", async () => {
  const quiz = await publishedQuiz("Three tries");
  const saved = await setLimit(quiz.quizId, 3);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.quiz.maxAttempts, 3);
  assert.equal(saved.body.quiz.title, "Three tries", "changing the limit keeps the title");

  for (let i = 0; i < 3; i += 1) assert.equal((await submit(quiz)).status, 201);
  const fourth = await submit(quiz);
  assert.equal(fourth.status, 409);
  assert.match(fourth.body.error, /all 3 attempts/);

  const mine = await api(`/quizzes/${quiz.quizId}/attempts/me`, { as: "student" });
  assert.equal(mine.body.attempts.length, 3);

  // Raising the limit lets the student try again; lowering it keeps old scores.
  assert.equal((await setLimit(quiz.quizId, 4)).status, 200);
  assert.equal((await submit(quiz)).status, 201);
  assert.equal((await setLimit(quiz.quizId, 1)).status, 200);
  assert.equal((await submit(quiz)).status, 409);
  const after = await api(`/quizzes/${quiz.quizId}/attempts/me`, { as: "student" });
  assert.equal(after.body.attempts.length, 4);
});

test("simultaneous submissions can't get past the limit", async () => {
  const quiz = await publishedQuiz("Double click");
  const results = await Promise.all([submit(quiz), submit(quiz), submit(quiz)]);
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [201, 409, 409]);
});

test("only the module's instructor can change the limit, and only to 1–10", async () => {
  const quiz = await publishedQuiz("Guarded");
  assert.equal((await setLimit(quiz.quizId, 2, "student")).status, 403);
  assert.equal((await setLimit(quiz.quizId, 2, "otherTeacher")).status, 403);
  for (const bad of [0, 11, 2.5, "3", null]) {
    assert.equal((await setLimit(quiz.quizId, bad)).status, 400, `rejects ${JSON.stringify(bad)}`);
  }
  const empty = await api(`/quizzes/${quiz.quizId}`, { as: "teacher", method: "PATCH", body: {} });
  assert.equal(empty.status, 400);
  assert.equal((await setLimit(quiz.quizId, 10, "admin")).status, 200);
});