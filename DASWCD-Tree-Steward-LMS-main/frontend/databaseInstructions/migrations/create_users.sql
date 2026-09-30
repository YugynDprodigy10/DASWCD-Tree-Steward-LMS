/*
Hi! This is the postgreSQL database schema!
VERY IMPORTANT: Make sure that ALL migration files for the database are listed under 'const migrationPath' in the 'migrate.js' file.
other sql files created beyond this one REQUIRE this header!*/

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    passwordTemp TEXT NOT NULL,
    student BOOLEAN DEFAULT FALSE,
    teacher BOOLEAN DEFAULT FALSE,
    administrator BOOLEAN DEFAULT FALSE
);


/*ALTER TABLE users 
    ADD COLUMN teacher BOOLEAN DEFAULT FALSE
    ADD COLUMN admin BOOLEAN DEFAULT FALSE
    ADD COLUMN passwordTemp text;
    DELETE COLUMN name;*/
    

/*ALTER TABLE users (
    DELETE COLUMN student BOOLEAN DEFAULT FALSE;
)*/

