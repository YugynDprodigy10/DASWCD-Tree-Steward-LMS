import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";
import { toId, canManageModule, isEnrolled, canViewModule } from "../auth/modulePermissions.js";
import { inTransaction } from "../db/transaction.js";

// Built-in quizzes. A quiz is a module page with pageType 'quiz'.
// Instructors assigned to the module (and admins) build and publish quizzes.
// Enrolled students see published quizzes without the answers, submit
// attempts, and are scored on the server.

const router = Router();
router.use(["/modules/:moduleId/quizzes", "/quizzes"], requireUser);

const MIN_CHOICES = 2;
const MAX_CHOICES = 6;

async function findQuiz(quizId, db = pool) {
  const result = await db.query(
    `SELECT modulePageID, moduleID, modulePageOrder, quizTitle, published
     FROM modulePages
     WHERE modulePageID = $1 AND pageType = 'quiz'`,
    [quizId],
  );
  return result.rows[0] ?? null;
}

async function hasAttempts(quizId, db = pool) {
  const result = await db.query(
    "SELECT 1 FROM quizAttempts WHERE modulePageID = $1 LIMIT 1",
    [quizId],
  );
  return result.rowCount > 0;
}

// Loads a quiz's questions and choices. Correct answers are only included
// for people who can manage the quiz.
async function loadQuestions(quizId, includeAnswers, db = pool) {
  const result = await db.query(
    `SELECT q.questionID, q.questionText, q.points,
            c.choiceID, c.choiceText, c.isCorrect
     FROM quizQuestions q
     JOIN quizAnswerChoices c ON c.questionID = q.questionID
     WHERE q.modulePageID = $1
     ORDER BY q.questionOrder, q.questionID, c.choiceOrder, c.choiceID`,
    [quizId],
  );
  const questions = [];
  for (const row of result.rows) {
    let question = questions.at(-1);
    if (!question || question.id !== row.questionid) {
      question = { id: row.questionid, text: row.questiontext, points: row.points, choices: [] };
      questions.push(question);
    }
    const choice = { id: row.choiceid, text: row.choicetext };
    if (includeAnswers) choice.isCorrect = row.iscorrect;
    question.choices.push(choice);
  }
  return questions;
}

function describeQuiz(quiz, questions) {
  return {
    id: quiz.modulepageid,
    moduleId: quiz.moduleid,
    title: quiz.quiztitle,
    published: quiz.published,
    order: quiz.modulepageorder,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    questions,
  };
}

function validTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  return title && title.length <= 150 ? title : null;
}

// Checks a question sent by the builder. Returns { question } or { error }.
function validateQuestion(body) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1000) {
    return { error: "Enter the question text (up to 1000 characters)." };
  }
  const points = body.points === undefined ? 1 : Number(body.points);
  if (!Number.isInteger(points) || points < 1 || points > 100) {
    return { error: "Points must be a whole number from 1 to 100." };
  }
  const choices = Array.isArray(body.choices) ? body.choices : [];
  if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
    return { error: `Give between ${MIN_CHOICES} and ${MAX_CHOICES} answer choices.` };
  }
  const cleaned = [];
  for (const choice of choices) {
    const choiceText = typeof choice?.text === "string" ? choice.text.trim() : "";
    if (!choiceText || choiceText.length > 300) {
      return { error: "Every answer choice needs text (up to 300 characters)." };
    }
    cleaned.push({ text: choiceText, isCorrect: choice.isCorrect === true });
  }
  if (cleaned.filter((choice) => choice.isCorrect).length !== 1) {
    return { error: "Mark exactly one answer choice as correct." };
  }
  return { question: { text, points, choices: cleaned } };
}

async function insertChoices(client, questionId, choices) {
  for (const [index, choice] of choices.entries()) {
    await client.query(
      `INSERT INTO quizAnswerChoices (questionID, choiceText, isCorrect, choiceOrder)
       VALUES ($1, $2, $3, $4)`,
      [questionId, choice.text, choice.isCorrect, index + 1],
    );
  }
}

