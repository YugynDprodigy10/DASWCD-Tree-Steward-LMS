import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("visibility");
const { api } = context;

before(() => context.setup());
after(() => context.cleanup());

async function setVisibility(body) {
  const result = await api(`/admin/modules/${context.moduleId}/visibility`, {
    as: "admin",
    method: "PATCH",
    body,
  });
  assert.equal(result.status, 200);
}

async function listedFor(as) {
  const result = await api("/modules", { as });
  assert.equal(result.status, 200);
  return result.body.modules.some((module) => module.id === context.moduleId);
}

test("hiding a module from students removes it from their list and blocks its content", async () => {
  // Publish a one-question quiz and an announcement so there is content to block.
  const quiz = await api(`/modules/${context.moduleId}/quizzes`, {
    as: "teacher",
    method: "POST",
    body: { title: "Hidden module quiz" },
  });
  assert.equal(quiz.status, 201);
  const quizId = quiz.body.quiz.id;
  const question = await api(`/quizzes/${quizId}/questions`, {
    as: "teacher",
    method: "POST",
    body: {
      text: "Which tree is native?",
      points: 1,
      choices: [
        { text: "Desert willow", isCorrect: true },
        { text: "Tree of heaven", isCorrect: false },
      ],
    },
  });
  assert.equal(question.status, 201);
  assert.equal(
    (await api(`/quizzes/${quizId}/publish`, { as: "teacher", method: "POST" })).status,
    200,
  );
  assert.equal(
    (await api(`/modules/${context.moduleId}/announcements`, {
      as: "teacher",
      method: "POST",
      body: { title: "Welcome", description: "Hello class", published: true },
    })).status,
    201,
  );

  assert.equal(await listedFor("student"), true);
  await setVisibility({ studentsVisible: false });

  assert.equal(await listedFor("student"), false);
  assert.equal(
    (await api(`/modules/${context.moduleId}/quizzes`, { as: "student" })).status,
    403,
  );
  assert.equal((await api(`/quizzes/${quizId}`, { as: "student" })).status, 404);
  assert.equal(
    (await api(`/modules/${context.moduleId}/announcements`, { as: "student" })).status,
    403,
  );
  const attempt = await api(`/quizzes/${quizId}/attempts`, {
    as: "student",
    method: "POST",
    body: { answers: [] },
  });
  assert.equal(attempt.status, 404);

  // The module's own instructor and admins still see it.
  assert.equal(await listedFor("teacher"), true);
  assert.equal(await listedFor("admin"), true);
  assert.equal(
    (await api(`/modules/${context.moduleId}/quizzes`, { as: "teacher" })).status,
    200,
  );

  await setVisibility({ studentsVisible: true });
  assert.equal(await listedFor("student"), true);
  assert.equal(
    (await api(`/modules/${context.moduleId}/quizzes`, { as: "student" })).status,
    200,
  );
});

test("hiding a module from instructors only affects instructors who aren't assigned to it", async () => {
  assert.equal(await listedFor("otherTeacher"), true);
  await setVisibility({ instructorsVisible: false });

  assert.equal(await listedFor("otherTeacher"), false);
  assert.equal(
    (await api(`/modules/${context.moduleId}/quizzes`, { as: "otherTeacher" })).status,
    403,
  );
  assert.equal(await listedFor("teacher"), true);
  assert.equal(
    (await api(`/modules/${context.moduleId}/quizzes`, { as: "teacher" })).status,
    200,
  );

  await setVisibility({ instructorsVisible: true });
});

test("the module list requires sign-in", async () => {
  assert.equal((await api("/modules")).status, 401);
});