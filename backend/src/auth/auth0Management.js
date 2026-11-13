import { randomBytes } from "node:crypto";

let cachedToken;
let tokenExpiresAt = 0;
let tokenConfig;

export class Auth0ServiceError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "Auth0ServiceError";
    this.status = status;
  }
}

function tenantHost() {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) throw new Auth0ServiceError("Auth0 domain is not configured.");
  return domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function localTestEndpoint(name, fallback) {
  const configured = process.env[name];
  if (!configured) return fallback;
  if (process.env.NODE_ENV !== "test") {
    throw new Auth0ServiceError(`${name} can only be set in tests.`);
  }
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Auth0ServiceError(`${name} must be a valid URL.`);
  }
  if (url.protocol !== "http:" ||
      !["127.0.0.1", "::1", "localhost"].includes(url.hostname)) {
    throw new Auth0ServiceError(`${name} must point to a local test server.`);
  }
  return url.toString().replace(/\/$/, "");
}

function auth0Endpoints() {
  const host = tenantHost();
  return {
    managementBase: localTestEndpoint(
      "AUTH0_MANAGEMENT_API_URL",
      `https://${host}/api/v2`,
    ),
    tokenUrl: localTestEndpoint(
      "AUTH0_MANAGEMENT_TOKEN_URL",
      `https://${host}/oauth/token`,
    ),
    passwordChangeUrl: localTestEndpoint(
      "AUTH0_PASSWORD_CHANGE_URL",
      `https://${host}/dbconnections/change_password`,
    ),
  };
}

async function responseJson(response, context) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    let message = `Auth0 ${context} failed (HTTP ${response.status}).`;
    if (response.status === 409) {
      message = "An Auth0 or database account already uses this email address.";
    } else if (response.status === 429) {
      message = "Auth0 is temporarily rate-limiting requests. Wait a minute and retry.";
    } else if ([401, 403].includes(response.status)) {
      if (context === "Management API token") {
        message = "Auth0 rejected the Management API credentials. Check the M2M client ID, secret, tenant domain, and Management API audience.";
      } else if (context === "Management API") {
        message = "Auth0 denied account creation. Verify the M2M application's Management API authorization includes create:users (and delete:users for rollback).";
      } else {
        message = "Auth0 denied the setup-email request. Check the SPA client ID, database connection, and enabled Change Password email template/provider.";
      }
    } else if ([400, 422].includes(response.status) &&
        context === "password setup email") {
      message = "Auth0 could not send the setup email. Check the SPA client ID, database connection, and enabled Change Password email template.";
    } else if ([400, 422].includes(response.status) &&
        context === "Management API") {
      message = "Auth0 rejected the account details. Check the database connection name and invited user's information.";
    }
    throw new Auth0ServiceError(message, response.status);
  }
  return body;
}

async function getManagementToken() {
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;
  const host = tenantHost();
  const endpoints = auth0Endpoints();
  if (!clientId || !clientSecret) {
    throw new Auth0ServiceError(
      "Configure AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET for account invitations.",
    );
  }

  const config = `${host}|${clientId}|${endpoints.tokenUrl}`;
  if (cachedToken && config === tokenConfig && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  let response;
  try {
    response = await fetch(endpoints.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${host}/api/v2/`,
      }),
    });
  } catch {
    throw new Auth0ServiceError("Could not reach the Auth0 Management API.");
  }
  const body = await responseJson(response, "Management API token");
  if (typeof body?.access_token !== "string" ||
      !Number.isFinite(body.expires_in)) {
    throw new Auth0ServiceError("Auth0 returned an invalid Management API token.");
  }
  cachedToken = body.access_token;
  tokenExpiresAt = Date.now() + body.expires_in * 1000;
  tokenConfig = config;
  return cachedToken;
}

async function managementRequest(path, options = {}) {
  const { managementBase } = auth0Endpoints();
  const accessToken = await getManagementToken();
  let response;
  try {
    response = await fetch(`${managementBase}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Auth0ServiceError("Could not reach the Auth0 Management API.");
  }
  if (response.status === 204) return null;
  return responseJson(response, "Management API");
}

function passwordSetupConfig() {
  const clientId = process.env.AUTH0_SPA_CLIENT_ID?.trim();
  const connection = process.env.AUTH0_DATABASE_CONNECTION?.trim();
  if (!clientId || !connection) {
    throw new Auth0ServiceError(
      "Configure AUTH0_SPA_CLIENT_ID and AUTH0_DATABASE_CONNECTION to send account setup emails.",
    );
  }
  return { clientId, connection };
}

export async function createAuth0User({ email, name }) {
  const { connection } = passwordSetupConfig();
  const password = `${randomBytes(48).toString("base64url")}A1!`;
  const user = await managementRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      connection,
      email,
      password,
      email_verified: true,
      name,
    }),
  });
  if (typeof user?.user_id !== "string" || !user.user_id) {
    throw new Auth0ServiceError("Auth0 created a user without returning its ID.");
  }
  return user.user_id;
}

export async function deleteAuth0User(userId) {
  return managementRequest(`/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function sendPasswordSetupEmail(email) {
  const { clientId, connection } = passwordSetupConfig();
  const { passwordChangeUrl } = auth0Endpoints();
  let response;
  try {
    response = await fetch(passwordChangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, connection, email }),
    });
  } catch {
    throw new Auth0ServiceError("Could not reach Auth0's password setup service.");
  }
  await responseJson(response, "password setup email");
}
