/**
 * Performs a fetch request with the currently stored JWT token.
 *
 * The token is attached automatically as:
 * Authorization: Bearer <token>
 *
 * Existing headers and fetch options are preserved.
 */
export async function authenticatedFetch(
  url,
  options = {}
) {
  const token = String(
    localStorage.getItem("token") || ""
  ).trim();

  const headers = new Headers(
    options.headers || {}
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export default authenticatedFetch;