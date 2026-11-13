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

router.use(["/modules/:moduleId/lessons", "/modules/:moduleId/files", "/lessons", "/files"], requireUser);

export default router;