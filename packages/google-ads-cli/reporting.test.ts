/**
 * @input reporting query builders
 * @output coverage for stable GAQL resource selection
 * @pos reporting-layer regression coverage for Google Ads CLI
 */

import { describe, expect, test } from "vitest";
import {
  buildAdGroupPerformanceQuery,
  buildCampaignPerformanceQuery,
  buildKeywordPerformanceQuery,
  buildSearchTermPerformanceQuery,
} from "./lib/reporting";

const windowInput = {
  startDate: "2026-04-01",
  endDate: "2026-04-11",
  limit: 5,
};

describe("google-ads reporting queries", () => {
  test("builds campaign query against campaign resource", () => {
    expect(buildCampaignPerformanceQuery(windowInput)).toContain(
      "FROM campaign"
    );
  });

  test("builds ad-group query against ad_group resource", () => {
    expect(buildAdGroupPerformanceQuery(windowInput)).toContain(
      "FROM ad_group"
    );
  });

  test("builds search-term query against search_term_view resource", () => {
    expect(buildSearchTermPerformanceQuery(windowInput)).toContain(
      "FROM search_term_view"
    );
  });

  test("builds keyword query against keyword_view resource", () => {
    const query = buildKeywordPerformanceQuery(windowInput);

    expect(query).toContain("FROM keyword_view");
    expect(query).not.toContain("FROM ad_group_criterion");
  });
});