// Loads the quiz named in the URL and checks that the caller may manage it.
async function quizForManager(req, res) {
  const quizId = toId(req.params.quizId);
  const quiz = quizId && (await findQuiz(quizId));
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found." });
    return null;
  }
  if (!(await canManageModule(req.user, quiz.moduleid))) {
    res.status(403).json({ error: "Only this module's instructors can change this quiz." });
    return null;
  }
  return quiz;
}

const LOCKED = "Students have already taken this quiz, so its questions can't change.";

// ---------- Listing and creating quizzes in a module ----------

router.get("/modules/:moduleId/quizzes", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });

  const manager = await canManageModule(req.user, moduleId);
  if (!manager && !(await canViewModule(req.user, moduleId))) {
    return res.status(403).json({ error: "You are not part of this module." });
  }

  const result = await pool.query(
    `SELECT p.modulePageID, p.modulePageOrder, p.quizTitle, p.published,
            COUNT(q.questionID)::int AS questionCount,
            COALESCE(SUM(q.points), 0)::int AS totalPoints
     FROM modulePages p
     LEFT JOIN quizQuestions q ON q.modulePageID = p.modulePageID
     WHERE p.moduleID = $1 AND p.pageType = 'quiz' AND ($2 OR p.published)
     GROUP BY p.modulePageID
     ORDER BY p.modulePageOrder`,
    [moduleId, manager],
  );
  res.json({
    quizzes: result.rows.map((row) => ({
      id: row.modulepageid,
      title: row.quiztitle,
      published: row.published,
      order: row.modulepageorder,
      questionCount: row.questioncount,
      totalPoints: row.totalpoints,
    })),
  });
});

router.post("/modules/:moduleId/quizzes", async (req, res) => {
  const moduleId = toId(req.params.moduleId);
  const title = validTitle(req.body?.title);
  if (!moduleId) return res.status(404).json({ error: "Module not found." });
  if (!title) return res.status(400).json({ error: "Enter a quiz title (up to 150 characters)." });
  if (!(await canManageModule(req.user, moduleId))) {
    return res.status(403).json({ error: "Only this module's instructors can add quizzes." });
  }

  const quiz = await inTransaction(async (client) => {
    const moduleRow = await client.query("SELECT 1 FROM modules WHERE moduleID = $1 FOR UPDATE", [moduleId]);
    if (moduleRow.rowCount === 0) return null;
    const result = await client.query(
      `INSERT INTO modulePages (moduleID, modulePageOrder, modulePageTitle, pageType, quizTitle, published)
       SELECT $1, COALESCE(MAX(modulePageOrder), 0) + 1, $2, 'quiz', $2, FALSE
       FROM modulePages WHERE moduleID = $1
       RETURNING modulePageID, moduleID, modulePageOrder, quizTitle, published`,
      [moduleId, title],
    );
    return result.rows[0];
  });
  if (!quiz) return res.status(404).json({ error: "Module not found." });
  res.status(201).json({ quiz: describeQuiz(quiz, []) });
});

// ---------- Viewing and editing one quiz ----------

router.get("/quizzes/:quizId", async (req, res) => {
  const quizId = toId(req.params.quizId);
  const quiz = quizId && (await findQuiz(quizId));
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const manager = await canManageModule(req.user, quiz.moduleid);
  if (!manager && !(quiz.published && (await canViewModule(req.user, quiz.moduleid)))) {
    return res.status(404).json({ error: "Quiz not found." });
  }
  const questions = await loadQuestions(quizId, manager);
  res.json({ quiz: describeQuiz(quiz, questions) });
});

