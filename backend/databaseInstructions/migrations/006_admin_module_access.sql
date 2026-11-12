/*
Hi! This is the PostgreSQL database schema!
Stores the catalog visibility flags managed from the administrator module page.
*/

ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS studentsVisible BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS instructorsVisible BOOLEAN NOT NULL DEFAULT TRUE;
