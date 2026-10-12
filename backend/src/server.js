import express from "express";
import pool from "./db/pool.js";
import authRouter from "./routes/auth.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter); //allows the frontend to be handled by auth.js in the backend.

app.get("/api/health", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({ ok: true, databaseTime: result.rows[0].now });
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));