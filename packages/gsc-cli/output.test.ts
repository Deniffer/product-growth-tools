/**
 * @input output service and synthetic CLI errors
 * @output regression coverage for JSON and pretty error rendering
 * @pos output contract tests for GSC CLI
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cliError } from "./lib/errors";
import { createOutputService } from "./output";

describe("gsc cli output error contract", () => {
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
        message: "Missing Search Console property URL.",
        hint: "Pass --site-url <url> or set GSC_SITE_URL.",
      })
    );

    expect(stderr).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "invalid_input",
            message: "Missing Search Console property URL.",
            hint: "Pass --site-url <url> or set GSC_SITE_URL.",
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
        code: "provider_failure",
        message: "Request failed with status code 403",
      })
    );

    expect(stderr).toHaveBeenCalledWith(
      "Error Code: provider_failure\nError: Request failed with status code 403\n"
    );
  });
});
