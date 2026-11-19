import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";
import { toId, canManageModule, isEnrolled, canViewModule } from "../auth/modulePermissions.js";
import { randomUUID } from "node:crypto";
import { storage, MAX_FILE_BYTES } from "../storage/s3.js";
import { inTransaction } from "../db/transaction.js";

// lessons are ordered text, pdf and video blocks
// teachers assigned to the module, and admins, create and edit lessons and upload files
// enrolled students see published lessons
// files go from browser directly to private s3 using presigned POST forms. students view them through short-lived signed links

const router = Router();
// must match the contentType check in 009_module_lessons.sql
const ALLOWED_TYPES = ["application/pdf", "video/mp4", "video/webm"];

// size limits for a saved lesson. database doesn't enforce these so this is the only place to check
const MAX_BLOCKS = 50; // blocks per lesson
const MAX_HTML = 50000; // characters per text block
const MAX_TRANSCRIPT = 20000; // characters per video transcript

// checks a lesson sent by the editor. returns { lesson } or { error }
function validateLesson(body){
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 150) return { error: "Please enter a title (up to 150 characters)." };

  const published = body?.published === true;

  const content = Array.isArray(body?.content) ? body?.content : [];
  if (content.length > MAX_BLOCKS) {
    return { error: `A lesson can have at most ${MAX_BLOCKS} blocks.` };
  }

  const cleaned = [];
  for (const block of content) {
    if (block?.type === "text"){
      const html = typeof block.html === "string" ? block.html : "";
      if (html.length > MAX_HTML) return { error: "A text block is too long." };
      cleaned.push({ type: "text", html });
    } else if (block?.type === "pdf" || block?.type === "video"){
      const fileId = toId(block.fileId);
      if (!fileId) return { error: "Every PDF or video block needs a file." };

      if (block.type === "pdf"){
        cleaned.push({ type: "pdf", fileId });
      } else {
        const transcript = typeof block.transcript === "string" ? block.transcript : "";
        if (transcript.length > MAX_TRANSCRIPT) return { error: "Video transcript is too long."};
        cleaned.push({ type: "video", fileId, transcript });
      }
    } else {
      return { error: "Unknown lesson block." };
    }
  }

  const ids = fileIdsIn(cleaned);
  if (new Set(ids).size !== ids.length){
    return { error: "Each file can only be used once in a lesson." };
  }
  return { lesson: { title, published, content: cleaned } };
}

// checks upload request from the lesson editor. returns file or error message
function validateUpload(body){
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName || fileName.length > 255){
        return { error: "Please enter a file name (up to 255 characters)." };
    }

    const contentType = body?.contentType;
    if (!ALLOWED_TYPES.includes(contentType)){
        return { error: "Invalid file type. PDF, MP4, and WebM files only." };
    }

    const sizeBytes = Number(body?.sizeBytes);
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES){
        return { error: "File must be between 1 byte and 100 MB." };
    }

    return { file: { fileName, contentType, sizeBytes } };
}

// loads one lessonFiles row by id, or null if there isn't one
async function findFile(fileId) {
  const result = await pool.query(
    `SELECT fileID, moduleID, s3Key, fileName, contentType, sizeBytes, uploaded
     FROM lessonFiles
     WHERE fileID = $1`,
    [fileId],
  );
  return result.rows[0] ?? null;
}

// loads one lesson by id or null if there isn't one
async function findLesson(lessonId, db = pool){
  const result = await db.query(
    `SELECT lessonId, moduleId, title, content, published, updatedAt
    FROM moduleLessons
    WHERE lessonId = $1`,
    [lessonId]
  );
  return result.rows[0] ?? null;
}

// shapes a lessonFiles row for api
function describeFile(file){
  return {
    fileId: file.fileid,
    fileName: file.filename,
    contentType: file.contenttype,
    sizeBytes: Number(file.sizebytes),
  };
}

// shape lesson for api
function describeLesson(lesson, content){
  return {
    lessonId: lesson.lessonid,
    title: lesson.title,
    published: lesson.published,
    content: content,
    updatedAt: lesson.updatedat,
  };
}

// lists the fileids a lesson's content points at
function fileIdsIn(content){
  return content
    .filter((block) => ["pdf","video"].includes(block.type))
    .map((block) => block.fileId);
}

router.use(["/modules/:moduleId/lessons", "/modules/:moduleId/files", "/lessons", "/files"], requireUser);

