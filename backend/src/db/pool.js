import pg from "pg";

const pool = new pg.Pool({ //creates a new connection pool to the database
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? process.env.DB_HOST_PORT ?? 5434),
  user: process.env.POSTGRES_USER ?? "appuser",
  password: process.env.POSTGRES_PASSWORD ?? "apppassword",
  database: process.env.POSTGRES_DB ?? "database",
});

export default pool;
