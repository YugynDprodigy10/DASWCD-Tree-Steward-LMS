import express from "express";
import pool from "./db/pool.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import quizRouter from "./routes/quizzes.js";

// Builds the Express app without starting it, so tests can run it on any port.
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter); //allows the frontend to be handled by auth.js in the backend.
app.use("/api/admin", adminRouter);
app.use("/api", quizRouter);

app.get("/api/health", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({ ok: true, databaseTime: result.rows[0].now });
});

// Turns unexpected errors into a JSON response instead of crashing or leaking details.
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;