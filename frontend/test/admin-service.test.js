import test from "node:test";
import assert from "node:assert/strict";
import { adminRequest } from "../src/admin/service.js";

test("admin requests show server-side invitation errors", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({ error: "An LMS account already uses this email address." }),
  });

  try {
    await assert.rejects(
      adminRequest(
        { getAccessTokenSilently: async () => "token" },
        "/admin/invitations",
        "POST",
        { email: "existing@example.com" },
      ),
      /An LMS account already uses this email address/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("admin requests explain when Auth0 token retrieval fails", async () => {
  await assert.rejects(
    adminRequest(
      {
        getAccessTokenSilently: async () => {
          throw new Error("Login required");
        },
      },
      "/admin/invitations",
      "POST",
      { email: "person@example.com" },
    ),
    /Could not get an Auth0 access token.*Login required/,
  );
});
