/**
 * @input CLI context resolver plus temporary environment values
 * @output coverage for auth and customer fallback resolution
 * @pos client resolution tests for Google Ads CLI
 */

import { afterEach, describe, expect, test } from "vitest";
import { createCliContext } from "./client";

describe("google-ads client resolution", () => {
  afterEach(() => {
    process.env.GOOGLE_ADS_JSON_KEY_FILE_PATH = undefined;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = undefined;
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON = undefined;
    process.env.GOOGLE_ADS_CUSTOMER_ID = undefined;
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = undefined;
    process.env.GOOGLE_ADS_LINKED_CUSTOMER_ID = undefined;
    process.env.INIT_CWD = undefined;
  });

  test("prefers explicit credentials file over env default", () => {
    process.env.GOOGLE_ADS_JSON_KEY_FILE_PATH = "/tmp/env-google-ads.json";

    expect(
      createCliContext({ credentialsFile: "/tmp/flag-google-ads.json" })
        .credentialsFile
    ).toBe("/tmp/flag-google-ads.json");
  });

  test("prefers explicit customer id over env default", () => {
    process.env.GOOGLE_ADS_CUSTOMER_ID = "1111111111";

    expect(createCliContext({ customerId: "2222222222" }).customerId).toBe(
      "2222222222"
    );
  });

  test("falls back to login customer env", () => {
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "3333333333";

    expect(createCliContext({}).loginCustomerId).toBe("3333333333");
  });

  test("reads linked customer env", () => {
    process.env.GOOGLE_ADS_LINKED_CUSTOMER_ID = "4444444444";

    expect(createCliContext({}).linkedCustomerId).toBe("4444444444");
  });

  test("reads inline service account json from env", () => {
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';

    expect(createCliContext({}).credentialsJson).toBe(
      '{"type":"service_account"}'
    );
  });

  test("resolves relative credentials path from invocation root", () => {
    process.env.INIT_CWD = "/repo";

    expect(
      createCliContext({
        credentialsFile: "packages/google-ads-cli/credentials/test.json",
      }).credentialsFile
    ).toBe("/repo/packages/google-ads-cli/credentials/test.json");
  });
});
