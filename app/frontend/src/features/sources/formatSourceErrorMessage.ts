export function formatSourceErrorMessage(message: string): string {
  if (message.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
    return (
      "Google connection failed: contacts read access is missing from the stored token. " +
      "Revoke this app under your Google account security settings, then run Google OAuth again."
    );
  }

  const httpErrorMatch = message.match(/^<HttpError (\d+) when requesting ([^ ]+)/);
  if (httpErrorMatch) {
    const [, status, url] = httpErrorMatch;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    return `Request failed (${status}) for ${path}.`;
  }

  if (message.length > 240) {
    return `${message.slice(0, 237)}...`;
  }

  return message;
}
