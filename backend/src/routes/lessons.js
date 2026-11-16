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

router.use(["/modules/:moduleId/lessons", "/modules/:moduleId/files", "/lessons", "/files"], requireUser);

// teacher asks to uplaod a file; records (not yet uplaoding) and returns a one-time S3 upload form
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

export default router;