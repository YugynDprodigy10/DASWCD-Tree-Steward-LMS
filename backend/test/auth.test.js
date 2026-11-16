// Authentication and account-invitation API tests use isolated test fixtures.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createAuthTestContext } from "../test-support/authTestContext.js";

const context = createAuthTestContext("authtest");
const {
  api,
  pool,
  users,
  emails,
  tag,
  auth0CreatedUsers,
  passwordSetupEmails,
  invitedUserIds,
} = context;
let moduleId;

before(async () => {
  await context.setup({ localTestAccount: true });
  moduleId = context.moduleId;
});

after(() => context.cleanup());

test("quiz API routes require authentication but health remains public", async () => {
  assert.equal((await api(`/modules/${moduleId}/quizzes`)).status, 401);
  assert.equal((await api("/health")).status, 200);
});

test("Auth0 identity links to the pre-provisioned account and supplies its role", async () => {
  const result = await api("/auth/me", { as: "teacher" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.user.roles, ["teacher"]);
  const linked = await pool.query(
    "SELECT auth0Sub FROM users WHERE userID = $1",
    [users.teacher],
  );
  assert.equal(linked.rows[0].auth0sub, `auth0|${users.teacher}`);
});

test("only verified emails with a provisioned LMS account can authenticate", async () => {
  const unverified = await api("/auth/me", {
    as: "student",
    tokenClaims: { "https://stewardtree.app/claims/email_verified": false },
  });
  assert.equal(unverified.status, 403);

  const unknown = await api("/auth/me", {
    as: "student",
    tokenClaims: {
      "https://stewardtree.app/claims/email": "unknown@example.com",
    },
  });
  assert.equal(unknown.status, 403);
});

test("local test sign-in issues an API token for a seeded account", async () => {
  const login = await api("/auth/test-login", {
    method: "POST",
    body: { account: "student" },
  });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.user.roles, ["student"]);
  assert.ok(login.body.accessToken);

  const identity = await api("/auth/me", { bearerToken: login.body.accessToken });
  assert.equal(identity.status, 200);
  assert.equal(identity.body.user.id, login.body.user.id);
  assert.deepEqual(identity.body.user.roles, ["student"]);

  const invalid = await api("/auth/test-login", {
    method: "POST",
    body: { account: "unknown" },
  });
  assert.equal(invalid.status, 400);
});

test("local test sign-in is unavailable in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = await api("/auth/test-login", {
      method: "POST",
      body: { account: "student" },
    });
    assert.equal(result.status, 404);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("local test sign-in is unavailable when NODE_ENV is not set", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    const result = await api("/auth/test-login", {
      method: "POST",
      body: { account: "student" },
    });
    assert.equal(result.status, 404);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("admins can create LMS and Auth0 accounts and send a password setup email", async () => {
  const email = `${tag}-invite@example.com`;
  const result = await api("/admin/invitations", {
    as: "admin",
    method: "POST",
    body: { name: "Invited Instructor", email, role: "instructor", moduleIds: [moduleId] },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.emailSent, true);
  assert.equal(result.body.invitation.email, email);
  assert.equal(result.body.invitation.auth0Managed, true);
  invitedUserIds.push(result.body.invitation.id);
  emails.invited = email;
  assert.deepEqual(passwordSetupEmails, [email]);

  const user = await pool.query(
    `SELECT auth0Sub, auth0InvitePending, teacher, student, administrator
     FROM users WHERE userID = $1`,
    [result.body.invitation.id],
  );
  assert.equal(user.rows[0].auth0sub, auth0CreatedUsers.get(email));
  assert.equal(user.rows[0].auth0invitepending, true);
  assert.equal(user.rows[0].teacher, true);
  assert.equal(user.rows[0].student, false);
  assert.equal(user.rows[0].administrator, false);
  assert.equal(
    (await pool.query(
      "SELECT 1 FROM moduleTeachers WHERE moduleID = $1 AND userID = $2",
      [moduleId, result.body.invitation.id],
    )).rowCount,
    1,
  );
});

test("only admins may use account invitation endpoints", async () => {
  const denied = await api("/admin/invitations", {
    as: "student",
    method: "POST",
    body: { name: "Denied", email: `${tag}-denied@example.com`, role: "student" },
  });
  assert.equal(denied.status, 403);
  assert.equal((await api("/admin/invitations")).status, 401);
});

test("admins can list and resend pending setup emails", async () => {
  const pending = await api("/admin/invitations", { as: "admin" });
  assert.ok(pending.body.invitations.some((invite) => invite.email === `${tag}-invite@example.com`));

  const invite = pending.body.invitations.find((item) => item.email === `${tag}-invite@example.com`);
  const resent = await api(`/admin/invitations/${invite.id}/resend`, {
    as: "admin",
    method: "POST",
  });
  assert.equal(resent.status, 200);
  assert.equal(resent.body.emailSent, true);
  assert.deepEqual(passwordSetupEmails, [`${tag}-invite@example.com`, `${tag}-invite@example.com`]);
});

test("invited accounts can authenticate and clear pending status after verified login", async () => {
  const email = `${tag}-invite@example.com`;
  const auth0Subject = auth0CreatedUsers.get(email);
  const firstLogin = await api("/auth/me", {
    as: "invited",
    auth0Subject,
    tokenClaims: { "https://stewardtree.app/claims/email_verified": false },
  });
  assert.equal(firstLogin.status, 200);
  assert.deepEqual(firstLogin.body.user.roles, ["teacher"]);

  const verifiedLogin = await api("/auth/me", {
    as: "invited",
    auth0Subject,
  });
  assert.equal(verifiedLogin.status, 200);
  const pending = await pool.query(
    "SELECT auth0InvitePending FROM users WHERE email = $1",
    [email],
  );
  assert.equal(pending.rows[0].auth0invitepending, false);
});

test("account invitations reject duplicates and malformed roles", async () => {
  const duplicate = await api("/admin/invitations", {
    as: "admin",
    method: "POST",
    body: {
      name: "Duplicate",
      email: `${tag}-invite@example.com`,
      role: "student",
    },
  });
  assert.equal(duplicate.status, 409);

  const malformed = await api("/admin/invitations", {
    as: "admin",
    method: "POST",
    body: {
      name: "Bad Role",
      email: `${tag}-bad-role@example.com`,
      role: "owner",
    },
  });
  assert.equal(malformed.status, 400);
});