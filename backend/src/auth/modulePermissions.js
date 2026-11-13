// shared rules for who can manage or view a module used by the quiz and lesson routes
import pool from "../db/pool.js";

export function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function canManageModule(user, moduleId, db = pool) {
  if (user.isAdmin) return true;
  if (!user.isTeacher) return false;
  const result = await db.query(
    "SELECT 1 FROM moduleTeachers WHERE moduleID = $1 AND userID = $2",
    [moduleId, user.id],
  );
  return result.rowCount > 0;
}

export async function isEnrolled(user, moduleId, db = pool) {
  const result = await db.query(
    "SELECT 1 FROM moduleStudents WHERE moduleID = $1 AND userID = $2 AND status = 'active'",
    [moduleId, user.id],
  );
  return result.rowCount > 0;
}

// Students enrolled in a module, and every instructor (so they can see how
// their week fits the course), may view the module's published content.
export async function canViewModule(user, moduleId, db = pool) {
  return user.isTeacher || isEnrolled(user, moduleId, db);
}