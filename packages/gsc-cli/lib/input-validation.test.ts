/**
 * @input raw provider-like input values
 * @output coverage for shared input validation helpers
 * @pos validation contract tests for GSC CLI
 */

import { describe, expect, test } from "vitest";
import {
  validateAbsoluteUrl,
  validateOptionalLanguageCode,
  validateOptionalPermissionLevel,
  validateSiteUrl,
} from "./input-validation";
import { buildAnalyticsRequest } from "./search-analytics";

describe("input validation", () => {
  test("accepts valid search analytics input", () => {
    const request = buildAnalyticsRequest({
      siteUrl: "sc-domain:example.com",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      dimensions: "query,page",
      rowLimit: 100,
      startRow: 0,
    });

    expect(request.siteUrl).toBe("sc-domain:example.com");
    expect(request.requestBody.rowLimit).toBe(100);
  });

  test("rejects invalid date ranges", () => {
    expect(() =>
      buildAnalyticsRequest({
        siteUrl: "sc-domain:example.com",
        startDate: "2026-04-10",
        endDate: "2026-04-01",
      })
    ).toThrow("startDate cannot be after endDate");
  });

  test("rejects impossible calendar dates", () => {
    expect(() =>
      buildAnalyticsRequest({
        siteUrl: "sc-domain:example.com",
        startDate: "2026-13-01",
        endDate: "2026-04-10",
      })
    ).toThrow("Invalid startDate: 2026-13-01");
  });

  test("rejects invalid dimensions", () => {
    expect(() =>
      buildAnalyticsRequest({
        siteUrl: "sc-domain:example.com",
        startDate: "2026-04-01",
        endDate: "2026-04-10",
        dimensions: "query,foo",
      })
    ).toThrow("Unsupported dimension: foo");
  });

  test("rejects invalid regex operator combinations", () => {
    expect(() =>
      buildAnalyticsRequest({
        siteUrl: "sc-domain:example.com",
        startDate: "2026-04-01",
        endDate: "2026-04-10",
        queryFilter: "regex:seo.*",
      })
    ).toThrow("Regex-prefixed filters require a regex filterOperator.");
  });

  test("validates provider helper inputs", () => {
    expect(validateSiteUrl("https://example.com/")).toBe(
      "https://example.com/"
    );
    expect(
      validateAbsoluteUrl("https://example.com/sitemap.xml", "feedpath")
    ).toBe("https://example.com/sitemap.xml");
    expect(validateOptionalLanguageCode("en-US")).toBe("en-US");
    expect(validateOptionalPermissionLevel("siteOwner")).toBe("siteOwner");
  });
});