// teacher asks to upload a file; records (not yet uploading) and returns a one-time S3 upload form
router.post("/modules/:moduleId/files/upload", async (req, res) => {
  const moduleId = toId(req.params.moduleId);

  const { file, error } = validateUpload(req.body);

  if (!moduleId){
    return res.status(404).json({ error: "Module not found." });
  }
  if (error){
    return res.status(400).json({ error });
  }

  if (!(await canManageModule(req.user, moduleId))) {
    return res.status(403).json({ error: "Only this module's instructors can upload files." });
  }

  const moduleRow = await pool.query(
      `SELECT 1
       FROM modules WHERE moduleID = $1`,
      [moduleId],
    );
  if (moduleRow.rowCount === 0){
    return res.status(404).json({ error: "Module not found." });
  }

  const key = `materials/${moduleId}/${randomUUID()}`;

  const form = await storage.uploadForm(key, file.contentType);

  const inserted = await pool.query(
      `INSERT INTO lessonFiles (moduleID, s3Key, fileName, contentType, sizeBytes, uploadedBy)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING fileID`,
      [moduleId, key, file.fileName, file.contentType, file.sizeBytes, req.user.id],
    );
  
  res.status(201).json({ fileId: inserted.rows[0].fileid, url: form.url, fields: form.fields }); 
});

// browser finished uploading to s3, confirm its there then mark as uploaded
router.post("/files/:fileId/complete", async (req, res) => {
  const fileId = toId(req.params.fileId);
  if (!fileId) return res.status(404).json({ error: "File not found." });

  const file = await findFile(fileId);
  if (!file) return res.status(404).json({ error: "File not found." });

  if (!(await canManageModule(req.user, file.moduleid))) return res.status(403).json({ error: "Only this module's instructors can manage this file." });

  if (file.uploaded) return res.json(describeFile(file));

  const info = await storage.fileInfo(file.s3key);
  if (!info) return res.status(409).json({ error: "The upload didn't finish. Try uploading the file again." });

  if (info.contentType !== file.contenttype || info.size !== Number(file.sizebytes)){
    await storage.deleteFile(file.s3key);
    return res.status(409).json({ error: "The uploaded file doesn't match. Try uploading again." });
  }

  await pool.query(
    `UPDATE lessonFiles
    SET uploaded = TRUE
    WHERE fileID = $1`,
    [fileId]
  );
  res.json(describeFile(file));
});

// lists a module's lessons. managers see drafts too, others see published only 
// file blocks get the file's name, type and a fresh 15 min signed link
router.get("/modules/:moduleId/lessons", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });

  const manager = await canManageModule(req.user, moduleId);
  if (!manager && !(await canViewModule(req.user, moduleId))){
    return res.status(403).json({ error: "You are not part of this module." });
  }
  const lessons = await pool.query(
    `SELECT lessonID, title, content, published, updatedAt
    FROM moduleLessons
    WHERE moduleID = $1 AND (published OR $2)
    ORDER BY createdAt, lessonID`,
    [moduleId, manager]
  );

  const ids = lessons.rows.flatMap((lesson) => fileIdsIn(lesson.content));
  const files = await pool.query(
    `SELECT fileID, s3Key, fileName, contentType
    FROM lessonFiles
    WHERE fileID = ANY($1) AND uploaded`,
    [ids]
  );

  const filesById = new Map(files.rows.map((file) => [file.fileid, file]));

  const result = await Promise.all(lessons.rows.map(async (lesson) => {
    const content = await Promise.all(lesson.content.map(async (block) => {
      const file = filesById.get(block.fileId);
      if (!file) return block;
      return {
        ...block,
        fileName: file.filename,
        contentType: file.contenttype,
        url: await storage.signedUrl(file.s3key, file.filename),
      };
    }));
    return describeLesson(lesson, content);
  }));

  res.json({ lessons: result });
});

// creates a lesson in a module. its file blocks must be this module's uploaded, unused files
router.post("/modules/:moduleId/lessons", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });
  const { lesson, error } = validateLesson(req.body);
  if (error) return res.status(400).json({ error });
  if (!(await canManageModule(req.user, moduleId))) {
    return res.status(403).json({ error: "Only this module's instructors can add lessons." });
  }

  const created = await inTransaction(async (client) => {
    const moduleRow = await client.query("SELECT 1 FROM modules WHERE moduleID = $1", [moduleId]);
    if (moduleRow.rowCount === 0) return null;

    const ids = fileIdsIn(lesson.content);
    const usable = await client.query(
      `SELECT fileID FROM lessonFiles
       WHERE fileID = ANY($1) AND moduleID = $2 AND uploaded AND lessonID IS NULL
       FOR UPDATE`,
      [ids, moduleId],
    );
    if (usable.rowCount !== ids.length) {
      return { error: "One or more files can't be used. Upload them again." };
    }

    const inserted = await client.query(
      `INSERT INTO moduleLessons (moduleID, title, content, published, createdBy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING lessonID, title, content, published, updatedAt`,
      [moduleId, lesson.title, JSON.stringify(lesson.content), lesson.published, req.user.id],
    );
    const lessonRow = inserted.rows[0];

    await client.query(
      "UPDATE lessonFiles SET lessonID = $1 WHERE fileID = ANY($2)",
      [lessonRow.lessonid, ids],
    );

    return lessonRow;
  });

  if (!created) return res.status(404).json({ error: "Module not found." });
  if (created.error) return res.status(400).json({ error: created.error });
  res.status(201).json({ lesson: describeLesson(created, created.content) });
});

