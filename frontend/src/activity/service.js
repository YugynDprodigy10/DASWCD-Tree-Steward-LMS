import { requestHeaders, responseError } from "../api/client.js";

export async function recordStudentPageView(user, view, keepalive = false) {
  let headers;
  try {
    headers = await requestHeaders(user);
  } catch {
    throw responseError(401);
  }

  let response;
  try {
    response = await fetch("/api/activity/views", {
      method: "POST",
      credentials: "same-origin",
      keepalive,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(view),
    });
  } catch {
    throw new Error("Cannot reach the activity service.");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw responseError(response.status, result?.error);
  }
  return result;
}
