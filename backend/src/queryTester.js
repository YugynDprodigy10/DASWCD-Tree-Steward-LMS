//The purpose of this file is simply to test queries, and will not go in the end product.
//
//

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { withDatabase } from "./database.js";

async function queryTester() { // Tests the database connection and queries.
  await withDatabase(async (client) => {
    const sqlPath = new URL(
      "../databaseInstructions/testQueries/testQueries.sql",
      import.meta.url
    );
    const sql = await readFile(sqlPath, "utf8");
    const result = await client.query(sql);
    const rows = Array.isArray(result)
      ? result.flatMap((queryResult) => queryResult.rows ?? [])
      : result.rows;
    console.log(rows);
  });
}

queryTester().catch((error) => {
  console.error("Query test failed:");
  console.error(error);
  process.exitCode = 1;
});