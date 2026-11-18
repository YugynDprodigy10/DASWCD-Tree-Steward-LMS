import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
router.use(requireUser);

function toId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
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
       SELECT mp.modulePageID,
              CASE
                WHEN mp.pageType = 'announcement' THEN mp.announcementTitle
                WHEN mp.pageType = 'activity' THEN mp.activityTitle
                ELSE 'Quiz: ' || mp.quizTitle
              END AS pageTitle,
              SUM(spv.durationSeconds)::bigint AS seconds,
              COUNT(*)::int AS visits,
              COUNT(DISTINCT spv.userID)::int AS students
       FROM studentPageViews spv
       JOIN modulePages mp
         ON mp.moduleID = spv.moduleID
        AND mp.modulePageID = CASE
           WHEN spv.pageKey ~ '^content:[1-9][0-9]{0,9}$' THEN
             CASE
               WHEN substring(spv.pageKey FROM 9)::numeric <= 2147483647
                 THEN substring(spv.pageKey FROM 9)::int
             END
           WHEN spv.pageKey ~ '^quiz:[1-9][0-9]{0,9}$' THEN
             CASE
               WHEN substring(spv.pageKey FROM 6)::numeric <= 2147483647
                 THEN substring(spv.pageKey FROM 6)::int
             END
        END
       WHERE spv.moduleID = $1
         AND mp.published = TRUE
         AND (
           (spv.pageKey LIKE 'content:%'
             AND mp.pageType IN ('announcement', 'activity'))
           OR (spv.pageKey LIKE 'quiz:%' AND mp.pageType = 'quiz')
         )
       GROUP BY mp.modulePageID, mp.pageType,
                mp.announcementTitle, mp.activityTitle, mp.quizTitle
     ),
     module_total AS (
       SELECT COALESCE(SUM(seconds), 0)::bigint AS seconds
       FROM page_totals
     )
     SELECT page_totals.modulePageID, page_totals.pageTitle,
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
        key: row.modulepageid,
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
  const contentKey = /^content:([1-9]\d{0,9})$/.exec(pageKey);
  const quizKey = /^quiz:([1-9]\d{0,9})$/.exec(pageKey);
  const progressKey = pageKey === "navigation:my-progress";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId) ||
    !moduleId ||
    !(contentKey || quizKey || progressKey) ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 0 ||
    durationSeconds > 86400
  ) {
    return res.status(400).json({ error: "Choose a valid student page view." });
  }
  if (
    (contentKey && !toId(contentKey[1])) ||
    (quizKey && !toId(quizKey[1]))
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

  let title = progressKey ? "My progress" : "";
  if (contentKey) {
    const content = await pool.query(
      `SELECT CASE
                WHEN pageType = 'announcement' THEN announcementTitle
                WHEN pageType = 'activity' THEN activityTitle
              END AS title
       FROM modulePages
       WHERE modulePageID = $1 AND moduleID = $2
         AND pageType IN ('announcement', 'activity')
         AND published = TRUE`,
      [Number(contentKey[1]), moduleId],
    );
    if (!content.rows[0]?.title) {
      return res.status(404).json({ error: "Module page not found." });
    }
    title = content.rows[0].title;
  } else if (quizKey) {
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
