import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { isLocalTestLoginEnabled, verifyLocalTestToken } from "../auth/localTestAuth.js";
import pool from "../db/pool.js";

let verifier;
let verifierConfig;
const authConfigurationError = "Set AUTH0_DOMAIN and AUTH0_AUDIENCE to enable API authentication.";

function getVerifier() {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!domain || !audience) {
    throw new Error(authConfigurationError);
  }

  const issuer = `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/`;
  const jwksUrl = process.env.AUTH0_JWKS_URI || `${issuer}.well-known/jwks.json`;
  let parsedJwksUrl;
  try {
    parsedJwksUrl = new URL(jwksUrl);
  } catch {
    throw new Error(authConfigurationError);
  }
  const localTestJwks = process.env.NODE_ENV === "test" &&
    (parsedJwksUrl.hostname === "127.0.0.1" || parsedJwksUrl.hostname === "localhost");
  if (parsedJwksUrl.protocol !== "https:" && !localTestJwks) {
    throw new Error(authConfigurationError);
  }
  const config = `${issuer}|${audience}|${jwksUrl}`;
  if (config !== verifierConfig) {
    verifier = createRemoteJWKSet(parsedJwksUrl);
    verifierConfig = config;
  }
  return { issuer, audience, jwks: verifier };
}

function appRoles(user) {
  return [
    user.teacher && "teacher",
    user.student && "student",
    user.administrator && "administrator",
  ].filter(Boolean);
}

async function findOrLinkUser(subject, email) {
  const existing = await pool.query(
    `SELECT userID, username, email, student, teacher, administrator,
            auth0InvitePending
     FROM users WHERE auth0Sub = $1`,
    [subject],
  );
  if (existing.rows[0]) return existing.rows[0];

  const linked = await pool.query(
    `UPDATE users SET auth0Sub = $1
     WHERE LOWER(email) = LOWER($2) AND auth0Sub IS NULL
     RETURNING userID, username, email, student, teacher, administrator,
               auth0InvitePending`,
    [subject, email],
  );
  if (linked.rows[0]) return linked.rows[0];

  const raced = await pool.query(
    `SELECT userID, username, email, student, teacher, administrator,
            auth0InvitePending
     FROM users WHERE auth0Sub = $1`,
    [subject],
  );
  return raced.rows[0] ?? null;
}

export default async function requireUser(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  if (isLocalTestLoginEnabled(req)) {
    try {
      const userId = await verifyLocalTestToken(match[1]);
      if (userId) {
        const result = await pool.query(
          `SELECT userID, username, email, student, teacher, administrator
           FROM users WHERE userID = $1`,
          [userId],
        );
        const user = result.rows[0];
        if (user) {
          const roles = appRoles(user);
          if (roles.length > 0) {
            req.user = {
              id: user.userid,
              username: user.username,
              email: user.email,
              roles,
              isStudent: user.student,
              isTeacher: user.teacher,
              isAdmin: user.administrator,
            };
            return next();
          }
        }
        return res.status(401).json({ error: "The local test account is no longer available." });
      }
    } catch (error) {
      return next(error);
    }
  }

  let claims;
  try {
    const { issuer, audience, jwks } = getVerifier();
    ({ payload: claims } = await jwtVerify(match[1], jwks, { issuer, audience }));
  } catch (error) {
    if (error instanceof Error && error.message === authConfigurationError) {
      return res.status(503).json({ error: "API authentication is not configured." });
    }
    if (error instanceof errors.JOSEError && ["ERR_JWKS_FETCH", "ERR_JWKS_TIMEOUT"].includes(error.code)) {
      console.error("Auth0 signing keys are unavailable:", error);
      return res.status(503).json({ error: "Authentication is temporarily unavailable. Please try again." });
    }
    console.warn(
      "Auth0 access-token verification failed:",
      error instanceof errors.JOSEError ? error.code : "unexpected verification error",
    );
    return res.status(401).json({ error: "Your sign-in is invalid or expired. Please sign in again." });
  }

  const email = claims["https://stewardtree.app/claims/email"] ?? claims.email;
  const emailVerified = claims["https://stewardtree.app/claims/email_verified"] ?? claims.email_verified;
  if (typeof claims.sub !== "string" || !claims.sub ||
      typeof email !== "string") {
    return res.status(403).json({ error: "Your Auth0 account must include an email address." });
  }

  try {
    if (emailVerified !== true) {
      const invited = await pool.query(
        `SELECT userID, username, email, student, teacher, administrator,
                auth0InvitePending
         FROM users
         WHERE auth0Sub = $1 AND LOWER(email) = LOWER($2)
           AND auth0InvitePending = TRUE`,
        [claims.sub, email],
      );
      if (!invited.rows[0]) {
        return res.status(403).json({ error: "Use a verified email address to access this account." });
      }
    }

    const user = await findOrLinkUser(claims.sub, email);
    if (!user) {
      return res.status(403).json({ error: "No LMS account is assigned to this verified email address." });
    }
    if (user.auth0invitepending && emailVerified === true) {
      await pool.query(
        "UPDATE users SET auth0InvitePending = FALSE WHERE userID = $1",
        [user.userid],
      );
    }

    const roles = appRoles(user);
    if (roles.length === 0) {
      return res.status(403).json({ error: "This LMS account has no assigned role." });
    }

    req.user = {
      id: user.userid,
      username: user.username,
      email: user.email,
      roles,
      isStudent: user.student,
      isTeacher: user.teacher,
      isAdmin: user.administrator,
    };
    next();
  } catch (error) {
    next(error);
  }
}
