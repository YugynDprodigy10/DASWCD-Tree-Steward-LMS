// Lesson and lesson-file tests. They use the shared sign-in fixtures in test-support and the
// real local database, but S3 is replaced with fakes (mock.method on the storage object),
// so they never touch the real bucket and need no AWS keys.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";
import { storage, MAX_FILE_BYTES } from "../src/storage/s3.js";

const context = createAuthTestContext("lessontest");
const { api, pool, users } = context;
let moduleId;
let otherModuleId; // a second module, taught by otherTeacher, for cross-module checks

// The fake bucket. A test "uploads" a file by putting its key here, the way the browser
// would POST it to S3. deletedKeys records every key the routes asked S3 to delete.
const bucket = new Map(); // key -> { size, contentType }
const deletedKeys = [];

before(async () => {
  await context.setup();
  moduleId = context.moduleId;

  const other = await pool.query("INSERT INTO modules (name) VALUES ($1) RETURNING moduleID", [`${context.tag}-other`]);
  otherModuleId = other.rows[0].moduleid;
  await pool.query("INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)", [otherModuleId, users.otherTeacher]);

  mock.method(storage, "uploadForm", async (key, contentType) => ({
    url: "https://s3.test/bucket",
    fields: { key, "Content-Type": contentType },
  }));
  mock.method(storage, "fileInfo", async (key) => bucket.get(key) ?? null);
  mock.method(storage, "signedUrl", async (key) => `https://s3.test/${key}?signed`);
  mock.method(storage, "deleteFile", async (key) => {
    deletedKeys.push(key);
    bucket.delete(key);
  });
});

after(async () => {
  mock.restoreAll();
  await pool.query("DELETE FROM lessonFiles WHERE moduleID = $1", [otherModuleId]);
  await pool.query("DELETE FROM moduleLessons WHERE moduleID = $1", [otherModuleId]);
  await pool.query("DELETE FROM moduleTeachers WHERE moduleID = $1", [otherModuleId]);
  await pool.query("DELETE FROM modules WHERE moduleID = $1", [otherModuleId]);
  await context.cleanup();
});

const pdf = (overrides = {}) => ({ fileName: "notes.pdf", contentType: "application/pdf", sizeBytes: 1234, ...overrides });

// asks for an upload form (6b) without uploading anything yet
async function requestForm(as, file = pdf(), module = moduleId) {
  const form = await api(`/modules/${module}/files/upload`, { as, method: "POST", body: file });
  assert.equal(form.status, 201, JSON.stringify(form.body));
  return { fileId: form.body.fileId, key: form.body.fields.key };
}

// the whole browser flow: get a form, "upload" to the fake bucket, then complete (6c)
async function uploadFile(as = "teacher", file = pdf(), module = moduleId) {
  const { fileId, key } = await requestForm(as, file, module);
  bucket.set(key, { size: file.sizeBytes, contentType: file.contentType });
  const done = await api(`/files/${fileId}/complete`, { as, method: "POST" });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  return { fileId, key };
}

async function createLesson(body, as = "teacher") {
  return api(`/modules/${moduleId}/lessons`, { as, method: "POST", body });
}

async function fileRow(fileId) {
  const result = await pool.query("SELECT lessonID, uploaded FROM lessonFiles WHERE fileID = $1", [fileId]);
  return result.rows[0] ?? null;
}

test("lesson and file routes require sign-in", async () => {
  assert.equal((await api(`/modules/${moduleId}/lessons`)).status, 401);
  assert.equal((await api(`/modules/${moduleId}/files/upload`, { method: "POST" })).status, 401);
  assert.equal((await api("/files/1/complete", { method: "POST" })).status, 401);
  assert.equal((await api("/lessons/1", { method: "DELETE" })).status, 401);
});

test("only the module's instructors can get an upload form, and requests are checked", async () => {
  const path = `/modules/${moduleId}/files/upload`;
  assert.equal((await api(path, { as: "student", method: "POST", body: pdf() })).status, 403);
  assert.equal((await api(path, { as: "otherTeacher", method: "POST", body: pdf() })).status, 403);

  for (const bad of [
    pdf({ contentType: "image/png" }),
    pdf({ sizeBytes: MAX_FILE_BYTES + 1 }),
    pdf({ sizeBytes: 0 }),
    pdf({ sizeBytes: undefined }),
    pdf({ fileName: "   " }),
  ]) {
    assert.equal((await api(path, { as: "teacher", method: "POST", body: bad })).status, 400, JSON.stringify(bad));
  }

  // admins pass the permission check for any id, so a missing module must still be a 404
  const missing = await api("/modules/999999999/files/upload", { as: "admin", method: "POST", body: pdf() });
  assert.equal(missing.status, 404);

  const form = await api(path, { as: "teacher", method: "POST", body: pdf({ fileName: "Soil Guide.pdf" }) });
  assert.equal(form.status, 201);
  assert.ok(Number.isInteger(form.body.fileId));
  assert.ok(form.body.url);
  // keys are random, never built from the teacher's file name
  assert.match(form.body.fields.key, new RegExp(`^materials/${moduleId}/[0-9a-f-]{36}$`));
  assert.equal((await fileRow(form.body.fileId)).uploaded, false);
});