router.patch("/quizzes/:quizId", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  const title = validTitle(req.body?.title);
  if (!title) return res.status(400).json({ error: "Enter a quiz title (up to 150 characters)." });

  await pool.query(
    "UPDATE modulePages SET quizTitle = $2, modulePageTitle = $2 WHERE modulePageID = $1",
    [quiz.modulepageid, title],
  );
  const updated = await findQuiz(quiz.modulepageid);
  res.json({ quiz: describeQuiz(updated, await loadQuestions(quiz.modulepageid, true)) });
});

router.post("/quizzes/:quizId/questions", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  const { question, error } = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });
  if (await hasAttempts(quiz.modulepageid)) return res.status(409).json({ error: LOCKED });

  await inTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO quizQuestions (modulePageID, questionText, points, questionOrder)
       SELECT $1, $2, $3, COALESCE(MAX(questionOrder), 0) + 1
       FROM quizQuestions WHERE modulePageID = $1
       RETURNING questionID`,
      [quiz.modulepageid, question.text, question.points],
    );
    await insertChoices(client, inserted.rows[0].questionid, question.choices);
  });
  res.status(201).json({ quiz: describeQuiz(quiz, await loadQuestions(quiz.modulepageid, true)) });
});

router.put("/quizzes/:quizId/questions/:questionId", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  const questionId = toId(req.params.questionId);
  const { question, error } = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });
  if (await hasAttempts(quiz.modulepageid)) return res.status(409).json({ error: LOCKED });

  const found = await inTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE quizQuestions SET questionText = $3, points = $4
       WHERE questionID = $1 AND modulePageID = $2`,
      [questionId, quiz.modulepageid, question.text, question.points],
    );
    if (updated.rowCount === 0) return false;
    await client.query("DELETE FROM quizAnswerChoices WHERE questionID = $1", [questionId]);
    await insertChoices(client, questionId, question.choices);
    return true;
  });
  if (!found) return res.status(404).json({ error: "Question not found." });
  res.json({ quiz: describeQuiz(quiz, await loadQuestions(quiz.modulepageid, true)) });
});

router.delete("/quizzes/:quizId/questions/:questionId", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  const questionId = toId(req.params.questionId);
  if (await hasAttempts(quiz.modulepageid)) return res.status(409).json({ error: LOCKED });

  const found = await inTransaction(async (client) => {
    const owned = await client.query(
      "SELECT 1 FROM quizQuestions WHERE questionID = $1 AND modulePageID = $2",
      [questionId, quiz.modulepageid],
    );
    if (owned.rowCount === 0) return false;
    await client.query("DELETE FROM quizAnswerChoices WHERE questionID = $1", [questionId]);
    await client.query("DELETE FROM quizQuestions WHERE questionID = $1", [questionId]);
    return true;
  });
  if (!found) return res.status(404).json({ error: "Question not found." });
  res.json({ quiz: describeQuiz(quiz, await loadQuestions(quiz.modulepageid, true)) });
});

router.delete("/quizzes/:quizId", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;

  const deleted = await inTransaction(async (client) => {
    // Lock the quiz so no student can start submitting while it is being deleted.
    await client.query("SELECT 1 FROM modulePages WHERE modulePageID = $1 FOR UPDATE", [quiz.modulepageid]);
    if (await hasAttempts(quiz.modulepageid, client)) return false;
    await client.query(
      `DELETE FROM quizAnswerChoices
       WHERE questionID IN (SELECT questionID FROM quizQuestions WHERE modulePageID = $1)`,
      [quiz.modulepageid],
    );
    await client.query("DELETE FROM quizQuestions WHERE modulePageID = $1", [quiz.modulepageid]);
    await client.query("DELETE FROM modulePages WHERE modulePageID = $1", [quiz.modulepageid]);
    return true;
  });
  if (!deleted) {
    return res.status(409).json({
      error: "Students have already taken this quiz, so it can't be deleted. Unpublish it to hide it from students instead.",
    });
  }
  res.json({ deleted: true, id: quiz.modulepageid });
});

