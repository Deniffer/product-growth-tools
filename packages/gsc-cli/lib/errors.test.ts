/**
 * @input synthetic provider errors
 * @output coverage for provider error classification
 * @pos error contract tests for GSC CLI
 */

import { describe, expect, test } from "vitest";
import { normalizeCliError } from "./errors";

function createProviderError(message: string, status: number, reason?: string) {
  const error = new Error(message) as Error & {
    status: number;
    response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } };
  };
  error.status = status;
  if (reason) {
    error.response = {
      data: {
        error: {
          errors: [{ reason }],
        },
      },
    };
  }
  return error;
}

describe("provider error normalization", () => {
  test("maps auth failures to provider_auth", () => {
    const resolved = normalizeCliError(
      createProviderError("forbidden", 403, "insufficientPermissions")
    );

    expect(resolved.code).toBe("provider_auth");
  });

  test("maps quota failures to provider_rate_limited", () => {
    const resolved = normalizeCliError(
      createProviderError("quota", 429, "quotaExceeded")
    );

    expect(resolved.code).toBe("provider_rate_limited");
  });

  test("maps provider bad requests to invalid_input", () => {
    const resolved = normalizeCliError(createProviderError("bad request", 400));

    expect(resolved.code).toBe("invalid_input");
  });
});
