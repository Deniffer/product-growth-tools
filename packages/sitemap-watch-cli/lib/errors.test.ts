/**
 * @input synthetic provider and network errors
 * @output coverage for runtime error classification
 * @pos error contract tests for sitemap-watch CLI
 */

import { describe, expect, test } from "vitest";
import { normalizeCliError } from "./errors";

describe("sitemap-watch error normalization", () => {
  test("maps TypeError to network_error", () => {
    const resolved = normalizeCliError(new TypeError("fetch failed"));

    expect(resolved.code).toBe("network_error");
  });

  test("maps errors with status to network_error", () => {
    const error = new Error("status 502") as Error & { status: number };
    error.status = 502;

    const resolved = normalizeCliError(error);

    expect(resolved.code).toBe("network_error");
  });
});
