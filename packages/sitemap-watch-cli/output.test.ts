/**
 * @input output service and synthetic CLI errors
 * @output regression coverage for JSON and pretty error rendering
 * @pos output contract tests for sitemap-watch CLI
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cliError } from "./lib/errors";
import { createOutputService } from "./output";

describe("sitemap-watch output error contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("json mode emits error code and hint", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const output = createOutputService({ pretty: false });

    output.error(
      cliError({
        code: "invalid_input",
        message: "Registry file not found.",
        hint: "Pass --registry-file <path>.",
      })
    );

    expect(stderr).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "invalid_input",
            message: "Registry file not found.",
            hint: "Pass --registry-file <path>.",
          },
        },
        null,
        2
      )}\n`
    );
  });

  test("pretty mode renders code before message", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const output = createOutputService({ pretty: true });

    output.error(
      cliError({
        code: "network_error",
        message: "Failed to fetch sitemap.",
      })
    );

    expect(stderr).toHaveBeenCalledWith(
      "Error Code: network_error\nError: Failed to fetch sitemap.\n"
    );
  });
});
