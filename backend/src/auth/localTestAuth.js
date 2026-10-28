import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const issuer = "http://localhost:3000/api/auth/test-login";
const audience = "steward-tree-local-test";
const signingKey = randomBytes(32);

export function isLocalTestLoginEnabled(req) {
  const address = req.socket.remoteAddress?.replace(/^::ffff:/, "");
  const isLoopback = address === "127.0.0.1" || address === "::1";
  return process.env.ENABLE_TEST_LOGIN === "true" &&
    process.env.NODE_ENV !== "production" &&
    isLoopback;
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
