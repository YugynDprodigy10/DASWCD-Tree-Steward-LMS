//The purpose of this file is to apply database migrations
//allowing any user who downloads the project to run it locally
//


import { readFile } from "node:fs/promises";
import { withDatabase } from "./database.js";

//VERY IMPORTANT: Make sure that ALL migration files for the database are listed under 'const migrationPath'
async function runMigration() { // Applies the database migration files.
  await withDatabase(async (client) => {
    const migrationPath = new URL(
      "../databaseInstructions/migrations/create_database.sql",
      import.meta.url
    );
    const migrationSql = await readFile(migrationPath, "utf8");

    await client.query(migrationSql);
    console.log("create_users.sql applied successfully.");
    const result = await client.query("SELECT current_user, current_database();");
    console.log(result.rows);
  });
}

runMigration().catch((error) => { // Reports an error if the migration fails.
  console.error("Migration failed:");
  console.error(error);
  process.exitCode = 1;
});