// edits a lesson. files removed from it are deleted from s3 after the save succeeds.
router.put("/lessons/:lessonId", async (req, res) => {
  const lessonId = toId(req.params.lessonId);
  if (!lessonId) return res.status(404).json({ error: "Lesson not found." });
  const { lesson, error } = validateLesson(req.body);
  if (error) return res.status(400).json({ error });
  const existing = await findLesson(lessonId);
  if (!existing) return res.status(404).json({ error: "Lesson not found." });
  if(!(await canManageModule(req.user, existing.moduleid))){
    return res.status(403).json({ error: "Only this module's instructors can edit lessons." });
  }

  const saved = await inTransaction(async (client) =>{
    const ids = fileIdsIn(lesson.content);
    const usable = await client.query(
      `SELECT fileID FROM lessonFiles
      WHERE fileID = ANY($1) AND moduleID = $2 AND uploaded
      AND (lessonId IS NULL OR lessonID = $3)
      FOR UPDATE`,
      [ids, existing.moduleid, lessonId],
    );
    if (usable.rowCount !== ids.length){
      return { error: "One or more files can't be used. Upload them again" };
    }

    const updated = await client.query(
      `UPDATE moduleLessons
      SET title = $1, content = $2, published = $3, updatedAt = now()
      WHERE lessonID = $4
      RETURNING lessonID, title, content, published, updatedAt`,
      [lesson.title, JSON.stringify(lesson.content), lesson.published, lessonId],
    );
    if (updated.rowCount === 0) return null;

    await client.query(
      "UPDATE lessonFiles SET lessonID = $1 WHERE fileID = ANY($2)",
      [lessonId, ids],
    );

    const removed = await client.query(
      `DELETE FROM lessonFiles
      WHERE lessonID = $1 AND NOT (fileID = ANY($2))
      RETURNING s3Key`,
      [lessonId, ids],
    );

    return {
      lesson: updated.rows[0],
      removedKeys: removed.rows.map((file) => file.s3key),
    };
  });
  
  if (!saved) return res.status(404).json({ error: "Lesson not found." });
  if (saved.error) return res.status(400).json({ error: saved.error });

  // s3 isn't part of the transaction, so delete files only after the save comitted.
  // failed delete just leaves an unused file in the bucket. save still succeeded
  for (const key of saved.removedKeys) {
    try {
      await storage.deleteFile(key);
    } catch (err){
      console.error(`Could not delete ${key} from S3:`, err);
    }
  }

  res.json({ lesson: describeLesson(saved.lesson, saved.lesson.content) });
});

// deletes a lesson and its files. S3 goes first so a failed delete can just be retried
// the rows still list every key, and deleting an already-gone S3 key succeeds
router.delete("/lessons/:lessonId", async (req, res) => {
  const lessonId = toId(req.params.lessonId);
  if (!lessonId) return res.status(404).json({ error: "Lesson not found." });
  const existing = await findLesson(lessonId);
  if (!existing) return res.status(404).json({ error: "Lesson not found." });
  if (!(await canManageModule(req.user, existing.moduleid))) {
    return res.status(403).json({ error: "Only this module's instructors can delete lessons." });
  }

  // if an S3 delete fails, stop here before any rows are removed
  const files = await pool.query("SELECT s3Key FROM lessonFiles WHERE lessonID = $1", [lessonId]);
  for (const file of files.rows) {
    await storage.deleteFile(file.s3key);
  }

  // file rows first: lessonFiles.lessonID references moduleLessons, so the lesson can't go first
  await inTransaction(async (client) => {
    await client.query("DELETE FROM lessonFiles WHERE lessonID = $1", [lessonId]);
    await client.query("DELETE FROM moduleLessons WHERE lessonID = $1", [lessonId]);
  });

  res.status(204).end();
});

export default router;