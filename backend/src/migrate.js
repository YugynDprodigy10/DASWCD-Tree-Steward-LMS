//The purpose of this file is to apply database migrations
//allowing any user who downloads the project to run it locally
//


import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { withDatabase } from "./database.js";

// Netlify applies this same directory during deploys. Numbered filenames keep
// the migration order explicit and prevent the app from maintaining a copy.
const migrationsDirectory = new URL("../../netlify/database/migrations/", import.meta.url);

async function runMigration() { // Applies the database migration files in order.
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (migrationFiles.length === 0) {
    throw new Error("No numbered SQL migrations were found.");
  }

  await withDatabase(async (client) => {
    for (const file of migrationFiles) {
      const migrationPath = new URL(`../../netlify/database/migrations/${file}`, import.meta.url);
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
