import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
router.use(["/modules/:moduleId/announcements", "/announcements"], requireUser);

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateAnnouncement(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  if (!title || title.length > 150) {
    return { error: "Enter an announcement title (up to 150 characters)." };
  }
  if (!description) {
    return { error: "Enter the announcement text." };
  }
  if (typeof body?.published !== "boolean") {
    return { error: "Choose whether the announcement is visible to students." };
  }
  return { announcement: { title, description, published: body.published } };
}

async function canManageModule(user, moduleId, db = pool) {
  if (user.isAdmin) return true;
  if (!user.isTeacher) return false;
  const result = await db.query(
    "SELECT 1 FROM moduleTeachers WHERE moduleID = $1 AND userID = $2",
    [moduleId, user.id],
  );
  return result.rowCount > 0;
}

async function canViewModule(user, moduleId, db = pool) {
  if (user.isTeacher) return true;
  const result = await db.query(
    "SELECT 1 FROM moduleStudents WHERE moduleID = $1 AND userID = $2 AND status = 'active'",
    [moduleId, user.id],
  );
  return result.rowCount > 0;
}

function describeAnnouncement(row) {
  return {
    id: row.modulepageid,
    moduleId: row.moduleid,
    type: "Announcement",
    title: row.announcementtitle,
    description: row.announcementtext,
    published: row.published,
    order: row.modulepageorder,
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

router.get("/modules/:moduleId/announcements", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });

  const manager = await canManageModule(req.user, moduleId);
  if (!manager && !(await canViewModule(req.user, moduleId))) {
    return res.status(403).json({ error: "You are not part of this module." });
  }

  const result = await pool.query(
    `SELECT modulePageID, moduleID, modulePageOrder, announcementTitle,
            announcementText, published
     FROM modulePages
     WHERE moduleID = $1 AND pageType = 'announcement' AND ($2 OR published)
     ORDER BY modulePageOrder`,
    [moduleId, manager],
  );
  res.json({ announcements: result.rows.map(describeAnnouncement) });
});

router.post("/modules/:moduleId/announcements", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  const { announcement, error } = validateAnnouncement(req.body);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });
  if (error) return res.status(400).json({ error });
  if (!(await canManageModule(req.user, moduleId))) {
    return res.status(403).json({
      error: "Only this module's instructors can add announcements.",
    });
  }

  const row = await inTransaction(async (client) => {
    const module = await client.query(
      "SELECT 1 FROM modules WHERE moduleID = $1 FOR UPDATE",
      [moduleId],
    );
    if (module.rowCount === 0) return null;
    const result = await client.query(
      `INSERT INTO modulePages
         (moduleID, modulePageOrder, modulePageTitle, pageType,
          announcementTitle, announcementText, published)
       SELECT $1, COALESCE(MAX(modulePageOrder), 0) + 1, $2, 'announcement',
              $2, $3, $4
       FROM modulePages WHERE moduleID = $1
       RETURNING modulePageID, moduleID, modulePageOrder, announcementTitle,
                 announcementText, published`,
      [moduleId, announcement.title, announcement.description, announcement.published],
    );
    return result.rows[0];
  });
  if (!row) return res.status(404).json({ error: "Module not found." });
  res.status(201).json({ announcement: describeAnnouncement(row) });
});

router.patch("/announcements/:announcementId", async (req, res) => {
  const announcementId = toId(req.params.announcementId);
  if (!announcementId) {
    return res.status(404).json({ error: "Announcement not found." });
  }

  const existing = await pool.query(
    `SELECT modulePageID, moduleID
     FROM modulePages
     WHERE modulePageID = $1 AND pageType = 'announcement'`,
    [announcementId],
  );
  const row = existing.rows[0];
  if (!row) return res.status(404).json({ error: "Announcement not found." });
  if (!(await canManageModule(req.user, row.moduleid))) {
    return res.status(403).json({
      error: "Only this module's instructors can change this announcement.",
    });
  }

  const { announcement, error } = validateAnnouncement(req.body);
  if (error) return res.status(400).json({ error });
  const updated = await pool.query(
    `UPDATE modulePages
     SET modulePageTitle = $2, announcementTitle = $2, announcementText = $3,
         published = $4
     WHERE modulePageID = $1 AND pageType = 'announcement'
     RETURNING modulePageID, moduleID, modulePageOrder, announcementTitle,
               announcementText, published`,
    [announcementId, announcement.title, announcement.description, announcement.published],
  );
  res.json({ announcement: describeAnnouncement(updated.rows[0]) });
});

export default router;
