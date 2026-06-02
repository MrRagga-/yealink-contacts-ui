import { describe, expect, test } from "vitest";

import { formatSourceErrorMessage } from "../features/sources/formatSourceErrorMessage";

describe("formatSourceErrorMessage", () => {
  test("summarizes Google scope errors", () => {
    const message =
      '<HttpError 403 when requesting https://people.googleapis.com/v1/people/me/connections returned "Request had insufficient authentication scopes." Details: "[{\'reason\': \'ACCESS_TOKEN_SCOPE_INSUFFICIENT\'}]">';

    expect(formatSourceErrorMessage(message)).toContain("contacts read access is missing");
  });

  test("summarizes long HttpError messages", () => {
    const message =
      '<HttpError 403 when requesting https://people.googleapis.com/v1/people/me/connections?pageSize=500 returned "Forbidden".';

    expect(formatSourceErrorMessage(message)).toBe(
      "Request failed (403) for /v1/people/me/connections?pageSize=500.",
    );
  });

  test("truncates other long messages", () => {
    const message = "x".repeat(300);

    expect(formatSourceErrorMessage(message)).toHaveLength(240);
    expect(formatSourceErrorMessage(message).endsWith("...")).toBe(true);
  });
});
