import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "../netlify/functions/api.js";

test("Netlify API function forwards same-origin requests to the Express routes", async () => {
  const response = await handler({
    httpMethod: "GET",
    path: "/api/gradebook",
    headers: { host: "example.netlify.app" },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
  }, {});

  // This protected route must be reached; without a bearer token it rejects
  // the request before it needs a database connection.
  assert.equal(response.statusCode, 401);
  assert.match(response.body, /sign in/i);
});
