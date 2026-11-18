import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
router.use(requireUser);

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function canViewAnalytics(user) {
  return user.isAdmin || user.isTeacher;
}

async function listModules(user) {
  if (user.isAdmin) {
    const result = await pool.query(
      "SELECT moduleID, name FROM modules ORDER BY moduleID",
    );
    return result.rows;
  }
  if (!user.isTeacher) return null;
  const result = await pool.query(
    `SELECT m.moduleID, m.name
     FROM modules m
     JOIN moduleTeachers mt ON mt.moduleID = m.moduleID
     WHERE mt.userID = $1
     ORDER BY m.moduleID`,
    [user.id],
  );
  return result.rows;
}

router.get("/modules", async (req, res) => {
  if (!canViewAnalytics(req.user)) {
    return res.status(403).json({ error: "Student analytics are not available for your account." });
  }
  const modules = await listModules(req.user);
  res.json({
    modules: modules.map((module) => ({
      id: module.moduleid,
      name: module.name,
    })),
  });
});

router.get("/modules/:moduleId/summary", async (req, res) => {
  if (!canViewAnalytics(req.user)) {
    return res.status(403).json({ error: "Student analytics are not available for your account." });
  }
  const moduleId = toId(req.params.moduleId);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });

  const modules = await listModules(req.user);
  const module = modules.find((item) => item.moduleid === moduleId);
  if (!module) return res.status(404).json({ error: "Module not found." });

  const result = await pool.query(
    `WITH page_totals AS (
       SELECT pageKey, MAX(pageTitle) AS pageTitle,
              SUM(durationSeconds)::bigint AS seconds,
              COUNT(*)::int AS visits,
              COUNT(DISTINCT userID)::int AS students
       FROM studentPageViews
       WHERE moduleID = $1
         AND (pageKey LIKE 'content:%' OR pageKey LIKE 'quiz:%')
       GROUP BY pageKey
     ),
     module_total AS (
       SELECT COALESCE(SUM(seconds), 0)::bigint AS seconds
       FROM page_totals
     )
     SELECT page_totals.pageKey, page_totals.pageTitle,
            page_totals.seconds, page_totals.visits, page_totals.students,
            module_total.seconds AS moduleSeconds
     FROM page_totals CROSS JOIN module_total
     WHERE page_totals.seconds > 0
     ORDER BY page_totals.seconds DESC, page_totals.pageTitle ASC
     LIMIT 5`,
    [moduleId],
  );
  const moduleSeconds = Number(result.rows[0]?.moduleseconds ?? 0);
  res.json({
    module: { id: module.moduleid, name: module.name },
    totalSeconds: moduleSeconds,
    pages: result.rows.map((row) => {
      const seconds = Number(row.seconds);
      return {
        key: row.pagekey,
        title: row.pagetitle,
        seconds,
        visits: row.visits,
        students: row.students,
        percentage: moduleSeconds
          ? Math.round((seconds / moduleSeconds) * 10000) / 100
          : 0,
      };
    }),
  });
});

router.post("/views", async (req, res) => {
  if (!req.user.isStudent) {
    return res.status(403).json({ error: "Only students can record learning activity." });
  }
  const visitId = typeof req.body?.visitId === "string" ? req.body.visitId : "";
  const moduleId = toId(req.body?.moduleId);
  const pageKey = typeof req.body?.pageKey === "string" ? req.body.pageKey : "";
  const durationSeconds = req.body?.durationSeconds;
  const contentKey = /^content:[A-Za-z0-9:_-]{1,120}$/.test(pageKey);
  const quizKey = /^quiz:([1-9]\d*)$/.exec(pageKey);
  const progressKey = pageKey === "navigation:my-progress";
  const suppliedTitle =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId) ||
    !moduleId ||
    !(contentKey || quizKey || progressKey) ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 0 ||
    durationSeconds > 86400 ||
    (contentKey && (!suppliedTitle || suppliedTitle.length > 150))
  ) {
    return res.status(400).json({ error: "Choose a valid student page view." });
  }

  const enrollment = await pool.query(
    `SELECT 1
     FROM moduleStudents ms
     JOIN modules m ON m.moduleID = ms.moduleID
     WHERE ms.moduleID = $1 AND ms.userID = $2
       AND ms.status = 'active' AND m.studentsVisible = TRUE`,
    [moduleId, req.user.id],
  );
  if (!enrollment.rowCount) {
    return res.status(403).json({ error: "You are not enrolled in this module." });
  }

  let title = progressKey ? "My progress" : suppliedTitle;
  if (quizKey) {
    const quiz = await pool.query(
      `SELECT quizTitle
       FROM modulePages
       WHERE modulePageID = $1 AND moduleID = $2
         AND pageType = 'quiz' AND published = TRUE`,
      [Number(quizKey[1]), moduleId],
    );
    if (!quiz.rows[0]) {
      return res.status(404).json({ error: "Module page not found." });
    }
    title = `Quiz: ${quiz.rows[0].quiztitle}`;
  }

  const result = await pool.query(
    `INSERT INTO studentPageViews
       (visitID, userID, moduleID, pageKey, pageTitle, durationSeconds)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (userID, visitID) DO UPDATE
       SET durationSeconds = LEAST(
             GREATEST(studentPageViews.durationSeconds, $6),
             GREATEST(
               0,
               FLOOR(EXTRACT(EPOCH FROM (
                 CURRENT_TIMESTAMP - studentPageViews.createdAt
               )))::int
             )
           ),
           updatedAt = CURRENT_TIMESTAMP
       WHERE studentPageViews.moduleID = EXCLUDED.moduleID
         AND studentPageViews.pageKey = EXCLUDED.pageKey
     RETURNING pageViewID`,
    [visitId, req.user.id, moduleId, pageKey, title, durationSeconds],
  );
  if (!result.rowCount) {
    return res.status(409).json({ error: "This page view conflicts with an existing record." });
  }
  res.status(200).json({ recorded: true });
});

export default router;
