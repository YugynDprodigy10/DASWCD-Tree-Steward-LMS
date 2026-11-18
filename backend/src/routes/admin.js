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

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function describeModule(row, instructors = []) {
  return {
    id: row.moduleid,
    title: row.name,
    description: "",
    studentsVisible: row.studentsvisible,
    instructorsVisible: row.instructorsvisible,
    instructors,
    teacherIds: instructors.map((instructor) => instructor.id),
  };
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

router.get("/modules", async (req, res, next) => {
  try {
    const [moduleResult, teacherResult, assignmentResult] = await Promise.all([
      pool.query(
        `SELECT moduleID, name, studentsVisible, instructorsVisible
         FROM modules ORDER BY moduleID`,
      ),
      pool.query(
        `SELECT userID, COALESCE(NULLIF(displayName, ''), username) AS name,
                email
         FROM users WHERE teacher = TRUE
         ORDER BY name, userID`,
      ),
      pool.query(
        `SELECT moduleID, userID FROM moduleTeachers ORDER BY moduleID, userID`,
      ),
    ]);

    const teachers = teacherResult.rows.map((row) => ({
      id: row.userid,
      name: row.name,
      email: row.email,
    }));
    const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const assignments = new Map();
    for (const row of assignmentResult.rows) {
      const teacher = teachersById.get(row.userid);
      if (!teacher) continue;
      const assigned = assignments.get(row.moduleid) ?? [];
      assigned.push(teacher);
      assignments.set(row.moduleid, assigned);
    }

    return res.json({
      modules: moduleResult.rows.map((module) =>
        describeModule(module, assignments.get(module.moduleid) ?? []),
      ),
      teachers,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/modules/:moduleId/teachers", async (req, res, next) => {
  const moduleId = toId(req.params.moduleId);
  const { teacherIds } = req.body ?? {};
  if (!moduleId) return res.status(404).json({ error: "Module not found." });
  if (
    !Array.isArray(teacherIds) ||
    teacherIds.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(teacherIds).size !== teacherIds.length
  ) {
    return res.status(400).json({ error: "Choose valid instructor assignments." });
  }

  try {
    const updated = await inTransaction(async (client) => {
      const moduleResult = await client.query(
        `SELECT moduleID, name, studentsVisible, instructorsVisible
         FROM modules WHERE moduleID = $1 FOR UPDATE`,
        [moduleId],
      );
      if (!moduleResult.rows[0]) return null;

      const teacherResult = await client.query(
        "SELECT userID FROM users WHERE teacher = TRUE AND userID = ANY($1)",
        [teacherIds],
      );
      if (teacherResult.rowCount !== teacherIds.length) {
        return { invalidTeachers: true };
      }

      await client.query("DELETE FROM moduleTeachers WHERE moduleID = $1", [moduleId]);
      for (const teacherId of teacherIds) {
        await client.query(
          "INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)",
          [moduleId, teacherId],
        );
      }
      return { module: moduleResult.rows[0] };
    });

    if (!updated) return res.status(404).json({ error: "Module not found." });
    if (updated.invalidTeachers) {
      return res.status(400).json({ error: "Choose existing instructor accounts." });
    }

    const instructors = teacherIds.length
      ? await pool.query(
          `SELECT userID, COALESCE(NULLIF(displayName, ''), username) AS name,
                  email
           FROM users WHERE teacher = TRUE AND userID = ANY($1)
           ORDER BY name, userID`,
          [teacherIds],
        )
      : { rows: [] };
    return res.json({
      module: describeModule(
        updated.module,
        instructors.rows.map((row) => ({
          id: row.userid,
          name: row.name,
          email: row.email,
        })),
      ),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/modules/:moduleId/visibility", async (req, res, next) => {
  const moduleId = toId(req.params.moduleId);
  const body = req.body ?? {};
  const hasStudentsVisible = Object.hasOwn(body, "studentsVisible");
  const hasInstructorsVisible = Object.hasOwn(body, "instructorsVisible");
  if (!moduleId) return res.status(404).json({ error: "Module not found." });
  if (
    (!hasStudentsVisible && !hasInstructorsVisible) ||
    (hasStudentsVisible && typeof body.studentsVisible !== "boolean") ||
    (hasInstructorsVisible && typeof body.instructorsVisible !== "boolean")
  ) {
    return res.status(400).json({ error: "Choose valid module visibility settings." });
  }

  try {
    const result = await pool.query(
      `UPDATE modules
       SET studentsVisible = COALESCE($2, studentsVisible),
           instructorsVisible = COALESCE($3, instructorsVisible)
       WHERE moduleID = $1
       RETURNING moduleID, name, studentsVisible, instructorsVisible`,
      [
        moduleId,
        hasStudentsVisible ? body.studentsVisible : null,
        hasInstructorsVisible ? body.instructorsVisible : null,
      ],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Module not found." });
    }
    const row = result.rows[0];
    return res.json({
      module: {
        id: row.moduleid,
        title: row.name,
        studentsVisible: row.studentsvisible,
        instructorsVisible: row.instructorsvisible,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/people", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.userID, u.displayName, u.username, u.email,
              u.student, u.teacher, u.administrator,
              COALESCE(
                array_agg(DISTINCT CASE
                  WHEN u.teacher THEN mt.moduleID
                  WHEN u.student THEN ms.moduleID
                  ELSE NULL
                END) FILTER (WHERE CASE
                  WHEN u.teacher THEN mt.moduleID
                  WHEN u.student THEN ms.moduleID
                  ELSE NULL
                END IS NOT NULL),
                ARRAY[]::int[]
              ) AS moduleIds
       FROM users u
       LEFT JOIN moduleTeachers mt ON mt.userID = u.userID
       LEFT JOIN moduleStudents ms ON ms.userID = u.userID AND ms.status = 'active'
       WHERE u.auth0InvitePending = FALSE
       GROUP BY u.userID
       ORDER BY COALESCE(NULLIF(u.displayName, ''), u.username), u.userID`,
    );
    return res.json({
      people: result.rows.map((row) => ({
        id: row.userid,
        name: row.displayname || row.username,
        email: row.email,
        role: row.administrator
          ? "Administrator"
          : row.teacher
            ? "Instructor"
            : "Student",
        status: "Active",
        modules: row.moduleids,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

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
