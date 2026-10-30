import { Router } from "express";
import {
  Auth0ServiceError,
  createAuth0User,
  deleteAuth0User,
  sendPasswordSetupEmail,
} from "../auth/auth0Management.js";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
router.use(requireUser, (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  next();
});

const roleColumns = {
  student: ["Student", "student"],
  instructor: ["Instructor", "teacher"],
  administrator: ["Administrator", "administrator"],
};

function validateInvite(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role;
  const moduleIds = body?.moduleIds ?? [];
  if (!name || name.length > 100) {
    return { error: "Enter a name between 1 and 100 characters." };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!Object.hasOwn(roleColumns, role)) {
    return { error: "Choose a valid account role." };
  }
  if (!Array.isArray(moduleIds) ||
      moduleIds.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(moduleIds).size !== moduleIds.length ||
      (role !== "instructor" && moduleIds.length > 0)) {
    return { error: "Choose valid module assignments for this instructor." };
  }
  return { name, email, role, moduleIds };
}

async function existingEmail(email) {
  const result = await pool.query(
    "SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1",
    [email],
  );
  return result.rowCount > 0;
}

async function createInvite(req, res, next) {
  const invite = validateInvite(req.body);
  if (invite.error) return res.status(400).json({ error: invite.error });
  const [displayRole, roleColumn] = roleColumns[invite.role];

  try {
    if (await existingEmail(invite.email)) {
      return res.status(409).json({ error: "An LMS account already uses this email address." });
    }

    if (invite.moduleIds.length) {
      const modules = await pool.query(
        "SELECT moduleID FROM modules WHERE moduleID = ANY($1)",
        [invite.moduleIds],
      );
      if (modules.rowCount !== invite.moduleIds.length) {
        return res.status(400).json({ error: "One or more selected modules do not exist." });
      }
    }

    const auth0UserId = await createAuth0User(invite);
    let client;
    try {
      client = await pool.connect();
    } catch (error) {
      try {
        await deleteAuth0User(auth0UserId);
      } catch (cleanupError) {
        console.error("Could not remove the Auth0 user after the LMS database connection failed:", cleanupError.message);
      }
      return next(error);
    }
    let transactionOpen = false;
    let user;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const result = await client.query(
        `INSERT INTO users
           (username, displayName, email, auth0Sub, auth0InvitePending,
            student, teacher, administrator)
         VALUES ($1, $2, $1, $3, TRUE, $4, $5, $6)
         RETURNING userID, username, displayName, email, student, teacher, administrator`,
        [
          invite.email,
          invite.name,
          auth0UserId,
          roleColumn === "student",
          roleColumn === "teacher",
          roleColumn === "administrator",
        ],
      );
      user = result.rows[0];
      if (invite.role === "instructor") {
        for (const moduleId of invite.moduleIds) {
          await client.query(
            "INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)",
            [moduleId, user.userid],
          );
        }
      }
      await client.query("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Could not roll back the LMS account transaction:", rollbackError.message);
        }
      }
      try {
        await deleteAuth0User(auth0UserId);
      } catch (cleanupError) {
        console.error("Could not remove the Auth0 user after LMS account creation failed:", cleanupError.message);
      }
      if (error.code === "23505") {
        return res.status(409).json({ error: "An LMS account already uses this email address." });
      }
      return next(error);
    } finally {
      client.release();
    }

    let emailSent = true;
    let emailError;
    try {
      await sendPasswordSetupEmail(invite.email);
    } catch (error) {
      if (!(error instanceof Auth0ServiceError)) return next(error);
      emailSent = false;
      emailError = error.message;
    }

    return res.status(201).json({
      invitation: {
        id: user.userid,
        name: user.displayname,
        email: user.email,
        role: displayRole,
        modules: invite.moduleIds,
        status: "Pending",
        auth0Managed: true,
      },
      emailSent,
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    if (error instanceof Auth0ServiceError) {
      if (error.status === 409) {
        return res.status(409).json({ error: "An Auth0 account already uses this email address." });
      }
      return res.status(503).json({ error: error.message });
    }
    return next(error);
  }
}

router.get("/invitations", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.userID, u.displayName, u.email, u.student, u.teacher,
              u.administrator, mt.moduleID
       FROM users u
       LEFT JOIN moduleTeachers mt ON mt.userID = u.userID
       WHERE u.auth0InvitePending = TRUE
       ORDER BY u.displayName, mt.moduleID`,
    );
    const invitations = [];
    for (const row of result.rows) {
      let invitation = invitations.at(-1);
      if (!invitation || invitation.id !== row.userid) {
        const role = row.administrator
          ? "Administrator"
          : row.teacher
            ? "Instructor"
            : "Student";
        invitation = {
          id: row.userid,
          name: row.displayname,
          email: row.email,
          role,
          modules: [],
          status: "Pending",
          auth0Managed: true,
        };
        invitations.push(invitation);
      }
      if (row.moduleid !== null) invitation.modules.push(row.moduleid);
    }
    return res.json({ invitations });
  } catch (error) {
    return next(error);
  }
});

router.post("/invitations", createInvite);

router.post("/invitations/:userId/resend", async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Choose a valid invitation." });
  }
  try {
    const result = await pool.query(
      `SELECT email FROM users
       WHERE userID = $1 AND auth0InvitePending = TRUE`,
      [userId],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "This account has already completed setup or is unavailable." });
    }
    await sendPasswordSetupEmail(result.rows[0].email);
    return res.json({ emailSent: true });
  } catch (error) {
    if (error instanceof Auth0ServiceError) {
      return res.status(503).json({ error: error.message });
    }
    return next(error);
  }
});

export default router;