test("completing an upload checks S3, deletes mismatches, and is safe to repeat", async () => {
  const notYet = await requestForm("teacher");
  const missing = await api(`/files/${notYet.fileId}/complete`, { as: "teacher", method: "POST" });
  assert.equal(missing.status, 409, "nothing in S3 yet");

  const wrong = await requestForm("teacher");
  bucket.set(wrong.key, { size: 999, contentType: "application/pdf" });
  const mismatch = await api(`/files/${wrong.fileId}/complete`, { as: "teacher", method: "POST" });
  assert.equal(mismatch.status, 409);
  assert.ok(deletedKeys.includes(wrong.key), "a file that doesn't match what was promised is deleted");
  assert.equal((await fileRow(wrong.fileId)).uploaded, false);

  const good = await requestForm("teacher");
  bucket.set(good.key, { size: 1234, contentType: "application/pdf" });
  assert.equal((await api(`/files/${good.fileId}/complete`, { as: "student", method: "POST" })).status, 403);
  const done = await api(`/files/${good.fileId}/complete`, { as: "teacher", method: "POST" });
  assert.equal(done.status, 200);
  assert.deepEqual(done.body, { fileId: good.fileId, fileName: "notes.pdf", contentType: "application/pdf", sizeBytes: 1234 });
  assert.equal((await fileRow(good.fileId)).uploaded, true);

  const again = await api(`/files/${good.fileId}/complete`, { as: "teacher", method: "POST" });
  assert.equal(again.status, 200);
  assert.equal((await api("/files/999999999/complete", { as: "teacher", method: "POST" })).status, 404);
});

test("lessons are validated before anything is saved", async () => {
  assert.equal((await createLesson({ title: "  " })).status, 400);
  assert.equal((await createLesson({ title: "x".repeat(151) })).status, 400);
  assert.equal((await createLesson({ title: "A", content: [{ type: "quiz" }] })).status, 400);
  assert.equal((await createLesson({ title: "A", content: [{ type: "pdf", fileId: "abc" }] })).status, 400);
  const tooMany = Array.from({ length: 51 }, () => ({ type: "text", html: "" }));
  assert.equal((await createLesson({ title: "A", content: tooMany })).status, 400);
  assert.equal((await createLesson({ title: "A" }, "student")).status, 403);
});

test("teachers see drafts; students see only published lessons, with signed file links", async () => {
  const file = await uploadFile();
  const draft = await createLesson({
    title: "  Soil basics  ",
    content: [{ type: "text", html: "<p>Intro</p>" }, { type: "pdf", fileId: file.fileId }],
  });
  assert.equal(draft.status, 201, JSON.stringify(draft.body));
  assert.equal(draft.body.lesson.title, "Soil basics");
  assert.equal(draft.body.lesson.published, false, "lessons are drafts unless published is exactly true");
  assert.equal((await fileRow(file.fileId)).lessonid, draft.body.lesson.lessonId, "the file is claimed by the lesson");

  const studentView = await api(`/modules/${moduleId}/lessons`, { as: "student" });
  assert.equal(studentView.status, 200);
  assert.equal(studentView.body.lessons.length, 0);

  const teacherView = await api(`/modules/${moduleId}/lessons`, { as: "teacher" });
  const [listed] = teacherView.body.lessons;
  assert.equal(listed.title, "Soil basics");
  assert.deepEqual(listed.content[0], { type: "text", html: "<p>Intro</p>" });
  assert.equal(listed.content[1].fileName, "notes.pdf");
  assert.equal(listed.content[1].contentType, "application/pdf");
  assert.equal(listed.content[1].url, `https://s3.test/${file.key}?signed`);

  const video = await uploadFile("teacher", { fileName: "planting.mp4", contentType: "video/mp4", sizeBytes: 5000 });
  const published = await createLesson({
    title: "Planting",
    published: true,
    content: [{ type: "video", fileId: video.fileId, transcript: "Dig a hole." }],
  });
  assert.equal(published.status, 201);

  const nowStudent = await api(`/modules/${moduleId}/lessons`, { as: "student" });
  assert.deepEqual(nowStudent.body.lessons.map((lesson) => lesson.title), ["Planting"]);
  assert.equal(nowStudent.body.lessons[0].content[0].transcript, "Dig a hole.");
  assert.ok(nowStudent.body.lessons[0].content[0].url);

  // other instructors may view published content (same rule as quizzes); outsiders may not
  const other = await api(`/modules/${moduleId}/lessons`, { as: "otherTeacher" });
  assert.deepEqual(other.body.lessons.map((lesson) => lesson.title), ["Planting"]);
  assert.equal((await api(`/modules/${moduleId}/lessons`, { as: "outsider" })).status, 403);
});

