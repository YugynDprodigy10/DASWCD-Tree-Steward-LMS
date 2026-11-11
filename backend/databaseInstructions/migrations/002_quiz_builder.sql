/*
Hi! This is the postgreSQL database schema!
VERY IMPORTANT: Make sure that ALL migration files for the database are listed under 'const migrationFiles' in the 'migrate.js' file.
Adds what the built-in quiz builder needs on top of create_database.sql:
- a draft/published flag on module pages, so quizzes can be saved before students see them
- an order for questions and answer choices, so the builder and students see them in a stable order
*/

ALTER TABLE modulePages ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quizQuestions ADD COLUMN IF NOT EXISTS questionOrder INT NOT NULL DEFAULT 0;
ALTER TABLE quizAnswerChoices ADD COLUMN IF NOT EXISTS choiceOrder INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS quiz_questions_by_page ON quizQuestions (modulePageID);
CREATE INDEX IF NOT EXISTS quiz_attempts_by_user ON quizAttempts (userID, modulePageID);