// Signed-in users (Auth0 or local test sign-in) carry a function that returns
// a current access token for the API.
export async function requestHeaders(user) {
  if (!user?.getAccessTokenSilently) return {};
  return { Authorization: `Bearer ${await user.getAccessTokenSilently()}` };
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
  if (!user?.getAccessTokenSilently) throw new Error("Sign in to continue.");
  let headers;
  try {
    headers = await requestHeaders(user);
  } catch {
    throw responseError(401);
  }
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { ...headers, "Content-Type": "application/json" },
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
