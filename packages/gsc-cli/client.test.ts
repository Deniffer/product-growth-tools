/**
 * @input CLI context resolver plus temporary environment values
 * @output coverage for auth and site fallback resolution
 * @pos client resolution tests for GSC CLI
 */

import { afterEach, describe, expect, test } from "vitest";
import { createCliContext } from "./client";

describe("gsc client resolution", () => {
  afterEach(() => {
    process.env.GSC_SITE_URL = undefined;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = undefined;
    process.env.GSC_SERVICE_ACCOUNT_JSON = undefined;
  });

  test("prefers explicit site url over env defaults", () => {
    process.env.GSC_SITE_URL = "sc-domain:env.example";

    expect(
      createCliContext({
        siteUrl: "sc-domain:flag.example",
      }).siteUrl
    ).toBe("sc-domain:flag.example");
  });

  test("falls back to google application credentials", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/gsc.json";

    expect(createCliContext({}).credentialsFile).toBe("/tmp/gsc.json");
  });

  test("reads inline service account json from env", () => {
    process.env.GSC_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';

    expect(createCliContext({}).credentialsJson).toBe(
      '{"type":"service_account"}'
    );
  });
});
