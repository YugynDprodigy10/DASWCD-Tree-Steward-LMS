import pool from "./pool.js";

// Admins and a module's own instructors always see it. Other instructors see
// it unless an admin hid it from instructors; students see it unless an admin
// hid it from students.
export async function isModuleVisibleTo(user, moduleId, db = pool) {
  if (user.isAdmin) return true;
  const result = await db.query(
    `SELECT m.studentsVisible, m.instructorsVisible,
            EXISTS (
              SELECT 1 FROM moduleTeachers mt
              WHERE mt.moduleID = m.moduleID AND mt.userID = $2
            ) AS assigned
     FROM modules m WHERE m.moduleID = $1`,
    [moduleId, user.id],
  );
  const row = result.rows[0];
  if (!row) return false;
  if (user.isTeacher) return row.assigned || row.instructorsvisible;
  return row.studentsvisible;
}

// The modules this user may open, in course order.
export async function listVisibleModules(user, db = pool) {
  const result = await db.query(
    `SELECT m.moduleID, m.name, m.studentsVisible, m.instructorsVisible,
            EXISTS (
              SELECT 1 FROM moduleTeachers mt
              WHERE mt.moduleID = m.moduleID AND mt.userID = $1
            ) AS assigned
     FROM modules m ORDER BY m.moduleID`,
    [user.id],
  );
  return result.rows
    .filter((row) =>
      user.isAdmin
        ? true
        : user.isTeacher
          ? row.assigned || row.instructorsvisible
          : row.studentsvisible,
    )
    .map((row) => ({ id: row.moduleid, title: row.name, assigned: row.assigned }));
}