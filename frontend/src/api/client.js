export function requestHeaders(user) {
  // Existing backend prototype contract. This header is not authentication.
  return user?.id ? { "X-User-Id": String(user.id) } : {};
}

export function responseError(status, message) {
  if (status === 401) {
    window.dispatchEvent(new Event("session-expired"));
    return new Error(
      "Please sign in again. Your quiz draft is saved in this tab.",
    );
  }
  return new Error(message || "Service unavailable. Please try again.");
}

export async function apiRequest(user, path, method = "GET", body) {
  if (!user?.id) throw new Error("Sign in to continue.");
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { ...requestHeaders(user), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Cannot reach the service. Check your connection and try again.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw responseError(response.status, result?.error);
  return result;
}
