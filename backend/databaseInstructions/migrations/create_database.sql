/*
Hi! This is the postgreSQL database schema!
VERY IMPORTANT: Make sure that ALL migration files for the database are listed under 'const migrationPath' in the 'migrate.js' file.
other sql files created beyond this one REQUIRE this header!
*/

CREATE TABLE IF NOT EXISTS users (
    userID SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordTemp TEXT NOT NULL,
    student BOOLEAN NOT NULL DEFAULT FALSE,
    teacher BOOLEAN NOT NULL DEFAULT FALSE,
    administrator BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS student BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS administrator BOOLEAN DEFAULT FALSE;

UPDATE users SET student = FALSE WHERE student IS NULL;
UPDATE users SET teacher = FALSE WHERE teacher IS NULL;
UPDATE users SET administrator = FALSE WHERE administrator IS NULL;

ALTER TABLE users ALTER COLUMN student SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN student SET NOT NULL;
ALTER TABLE users ALTER COLUMN teacher SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN teacher SET NOT NULL;
ALTER TABLE users ALTER COLUMN administrator SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN administrator SET NOT NULL;

CREATE TABLE IF NOT EXISTS modules (
    moduleID SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moduleTeachers (
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    userID INT NOT NULL REFERENCES users(userID),
    UNIQUE (moduleID, userID)
);

CREATE TABLE IF NOT EXISTS moduleStudents (
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    userID INT NOT NULL REFERENCES users(userID),
    enrollmentDate DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
    UNIQUE (moduleID, userID)
);

CREATE TABLE IF NOT EXISTS modulePages (
    modulePageID SERIAL PRIMARY KEY,
    moduleID INT NOT NULL REFERENCES modules(moduleID),
    modulePageOrder INT NOT NULL,
    modulePageTitle TEXT NOT NULL,
    pageType TEXT NOT NULL CHECK (pageType IN ('announcement', 'quiz', 'activity')),
    announcementTitle TEXT,
    announcementText TEXT,
    activityTitle TEXT,
    quizTitle TEXT,
    UNIQUE (moduleID, modulePageOrder),
    UNIQUE (modulePageID, pageType),
    CHECK (
        (pageType = 'announcement' AND announcementTitle IS NOT NULL AND announcementText IS NOT NULL
            AND activityTitle IS NULL AND quizTitle IS NULL)
        OR (pageType = 'activity' AND announcementTitle IS NULL AND announcementText IS NULL
            AND activityTitle IS NOT NULL AND quizTitle IS NULL)
        OR (pageType = 'quiz' AND announcementTitle IS NULL AND announcementText IS NULL
            AND activityTitle IS NULL AND quizTitle IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS quizQuestions (
    questionID SERIAL PRIMARY KEY,
    modulePageID INT NOT NULL,
    pageType TEXT NOT NULL DEFAULT 'quiz' CHECK (pageType = 'quiz'),
    questionText TEXT NOT NULL,
    points INT NOT NULL CHECK (points > 0),
    UNIQUE (questionID, modulePageID),
    FOREIGN KEY (modulePageID, pageType)
        REFERENCES modulePages(modulePageID, pageType)
);

CREATE TABLE IF NOT EXISTS quizAnswerChoices (
    choiceID SERIAL PRIMARY KEY,
    questionID INT NOT NULL REFERENCES quizQuestions(questionID),
    choiceText TEXT NOT NULL,
    isCorrect BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (choiceID, questionID)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_correct_choice_per_question
    ON quizAnswerChoices (questionID)
    WHERE isCorrect;

CREATE TABLE IF NOT EXISTS quizAttempts (
    attemptID SERIAL PRIMARY KEY,
    modulePageID INT NOT NULL,
    pageType TEXT NOT NULL DEFAULT 'quiz' CHECK (pageType = 'quiz'),
    userID INT NOT NULL REFERENCES users(userID),
    startedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submittedAt TIMESTAMPTZ,
    score INT,
    maxScore INT,
    UNIQUE (attemptID, modulePageID),
    FOREIGN KEY (modulePageID, pageType)
        REFERENCES modulePages(modulePageID, pageType),
    CHECK (
        (submittedAt IS NULL AND score IS NULL AND maxScore IS NULL)
        OR (submittedAt IS NOT NULL AND score IS NOT NULL AND maxScore IS NOT NULL
            AND score >= 0 AND score <= maxScore)
    ),
    CHECK (submittedAt IS NULL OR submittedAt >= startedAt)
);

CREATE TABLE IF NOT EXISTS quizAttemptAnswers (
    attemptID INT NOT NULL,
    modulePageID INT NOT NULL,
    questionID INT NOT NULL,
    choiceID INT NOT NULL,
    PRIMARY KEY (attemptID, questionID),
    FOREIGN KEY (attemptID, modulePageID)
        REFERENCES quizAttempts(attemptID, modulePageID),
    FOREIGN KEY (questionID, modulePageID)
        REFERENCES quizQuestions(questionID, modulePageID),
    FOREIGN KEY (choiceID, questionID)
        REFERENCES quizAnswerChoices(choiceID, questionID)
);


