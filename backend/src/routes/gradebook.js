import { Router } from "express";
import pool from "../db/pool.js";
import requireUser from "../middleware/requireUser.js";

const router = Router();
router.use(requireUser);

function percentage(score, maxScore) {
  if (score === null || maxScore === null || maxScore === 0) return null;
  return (Number(score) / Number(maxScore)) * 100;
}

function rounded(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function gradeFor(quizzes) {
  if (quizzes.length === 0 || quizzes.some((quiz) => quiz.percentage === null)) {
    return null;
  }
  return rounded(
    quizzes.reduce((sum, quiz) => sum + quiz.percentage, 0) / quizzes.length,
  );
}

function moduleRecords(rows, teacherView) {
  const modules = new Map();
  for (const row of rows) {
    let module = modules.get(row.moduleid);
    if (!module) {
      module = {
        moduleId: row.moduleid,
        moduleName: row.modulename,
        quizzes: new Map(),
        students: new Map(),
      };
      modules.set(row.moduleid, module);
    }

    if (row.quizid && !module.quizzes.has(row.quizid)) {
      module.quizzes.set(row.quizid, {
        quizId: row.quizid,
        title: row.quiztitle,
      });
    }

    if (row.studentid) {
      let student = module.students.get(row.studentid);
      if (!student) {
        student = {
          studentId: row.studentid,
          name: row.studentname,
          ...(teacherView ? { email: row.email } : {}),
          quizzes: new Map(),
        };
        module.students.set(row.studentid, student);
      }

      if (row.quizid) {
        student.quizzes.set(row.quizid, {
          quizId: row.quizid,
          title: row.quiztitle,
          score: row.score === null ? null : Number(row.score),
          maxScore: row.maxscore === null ? null : Number(row.maxscore),
          percentage: percentage(row.score, row.maxscore),
          submittedAt: row.submittedat,
          attemptCount: Number(row.attemptcount || 0),
        });
      }
    }
  }

  return [...modules.values()].map((module) => {
    const quizList = [...module.quizzes.values()];
    const studentList = [...module.students.values()].map((student) => {
      const quizzes = quizList.map(
        (quiz) =>
          student.quizzes.get(quiz.quizId) ?? {
            ...quiz,
            score: null,
            maxScore: null,
            percentage: null,
            submittedAt: null,
            attemptCount: 0,
          },
      );
      return {
        ...student,
        quizzes,
        grade: gradeFor(quizzes),
        completedQuizCount: quizzes.filter(
          (quiz) => quiz.percentage !== null,
        ).length,
      };
    });

    const result = {
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      quizCount: quizList.length,
    };
    if (teacherView) {
      result.quizzes = quizList;
      result.students = studentList;
    } else {
      const student = studentList[0];
      result.quizzes = student?.quizzes ?? [];
      result.grade = student?.grade ?? null;
      result.completedQuizCount = student?.completedQuizCount ?? 0;
    }
    return result;
  });
}

const attemptColumns = `
  LEFT JOIN LATERAL (
    SELECT score, maxScore, submittedAt, COUNT(*) OVER()::int AS attemptCount
    FROM quizAttempts
    WHERE modulePageID = p.modulePageID AND userID = ms.userID
      AND submittedAt IS NOT NULL
    ORDER BY submittedAt DESC, attemptID DESC
    LIMIT 1
  ) latest ON TRUE`;

router.get("/", async (req, res) => {
  if (!req.user.isTeacher && !req.user.isStudent) {
    return res.status(403).json({ error: "The gradebook is not available for your account." });
  }

  const teacherView = req.user.isTeacher;
  const scope = teacherView
    ? `JOIN moduleTeachers scope ON scope.moduleID = m.moduleID AND scope.userID = $1`
    : `JOIN moduleStudents scope ON scope.moduleID = m.moduleID
       AND scope.userID = $1 AND scope.status = 'active'`;
  const studentJoin = teacherView
    ? `LEFT JOIN moduleStudents ms ON ms.moduleID = m.moduleID AND ms.status = 'active'`
    : `LEFT JOIN moduleStudents ms ON ms.moduleID = m.moduleID
       AND ms.userID = $1 AND ms.status = 'active'`;

  const result = await pool.query(
    `SELECT m.moduleID, m.name AS moduleName,
            p.modulePageID AS quizID, p.quizTitle,
            u.userID AS studentID,
            COALESCE(NULLIF(u.displayName, ''), u.username) AS studentName,
            u.email,
            latest.score, latest.maxScore, latest.submittedAt,
            latest.attemptCount
     FROM modules m
     ${scope}
     ${studentJoin}
     LEFT JOIN users u ON u.userID = ms.userID
     LEFT JOIN modulePages p
       ON p.moduleID = m.moduleID AND p.pageType = 'quiz' AND p.published = TRUE
     ${attemptColumns}
     ORDER BY m.moduleID, u.userID, p.modulePageOrder`,
    [req.user.id],
  );

  res.json({ modules: moduleRecords(result.rows, teacherView) });
});

export default router;
