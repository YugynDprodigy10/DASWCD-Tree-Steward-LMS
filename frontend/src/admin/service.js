export async function adminRequest(user, path, method = "GET", body) {
  if (!user?.getAccessTokenSilently) {
    throw new Error("Sign in as an administrator to manage accounts.");
  }
  const token = await user.getAccessTokenSilently();
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Cannot reach the account service. Check the backend connection.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error || "The account service is unavailable.");
  }
  return result;
}
