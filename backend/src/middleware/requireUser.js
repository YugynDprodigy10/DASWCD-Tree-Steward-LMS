import pool from "../db/pool.js";

// PROTOTYPE ONLY: identifies the caller from the X-User-Id header.
// Anyone can send any ID, so this is NOT secure. Once login issues real
// session tokens, replace the body of this function and nothing else needs
// to change: every route only relies on req.user.
export default async function requireUser(req, res, next) {
  const id = Number(req.get("X-User-Id"));
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  const result = await pool.query(
    "SELECT userID, username, student, teacher, administrator FROM users WHERE userID = $1",
    [id],
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  req.user = {
    id: user.userid,
    username: user.username,
    isStudent: user.student,
    isTeacher: user.teacher,
    isAdmin: user.administrator,
  };
  next();
}