import pg from "pg";
import { getConnectionString } from "@netlify/database";

const poolOptions = {
  max: Number(process.env.DB_POOL_MAX ?? 3),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
};

// Netlify functions may not expose NETLIFY_DB_URL directly. Use Netlify's
// helper there; local development continues to use the Docker settings below.
const isNetlifyRuntime =
  process.env.NETLIFY === "true" ||
  Boolean(process.env.CONTEXT || process.env.AWS_LAMBDA_FUNCTION_NAME);
const connectionString = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;

const pool = connectionString
  ? new pg.Pool({ ...poolOptions, connectionString })
  : isNetlifyRuntime
    ? new pg.Pool({ ...poolOptions, connectionString: getConnectionString() })
    : new pg.Pool({
        ...poolOptions,
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? process.env.DB_HOST_PORT ?? 5434),
        user: process.env.POSTGRES_USER ?? "appuser",
        password: process.env.POSTGRES_PASSWORD ?? "apppassword",
        database: process.env.POSTGRES_DB ?? "database",
      });

export default pool;
