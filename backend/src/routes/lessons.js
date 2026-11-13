import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";
import { toId, canManageModule, isEnrolled, canViewModule } from "../auth/modulePermissions.js";

// lessons are ordered text, pdf and video blocks
// teachers assigned to the module, and admins, create and edit lessons and upload files
// enrolled students see published lessons
// files go from browser directly to private s3 using presigned POST forms. students view them through short-lived signed links

const router = Router();

router.use(["/modules/:moduleId/lessons", "/modules/:moduleId/files", "/lessons", "/files"], requireUser);

export default router;