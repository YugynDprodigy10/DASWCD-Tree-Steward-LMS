import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("activity");
const { api } = context;

before(() => context.setup());
after(() => context.cleanup());

async function recordView({ visitId = crypto.randomUUID(), pageKey, title, durationSeconds }) {
  return api("/activity/views", {
    as: "student",
    method: "POST",
    body: {
      visitId,
      moduleId: context.moduleId,
      pageKey,
      title,
      durationSeconds,
    },
  });
}

async function ageVisit(visitId) {
  await context.pool.query(
    `UPDATE studentPageViews
     SET createdAt = CURRENT_TIMESTAMP - INTERVAL '1000 seconds'
     WHERE visitID = $1 AND userID = $2`,
    [visitId, context.users.student],
  );
}

test("students can record cumulative module-page time, and analytics ranks the top five by share", async () => {
  const durations = [5, 10, 15, 20, 50, 100];
  const visitIds = [];
  for (const [index, durationSeconds] of durations.entries()) {
    const visitId = crypto.randomUUID();
    visitIds.push(visitId);
    const firstView = await recordView({
      visitId,
      pageKey: `content:lesson-${index}`,
      title: `Lesson ${index}`,
      durationSeconds: 0,
    });
    assert.equal(firstView.status, 200);
    await ageVisit(visitId);
    const response = await recordView({
      visitId,
      pageKey: `content:lesson-${index}`,
      title: `Lesson ${index}`,
      durationSeconds,
    });
    assert.equal(response.status, 200);
  }

  assert.equal((await recordView({
    visitId: visitIds[0],
    pageKey: "content:lesson-0",
    title: "Lesson 0",
    durationSeconds: 2,
  })).status, 200);

  const progressVisitId = crypto.randomUUID();
  assert.equal((await recordView({
    visitId: progressVisitId,
    pageKey: "navigation:my-progress",
    durationSeconds: 0,
  })).status, 200);
  await ageVisit(progressVisitId);
  assert.equal((await recordView({
    visitId: progressVisitId,
    pageKey: "navigation:my-progress",
    durationSeconds: 500,
  })).status, 200);

  const summary = await api(`/activity/modules/${context.moduleId}/summary`, {
    as: "teacher",
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.totalSeconds, 200);
  assert.deepEqual(
    summary.body.pages.map(({ title, seconds, percentage }) => ({
      title,
      seconds,
      percentage,
    })),
    [
      { title: "Lesson 5", seconds: 100, percentage: 50 },
      { title: "Lesson 4", seconds: 50, percentage: 25 },
      { title: "Lesson 3", seconds: 20, percentage: 10 },
      { title: "Lesson 2", seconds: 15, percentage: 7.5 },
      { title: "Lesson 1", seconds: 10, percentage: 5 },
    ],
  );
});

test("activity routes enforce student enrollment and teacher module scope", async () => {
  assert.equal((await api("/activity/views", {
    as: "teacher",
    method: "POST",
    body: {
      visitId: crypto.randomUUID(),
      moduleId: context.moduleId,
      pageKey: "content:lesson",
      title: "Lesson",
      durationSeconds: 1,
    },
  })).status, 403);

  assert.equal((await api("/activity/views", {
    as: "outsider",
    method: "POST",
    body: {
      visitId: crypto.randomUUID(),
      moduleId: context.moduleId,
      pageKey: "content:lesson",
      title: "Lesson",
      durationSeconds: 1,
    },
  })).status, 403);
  assert.equal((await api("/activity/modules", { as: "student" })).status, 403);
  assert.equal(
    (await api(`/activity/modules/${context.moduleId}/summary`, {
      as: "otherTeacher",
    })).status,
    404,
  );
  assert.deepEqual(
    (await api("/activity/modules", { as: "otherTeacher" })).body.modules,
    [],
  );
  assert.equal((await api("/activity/modules", { as: "admin" })).status, 200);
});

test("activity events validate page keys, duration, and visit identity", async () => {
  const invalid = await recordView({
    visitId: "not-a-uuid",
    pageKey: "Home",
    title: "Home",
    durationSeconds: -1,
  });
  assert.equal(invalid.status, 400);

  const visitId = crypto.randomUUID();
  assert.equal((await recordView({
    visitId,
    pageKey: "content:lesson",
    title: "Lesson",
    durationSeconds: 1,
  })).status, 200);
  assert.equal((await recordView({
    visitId,
    pageKey: "content:another-lesson",
    title: "Another lesson",
    durationSeconds: 2,
  })).status, 409);
});

test("reported time cannot exceed the elapsed lifetime of a page visit", async () => {
  const visitId = crypto.randomUUID();
  assert.equal((await recordView({
    visitId,
    pageKey: "content:timed-lesson",
    title: "Timed lesson",
    durationSeconds: 0,
  })).status, 200);
  assert.equal((await recordView({
    visitId,
    pageKey: "content:timed-lesson",
    title: "Timed lesson",
    durationSeconds: 86400,
  })).status, 200);

  const result = await context.pool.query(
    `SELECT durationSeconds,
            FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - createdAt)))::int AS elapsed
     FROM studentPageViews
     WHERE visitID = $1 AND userID = $2`,
    [visitId, context.users.student],
  );
  assert.ok(result.rows[0].durationseconds <= result.rows[0].elapsed);
});
