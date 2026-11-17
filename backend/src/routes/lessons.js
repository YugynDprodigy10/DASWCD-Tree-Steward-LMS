import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";
import { toId, canManageModule, isEnrolled, canViewModule } from "../auth/modulePermissions.js";
import { randomUUID } from "node:crypto";
import { storage, MAX_FILE_BYTES } from "../storage/s3.js";

// lessons are ordered text, pdf and video blocks
// teachers assigned to the module, and admins, create and edit lessons and upload files
// enrolled students see published lessons
// files go from browser directly to private s3 using presigned POST forms. students view them through short-lived signed links

const router = Router();
// must match the contentType check in 006_module_lessons.sql
const ALLOWED_TYPES = ["application/pdf", "video/mp4", "video/webm"];

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

// loads one lessonFiles row by id, or null if htere isn't one
async function findFile(fileId) {
  const result = await pool.query(
    `SELECT fileID, moduleID, s3Key, fileName, contentType, sizeBytes, uploaded
     FROM lessonFiles
     WHERE fileID = $1`,
    [fileId],
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

export default router;