router.post("/quizzes/:quizId/publish", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  const questions = await loadQuestions(quiz.modulepageid, true);
  if (questions.length === 0) {
    return res.status(400).json({ error: "Add at least one question before publishing." });
  }
  await pool.query("UPDATE modulePages SET published = TRUE WHERE modulePageID = $1", [quiz.modulepageid]);
  res.json({ quiz: describeQuiz({ ...quiz, published: true }, questions) });
});

router.post("/quizzes/:quizId/unpublish", async (req, res) => {
  const quiz = await quizForManager(req, res);
  if (!quiz) return;
  await pool.query("UPDATE modulePages SET published = FALSE WHERE modulePageID = $1", [quiz.modulepageid]);
  res.json({ quiz: describeQuiz({ ...quiz, published: false }, await loadQuestions(quiz.modulepageid, true)) });
});

// ---------- Students taking a quiz ----------

router.post("/quizzes/:quizId/attempts", async (req, res) => {
  const quizId = toId(req.params.quizId);
  const quiz = quizId && (await findQuiz(quizId));
  if (!quiz || !quiz.published || !(await isEnrolled(req.user, quiz.moduleid))) {
    return res.status(404).json({ error: "Quiz not found." });
  }

  const questions = await loadQuestions(quizId, true);
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const chosen = new Map();
  for (const answer of answers) {
    const questionId = toId(answer?.questionId);
    const choiceId = toId(answer?.choiceId);
    if (!questionId || !choiceId || chosen.has(questionId)) {
      return res.status(400).json({ error: "Each question needs exactly one answer." });
    }
    chosen.set(questionId, choiceId);
  }

  let score = 0;
  let maxScore = 0;
  const results = [];
  for (const question of questions) {
    const choiceId = chosen.get(question.id);
    const choice = question.choices.find((item) => item.id === choiceId);
    if (!choice) {
      return res.status(400).json({ error: "Answer every question before submitting." });
    }
    const correctChoice = question.choices.find((item) => item.isCorrect);
    maxScore += question.points;
    if (choice.isCorrect) score += question.points;
    results.push({ questionId: question.id, choiceId, correct: choice.isCorrect, correctChoiceId: correctChoice.id });
  }
  if (chosen.size !== questions.length) {
    return res.status(400).json({ error: "Answers must match this quiz's questions." });
  }

  const attempt = await inTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO quizAttempts (modulePageID, userID, startedAt, submittedAt, score, maxScore)
       VALUES ($1, $2, NOW(), NOW(), $3, $4)
       RETURNING attemptID, submittedAt`,
      [quizId, req.user.id, score, maxScore],
    );
    const { attemptid } = inserted.rows[0];
    for (const result of results) {
      await client.query(
        `INSERT INTO quizAttemptAnswers (attemptID, modulePageID, questionID, choiceID)
         VALUES ($1, $2, $3, $4)`,
        [attemptid, quizId, result.questionId, result.choiceId],
      );
    }
    return inserted.rows[0];
  });

  res.status(201).json({
    attempt: { id: attempt.attemptid, submittedAt: attempt.submittedat, score, maxScore, results },
  });
});

router.get("/quizzes/:quizId/attempts/me", async (req, res) => {
  const quizId = toId(req.params.quizId);
  const quiz = quizId && (await findQuiz(quizId));
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });

  const result = await pool.query(
    `SELECT attemptID, submittedAt, score, maxScore
     FROM quizAttempts
     WHERE modulePageID = $1 AND userID = $2 AND submittedAt IS NOT NULL
     ORDER BY submittedAt DESC, attemptID DESC`,
    [quizId, req.user.id],
  );
  res.json({
    attempts: result.rows.map((row) => ({
      id: row.attemptid,
      submittedAt: row.submittedat,
      score: row.score,
      maxScore: row.maxscore,
    })),
  });
});

export default router;