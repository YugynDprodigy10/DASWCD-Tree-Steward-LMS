import { Router } from "express";
import { createLocalTestToken, isLocalTestLoginEnabled } from "../auth/localTestAuth.js";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
const testAccounts = {
  student: { username: "test student 1", role: "student" },
  instructor: { username: "test teacher 1", role: "teacher" },
  administrator: { username: "test admin 1", role: "administrator" },
};

router.post("/test-login", async (req, res, next) => {
  if (!isLocalTestLoginEnabled(req)) {
    return res.status(404).json({ error: "Local test sign-in is disabled." });
  }

  const account = testAccounts[req.body?.account];
  if (!account) {
    return res.status(400).json({ error: "Choose a valid local test account." });
  }

  try {
    const result = await pool.query(
      `SELECT userID, username, email, student, teacher, administrator
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [account.username],
    );
    const user = result.rows[0];
    if (!user || !user[account.role === "teacher" ? "teacher" : account.role]) {
      return res.status(404).json({
        error: "The local test account is missing. Run npm run query in the backend folder.",
      });
    }

    const roles = [
      user.teacher && "teacher",
      user.student && "student",
      user.administrator && "administrator",
    ].filter(Boolean);

    return res.json({
      user: {
        id: user.userid,
        username: user.username,
        email: user.email,
        roles,
      },
      accessToken: await createLocalTestToken(user.userid),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireUser, (req, res) => {
  const { id, username, email, roles } = req.user;
  res.json({ user: { id, username, email, roles } });
});

export default router;
