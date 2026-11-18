-- Each quiz allows a set number of attempts (1-10, including the first).
-- Quizzes start at one attempt; instructors turn on retakes per quiz.
-- The column lives on modulePages because quizzes are module pages.
ALTER TABLE modulePages
    ADD COLUMN IF NOT EXISTS maxAttempts INT NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'modulepages_maxattempts_range'
    ) THEN
        ALTER TABLE modulePages
            ADD CONSTRAINT modulepages_maxattempts_range
            CHECK (maxAttempts BETWEEN 1 AND 10);
    END IF;
END $$;