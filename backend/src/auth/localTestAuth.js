import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const issuer = "http://localhost:3000/api/auth/test-login";
const audience = "steward-tree-local-test";
const signingKey = randomBytes(32);

// Test sign-in is for local development and automated tests only. It must be
// switched on explicitly AND the server must say it is in development or test
// mode, so a deployment that forgets to set NODE_ENV can never enable it.
// (A same-machine check doesn't work inside Docker, where requests arrive from
// other containers, and doesn't protect deployments behind a reverse proxy.)
export function isLocalTestLoginEnabled() {
  return process.env.ENABLE_TEST_LOGIN === "true" &&
    ["development", "test"].includes(process.env.NODE_ENV);
}

export function createLocalTestToken(userId) {
  return new SignJWT({ lms_user_id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(`local-test|${userId}`)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(signingKey);
}

export async function verifyLocalTestToken(token) {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    const userId = Number(payload.lms_user_id);
    if (!Number.isInteger(userId) || userId <= 0 ||
        payload.sub !== `local-test|${userId}`) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}