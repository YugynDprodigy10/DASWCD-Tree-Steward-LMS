import { createServer as createHttpServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwks = { ...(await exportJWK(publicKey)), kid: "auth-test-key", alg: "RS256", use: "sig" };
const auth0CreatedUsers = new Map();
const passwordSetupEmails = [];
const jwksServer = createHttpServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (req.url === "/.well-known/jwks.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [jwks] }));
    } else if (req.url === "/oauth/token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "mock-management-token", expires_in: 3600 }));
    } else if (req.url === "/api/v2/users" && req.method === "POST") {
      const userId = `auth0|invite-${auth0CreatedUsers.size + 1}`;
      auth0CreatedUsers.set(body.email, userId);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ user_id: userId }));
    } else if (req.url.startsWith("/api/v2/users/") && req.method === "DELETE") {
      res.writeHead(204);
      res.end();
    } else if (req.url === "/dbconnections/change_password" && req.method === "POST") {
      passwordSetupEmails.push(body.email);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("We've just sent you an email to set your password.");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
});

await new Promise((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
process.env.AUTH0_DOMAIN = "steward-test.auth0.local";
process.env.AUTH0_AUDIENCE = "https://steward-tree.test/api";
process.env.NODE_ENV = "test";
process.env.ENABLE_TEST_LOGIN = "true";
process.env.AUTH0_JWKS_URI = `http://127.0.0.1:${jwksServer.address().port}/.well-known/jwks.json`;
process.env.AUTH0_MANAGEMENT_API_URL = `http://127.0.0.1:${jwksServer.address().port}/api/v2`;
process.env.AUTH0_MANAGEMENT_TOKEN_URL = `http://127.0.0.1:${jwksServer.address().port}/oauth/token`;
process.env.AUTH0_PASSWORD_CHANGE_URL = `http://127.0.0.1:${jwksServer.address().port}/dbconnections/change_password`;
process.env.AUTH0_MGMT_CLIENT_ID = "test-management-client";
process.env.AUTH0_MGMT_CLIENT_SECRET = "test-management-secret";
process.env.AUTH0_SPA_CLIENT_ID = "test-spa-client";
process.env.AUTH0_DATABASE_CONNECTION = "test-database-connection";

const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/db/pool.js");

export function createAuthTestContext(prefix) {
  const tag = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const users = {};
  const emails = {};
  const invitedUserIds = [];
  let server;
  let baseUrl;
  let moduleId;
  let insertedLocalTestUserId;

  async function makeUser(name, roles) {
    const email = `${tag}-${name}@example.com`;
    const result = await pool.query(
      `INSERT INTO users (username, email, student, teacher, administrator)
       VALUES ($1, $2, $3, $4, $5) RETURNING userID`,
      [
        `${tag}-${name}`,
        email,
        roles.student ?? false,
        roles.teacher ?? false,
        roles.administrator ?? false,
      ],
    );
    emails[name] = email;
    return result.rows[0].userid;
  }

  async function api(path, { as, method = "GET", body, tokenClaims, bearerToken, auth0Subject } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    if (as) {
      const token = await new SignJWT({
        "https://stewardtree.app/claims/email": emails[as],
        "https://stewardtree.app/claims/email_verified": true,
        ...tokenClaims,
      })
        .setProtectedHeader({ alg: "RS256", kid: jwks.kid })
        .setIssuer("https://steward-test.auth0.local/")
        .setAudience(process.env.AUTH0_AUDIENCE)
        .setSubject(auth0Subject ?? `auth0|${users[as]}`)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
    // 204 responses (e.g. deleting a lesson) have no body, so only parse when there is one
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function setup({ localTestAccount = false } = {}) {
    const moduleRow = await pool.query(
      "INSERT INTO modules (name) VALUES ($1) RETURNING moduleID",
      [tag],
    );
    moduleId = moduleRow.rows[0].moduleid;

    if (localTestAccount) {
      const seededStudent = await pool.query(
        "SELECT userID FROM users WHERE LOWER(username) = 'test student 1'",
      );
      if (!seededStudent.rows[0]) {
        const localTestUser = await pool.query(
          `INSERT INTO users (username, email, student, teacher, administrator)
           VALUES ('test student 1', $1, TRUE, FALSE, FALSE)
           ON CONFLICT (username) DO NOTHING
           RETURNING userID`,
          [`${tag}-local-test@example.com`],
        );
        insertedLocalTestUserId = localTestUser.rows[0]?.userid;
      }
    }

    users.teacher = await makeUser("teacher", { teacher: true });
    users.otherTeacher = await makeUser("otherTeacher", { teacher: true });
    users.student = await makeUser("student", { student: true });
    users.outsider = await makeUser("outsider", { student: true });
    users.admin = await makeUser("admin", { administrator: true });
    await pool.query(
      "INSERT INTO moduleTeachers (moduleID, userID) VALUES ($1, $2)",
      [moduleId, users.teacher],
    );
    await pool.query(
      "INSERT INTO moduleStudents (moduleID, userID, status) VALUES ($1, $2, 'active')",
      [moduleId, users.student],
    );
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  async function cleanup() {
    await new Promise((resolve) => server?.close(resolve) ?? resolve());
    const ids = [...Object.values(users), ...invitedUserIds];
    if (moduleId) {
      await pool.query(
        "DELETE FROM quizAttemptAnswers WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)",
        [moduleId],
      );
      await pool.query(
        "DELETE FROM quizAttempts WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)",
        [moduleId],
      );
      await pool.query(
        "DELETE FROM quizAnswerChoices WHERE questionID IN (SELECT questionID FROM quizQuestions q JOIN modulePages p USING (modulePageID) WHERE p.moduleID = $1)",
        [moduleId],
      );
      await pool.query(
        "DELETE FROM quizQuestions WHERE modulePageID IN (SELECT modulePageID FROM modulePages WHERE moduleID = $1)",
        [moduleId],
      );
      await pool.query("DELETE FROM modulePages WHERE moduleID = $1", [moduleId]);
      // lesson files reference lessons, and both reference the module, so they go first
      await pool.query("DELETE FROM lessonFiles WHERE moduleID = $1", [moduleId]);
      await pool.query("DELETE FROM moduleLessons WHERE moduleID = $1", [moduleId]);
      await pool.query("DELETE FROM moduleTeachers WHERE moduleID = $1", [moduleId]);
      await pool.query("DELETE FROM moduleStudents WHERE moduleID = $1", [moduleId]);
      await pool.query("DELETE FROM modules WHERE moduleID = $1", [moduleId]);
    }
    if (insertedLocalTestUserId) {
      await pool.query("DELETE FROM users WHERE userID = $1", [insertedLocalTestUserId]);
    }
    if (ids.length) {
      await pool.query("DELETE FROM users WHERE userID = ANY($1)", [ids]);
    }
    await new Promise((resolve) => jwksServer.close(resolve));
    await pool.end();
  }

  return {
    tag,
    pool,
    users,
    emails,
    auth0CreatedUsers,
    passwordSetupEmails,
    invitedUserIds,
    get moduleId() {
      return moduleId;
    },
    api,
    setup,
    cleanup,
  };
}
