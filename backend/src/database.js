//The purpose of this file is to work in conjunction with the migration file just to ensure
//that there are no errors on startup
//

import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";

const { Client } = pg;

const connectionSettings = {
  user: process.env.POSTGRES_USER ?? "appuser",
  password: process.env.POSTGRES_PASSWORD ?? "apppassword",
  database: process.env.POSTGRES_DB ?? "database",
};

function getRunningDatabasePort() { // Check whether the Docker database is already running.
  const runningContainer = execFileSync(
    "docker",
    ["compose", "ps", "--status", "running", "-q", "database"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  ).trim();

  if (!runningContainer) {
    return null;
  }

  const publishedPort = execFileSync(
    "docker",
    ["compose", "port", "database", "5432"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  ).trim();
  const match = publishedPort.match(/:(\d+)\s*$/m);

  if (!match) {
    throw new Error(`Could not determine the Docker database port: ${publishedPort}`);
  }

  return Number(match[1]);
}

function isPortAvailable(port) { // Checks whether the host port is free for Docker to use.
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
      } else {
        reject(error);
      }
    });

    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) { // Tries the next port when the preferred port is occupied.
  for (let port = startPort; port <= 65535; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available host port found starting at ${startPort}.`);
}

async function connectWithRetry(host, port) { // Retries while PostgreSQL is starting up.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const client = new Client({ ...connectionSettings, host, port });

    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});

      if (error.code !== "ECONNREFUSED" && error.code !== "57P03") {
        throw error;
      }

      if (attempt === 19) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function withDatabase(callback) {
  // A hosted Postgres URL skips all local container setup, so the same
  // migration command can run against a deliberately selected remote DB.
  const connectionString = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
  if (connectionString) {
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5_000,
    });
    await client.connect();
    try {
      return await callback(client);
    } finally {
      await client.end();
    }
  }

  let host = process.env.DB_HOST;
  let hostPort = Number(process.env.DB_PORT ?? 5434);

  if (!host) {
    const existingPort = getRunningDatabasePort();
    hostPort = existingPort ?? await findAvailablePort(5434);
    process.env.DB_HOST_PORT = String(hostPort);
    host = "127.0.0.1";

    console.log(`Starting Docker database on host port ${hostPort}...`);
    execFileSync("docker", ["compose", "up", "-d"], { stdio: "inherit" });
  }

  const client = await connectWithRetry(host, hostPort);

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export { withDatabase };
