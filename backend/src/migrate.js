//The purpose of this file is to apply database migrations
//allowing any user who downloads the project to run it locally
//


import "dotenv/config";
import { readFile } from "node:fs/promises";
import { withDatabase } from "./database.js";

//VERY IMPORTANT: Make sure that ALL migration files for the database are listed under 'const migrationFiles', in the order they must run.
const migrationFiles = [
  "create_database.sql",
  "002_quiz_builder.sql",
  "003_auth0_identity.sql",
  "004_remove_password_temp.sql",
  "005_admin_auth0_invitations.sql",
  "006_module_materials.sql",
];

async function runMigration() { // Applies the database migration files in order.
  await withDatabase(async (client) => {
    for (const file of migrationFiles) {
      const migrationPath = new URL(`../databaseInstructions/migrations/${file}`, import.meta.url);
      const migrationSql = await readFile(migrationPath, "utf8");
      await client.query(migrationSql);
      console.log(`${file} applied successfully.`);
    }
    const result = await client.query("SELECT current_user, current_database();");
    console.log(result.rows);
  });
}

runMigration().catch((error) => { // Reports an error if the migration fails.
  console.error("Migration failed:");
  console.error(error);
  process.exitCode = 1;
});