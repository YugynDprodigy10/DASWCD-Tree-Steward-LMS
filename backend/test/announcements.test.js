import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("announcements");
const { api, pool } = context;

before(() => context.setup());
after(() => context.cleanup());

test("instructors create and edit announcements that persist in the database", async () => {
  const values = {
    title: "  Field day update  ",
    description: "  Meet at the arboretum gate.  ",
    published: false,
  };
  const denied = await api(`/modules/${context.moduleId}/announcements`, {
    as: "otherTeacher",
    method: "POST",
    body: values,
  });
  assert.equal(denied.status, 403);

  const created = await api(`/modules/${context.moduleId}/announcements`, {
    as: "teacher",
    method: "POST",
    body: values,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.announcement.title, "Field day update");
  assert.equal(created.body.announcement.description, "Meet at the arboretum gate.");
  assert.equal(created.body.announcement.published, false);

  const id = created.body.announcement.id;
  const stored = await pool.query(
    `SELECT moduleID, modulePageTitle, pageType, announcementTitle,
            announcementText, published
     FROM modulePages WHERE modulePageID = $1`,
    [id],
  );
  assert.deepEqual(stored.rows[0], {
    moduleid: context.moduleId,
    modulepagetitle: "Field day update",
    pagetype: "announcement",
    announcementtitle: "Field day update",
    announcementtext: "Meet at the arboretum gate.",
    published: false,
  });

  const draftList = await api(`/modules/${context.moduleId}/announcements`, {
    as: "student",
  });
  assert.deepEqual(draftList.body.announcements, []);

  const updated = await api(`/announcements/${id}`, {
    as: "teacher",
    method: "PATCH",
    body: { ...values, title: "Field day is Saturday", published: true },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.announcement.title, "Field day is Saturday");

  const studentList = await api(`/modules/${context.moduleId}/announcements`, {
    as: "student",
  });
  assert.equal(studentList.body.announcements.length, 1);
  assert.equal(studentList.body.announcements[0].id, id);
  assert.equal(studentList.body.announcements[0].published, true);

  const unassignedEdit = await api(`/announcements/${id}`, {
    as: "otherTeacher",
    method: "PATCH",
    body: { ...values, title: "Not allowed" },
  });
  assert.equal(unassignedEdit.status, 403);
});

test("announcement validation rejects blank content and non-instructors", async () => {
  const blank = await api(`/modules/${context.moduleId}/announcements`, {
    as: "teacher",
    method: "POST",
    body: { title: " ", description: "text", published: false },
  });
  assert.equal(blank.status, 400);

  const studentCreate = await api(`/modules/${context.moduleId}/announcements`, {
    as: "student",
    method: "POST",
    body: { title: "Update", description: "Text", published: true },
  });
  assert.equal(studentCreate.status, 403);
});
