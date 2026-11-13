import pg from "pg";

// Netlify Database exposes NETLIFY_DB_URL to deployed functions. DATABASE_URL
// also lets the app use another hosted Postgres provider without code changes.
// Local development keeps the existing host/port/user/password defaults.
const connectionString = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
const pool = new pg.Pool(connectionString
  ? {
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 3),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    }
  : {
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? process.env.DB_HOST_PORT ?? 5434),
      user: process.env.POSTGRES_USER ?? "appuser",
      password: process.env.POSTGRES_PASSWORD ?? "apppassword",
      database: process.env.POSTGRES_DB ?? "database",
      max: Number(process.env.DB_POOL_MAX ?? 3),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    });

export default pool;
