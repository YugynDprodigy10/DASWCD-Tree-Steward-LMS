import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

router.post("/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const result = await pool.query( //query the database for the user with the provided email
      `SELECT userID, username, email, passwordTemp, student, teacher, administrator 
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];

    if (!user || user.passwordtemp !== password) { //returns invalid password if the passwords do not match
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const roles = [ //makes sure that the account has a role
      user.student && "student",
      user.teacher && "teacher",
      user.administrator && "administrator",
    ].filter(Boolean);

    if (roles.length === 0) {
      return res.status(403).json({ error: "This account has no assigned role." });
    }

    return res.json({
      user: {
        id: user.userid,
        username: user.username,
        email: user.email,
        roles,
      },
    });
  } catch (error) {
    console.error("Login query failed:", error); //catches any errors
    return res.status(500).json({ error: "Unable to sign in right now." });
  }
});

export default router;
