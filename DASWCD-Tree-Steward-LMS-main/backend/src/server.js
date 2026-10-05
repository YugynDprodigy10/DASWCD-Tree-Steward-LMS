import express from "express";
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? "appuser",
  password: process.env.POSTGRES_PASSWORD ?? "apppassword",
  database: process.env.POSTGRES_DB ?? "database",
});

const app = express();
app.use(express.json());

app.get("/api/health", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({ ok: true, databaseTime: result.rows[0].now });
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));