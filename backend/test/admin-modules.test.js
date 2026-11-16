import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("adminmodules");
const { api, pool, users } = context;

before(() => context.setup());
after(() => context.cleanup());

test("admins can see module visibility and current teacher assignments", async () => {
  const result = await api("/admin/modules", { as: "admin" });
  assert.equal(result.status, 200);
  const module = result.body.modules.find((item) => item.id === context.moduleId);
  assert.ok(module);
  assert.equal(module.studentsVisible, true);
  assert.equal(module.instructorsVisible, true);
  assert.deepEqual(module.teacherIds, [users.teacher]);
  const listedTeacherIds = result.body.teachers.map((teacher) => teacher.id);
  assert.ok(listedTeacherIds.includes(users.teacher));
  assert.ok(listedTeacherIds.includes(users.otherTeacher));
});

test("admins can save instructor assignments and module visibility", async () => {
  const assigned = await api(
    `/admin/modules/${context.moduleId}/teachers`,
    {
      as: "admin",
      method: "PATCH",
      body: { teacherIds: [users.otherTeacher] },
    },
  );
  assert.equal(assigned.status, 200);
  assert.deepEqual(assigned.body.module.teacherIds, [users.otherTeacher]);

  const storedAssignments = await pool.query(
    "SELECT userID FROM moduleTeachers WHERE moduleID = $1",
    [context.moduleId],
  );
  assert.deepEqual(storedAssignments.rows.map((row) => row.userid), [
    users.otherTeacher,
  ]);

  const visibility = await api(
    `/admin/modules/${context.moduleId}/visibility`,
    {
      as: "admin",
      method: "PATCH",
      body: { studentsVisible: false },
    },
  );
  assert.equal(visibility.status, 200);
  assert.equal(visibility.body.module.studentsVisible, false);
  assert.equal(visibility.body.module.instructorsVisible, true);

  const persisted = await pool.query(
    "SELECT studentsVisible FROM modules WHERE moduleID = $1",
    [context.moduleId],
  );
  assert.equal(persisted.rows[0].studentsvisible, false);

  const reloaded = await api("/admin/modules", { as: "admin" });
  const reloadedModule = reloaded.body.modules.find(
    (item) => item.id === context.moduleId,
  );
  assert.equal(reloadedModule.studentsVisible, false);
  assert.deepEqual(reloadedModule.teacherIds, [users.otherTeacher]);
});

test("module administration rejects invalid assignments, visibility, and non-admins", async () => {
  const invalidTeacher = await api(
    `/admin/modules/${context.moduleId}/teachers`,
    {
      as: "admin",
      method: "PATCH",
      body: { teacherIds: [users.student] },
    },
  );
  assert.equal(invalidTeacher.status, 400);

  const invalidVisibility = await api(
    `/admin/modules/${context.moduleId}/visibility`,
    {
      as: "admin",
      method: "PATCH",
      body: { studentsVisible: "false" },
    },
  );
  assert.equal(invalidVisibility.status, 400);

  assert.equal(
    (await api("/admin/modules", { as: "teacher" })).status,
    403,
  );
});