test("lessons only accept this module's uploaded files that no other lesson uses", async () => {
  const used = await uploadFile();
  assert.equal((await createLesson({ title: "First", content: [{ type: "pdf", fileId: used.fileId }] })).status, 201);
  const reused = await createLesson({ title: "Second", content: [{ type: "pdf", fileId: used.fileId }] });
  assert.equal(reused.status, 400, "a file belongs to one lesson");

  const notUploaded = await requestForm("teacher");
  assert.equal((await createLesson({ title: "A", content: [{ type: "pdf", fileId: notUploaded.fileId }] })).status, 400);

  const foreign = await uploadFile("otherTeacher", pdf(), otherModuleId);
  assert.equal((await createLesson({ title: "A", content: [{ type: "pdf", fileId: foreign.fileId }] })).status, 400);
  assert.equal((await fileRow(foreign.fileId)).lessonid, null, "the other module's file is untouched");

  assert.equal((await createLesson({ title: "A", content: [{ type: "pdf", fileId: 999999999 }] })).status, 400);

  const twice = await uploadFile();
  const duplicate = await createLesson({
    title: "A",
    content: [{ type: "pdf", fileId: twice.fileId }, { type: "pdf", fileId: twice.fileId }],
  });
  assert.equal(duplicate.status, 400);
});

test("only checked fields are stored, so stray data like old links never reaches the database", async () => {
  const file = await uploadFile();
  const created = await createLesson({
    title: "Clean copy",
    content: [{ type: "pdf", fileId: file.fileId, url: "https://evil.example", fileName: "x" }],
  });
  assert.equal(created.status, 201);
  const stored = await pool.query("SELECT content FROM moduleLessons WHERE lessonID = $1", [created.body.lesson.lessonId]);
  assert.deepEqual(stored.rows[0].content, [{ type: "pdf", fileId: file.fileId }]);
});

test("editing keeps the lesson's files, claims new ones, and deletes removed ones from S3", async () => {
  const kept = await uploadFile();
  const removed = await uploadFile();
  const added = await uploadFile();
  const created = await createLesson({
    title: "Before",
    content: [{ type: "pdf", fileId: kept.fileId }, { type: "pdf", fileId: removed.fileId }],
  });
  const lessonId = created.body.lesson.lessonId;
  const path = `/lessons/${lessonId}`;
  const newVersion = {
    title: "After",
    published: true,
    content: [{ type: "pdf", fileId: kept.fileId }, { type: "pdf", fileId: added.fileId }],
  };

  assert.equal((await api(path, { as: "otherTeacher", method: "PUT", body: newVersion })).status, 403);
  assert.equal((await api(path, { as: "student", method: "PUT", body: newVersion })).status, 403);
  assert.equal((await api("/lessons/999999999", { as: "teacher", method: "PUT", body: newVersion })).status, 404);

  const edited = await api(path, { as: "teacher", method: "PUT", body: newVersion });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.lesson.title, "After");
  assert.equal(edited.body.lesson.published, true);

  assert.equal((await fileRow(kept.fileId)).lessonid, lessonId, "a file that stays in the lesson is still its own");
  assert.equal((await fileRow(added.fileId)).lessonid, lessonId, "a new file is claimed");
  assert.equal(await fileRow(removed.fileId), null, "a removed file's row is deleted");
  assert.ok(deletedKeys.includes(removed.key), "and it is deleted from S3");
  assert.ok(!deletedKeys.includes(kept.key));
});

test("deleting a lesson removes its files from S3 and the database", async () => {
  const file = await uploadFile();
  const created = await createLesson({ title: "Disposable", content: [{ type: "pdf", fileId: file.fileId }] });
  const lessonId = created.body.lesson.lessonId;

  assert.equal((await api(`/lessons/${lessonId}`, { as: "otherTeacher", method: "DELETE" })).status, 403);
  assert.equal((await api(`/lessons/${lessonId}`, { as: "student", method: "DELETE" })).status, 403);

  const deleted = await api(`/lessons/${lessonId}`, { as: "teacher", method: "DELETE" });
  assert.equal(deleted.status, 204);
  assert.ok(deletedKeys.includes(file.key));
  assert.equal(await fileRow(file.fileId), null);
  const lesson = await pool.query("SELECT 1 FROM moduleLessons WHERE lessonID = $1", [lessonId]);
  assert.equal(lesson.rowCount, 0);
  assert.equal((await api(`/lessons/${lessonId}`, { as: "teacher", method: "DELETE" })).status, 404);
});
