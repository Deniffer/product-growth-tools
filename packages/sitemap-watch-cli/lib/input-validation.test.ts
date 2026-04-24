/**
 * @input registry file paths and URL-like CLI input
 * @output regression coverage for path resolution and scalar validation
 * @pos input validation tests for sitemap-watch CLI
 */

import { describe, expect, test } from "vitest";
import { validateAbsoluteUrl, validateRegistryFile } from "./input-validation";

describe("sitemap-watch input validation", () => {
  test("resolves registry paths against repository root when cwd candidate is missing", () => {
    const resolved = validateRegistryFile(
      "packages/sitemap-watch-cli/examples/registry.example.json"
    );

    expect(resolved).toContain(
      "/packages/sitemap-watch-cli/examples/registry.example.json"
    );
  });

  test("accepts absolute http URLs", () => {
    expect(
      validateAbsoluteUrl("https://myclaw.ai/sitemap.xml", "sitemapUrl")
    ).toBe("https://myclaw.ai/sitemap.xml");
  });
});
