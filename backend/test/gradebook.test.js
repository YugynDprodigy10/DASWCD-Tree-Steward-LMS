import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("gradebook");
const { api } = context;

before(() => context.setup());
after(() => context.cleanup());

async function createPublishedQuiz(title, points) {
  const created = await api(`/modules/${context.moduleId}/quizzes`, {
    as: "teacher",
    method: "POST",
    body: { title },
  });
  assert.equal(created.status, 201);
  const quizId = created.body.quiz.id;
  const question = await api(`/quizzes/${quizId}/questions`, {
    as: "teacher",
    method: "POST",
    body: {
      text: `${title} question`,
      points,
      choices: [
        { text: "Correct", isCorrect: true },
        { text: "Incorrect", isCorrect: false },
      ],
    },
  });
  assert.equal(question.status, 201);
  assert.equal(
    (await api(`/quizzes/${quizId}/publish`, {
      as: "teacher",
      method: "POST",
    })).status,
    200,
  );
  return { quizId, question: question.body.quiz.questions[0] };
}

async function submitAnswer(quizId, question, correct) {
  const answer = await api(`/quizzes/${quizId}/attempts`, {
    as: "student",
    method: "POST",
    body: {
      answers: [
        {
          questionId: question.id,
          choiceId: question.choices[correct ? 0 : 1].id,
        },
      ],
    },
  });
  assert.equal(answer.status, 201);
}

test("students see their own equal-weight module grades when every published quiz is attempted", async () => {
  const first = await createPublishedQuiz("Long quiz", 5);
  const second = await createPublishedQuiz("Short quiz", 1);
  const draft = await api(`/modules/${context.moduleId}/quizzes`, {
    as: "teacher",
    method: "POST",
    body: { title: "Draft quiz" },
  });
  assert.equal(draft.status, 201);

  await submitAnswer(first.quizId, first.question, false);
  let gradebook = await api("/gradebook", { as: "student" });
  assert.equal(gradebook.status, 200);
  assert.equal(gradebook.body.modules.length, 1);
  assert.equal(gradebook.body.modules[0].grade, null);
  assert.equal(gradebook.body.modules[0].completedQuizCount, 1);
  assert.equal(gradebook.body.modules[0].quizzes[1].percentage, null);

  await submitAnswer(second.quizId, second.question, true);
  gradebook = await api("/gradebook", { as: "student" });
  const module = gradebook.body.modules[0];
  assert.equal(module.quizCount, 2);
  assert.equal(module.grade, 50);
  assert.equal(module.quizCount, 2, "draft quizzes do not affect the module grade");
  assert.deepEqual(
    module.quizzes.map((quiz) => quiz.percentage),
    [0, 100],
  );
  assert.equal("email" in module, false);

  await submitAnswer(first.quizId, first.question, true);
  gradebook = await api("/gradebook", { as: "student" });
  assert.equal(gradebook.body.modules[0].grade, 100);
  assert.equal(gradebook.body.modules[0].quizzes[0].attemptCount, 2);

  const teacherGradebook = await api("/gradebook", { as: "teacher" });
  assert.equal(teacherGradebook.status, 200);
  assert.equal(teacherGradebook.body.modules.length, 1);
  assert.equal(teacherGradebook.body.modules[0].quizzes.length, 2);
  assert.equal(teacherGradebook.body.modules[0].students.length, 1);
  assert.equal(teacherGradebook.body.modules[0].students[0].grade, 100);
  assert.equal(
    teacherGradebook.body.modules[0].students[0].email,
    context.emails.student,
  );

  assert.deepEqual((await api("/gradebook", { as: "otherTeacher" })).body.modules, []);
  assert.deepEqual((await api("/gradebook", { as: "outsider" })).body.modules, []);
  assert.equal((await api("/gradebook", { as: "admin" })).status, 403);
});
