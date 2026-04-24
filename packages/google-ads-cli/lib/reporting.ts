/**
 * @input normalized reporting ranges and row limits
 * @output stable GAQL builders for first-class reporting datasets
 * @pos shared reporting query layer for Google Ads CLI
 */

export type ReportingWindow = {
  startDate: string;
  endDate: string;
  limit: number;
};

function buildWindowClause(input: ReportingWindow) {
  return `segments.date BETWEEN '${input.startDate}' AND '${input.endDate}'`;
}

export function buildCampaignPerformanceQuery(input: ReportingWindow) {
  return `
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.advertising_channel_sub_type,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE
  ${buildWindowClause(input)}
  AND campaign.status != 'REMOVED'
ORDER BY metrics.cost_micros DESC
LIMIT ${input.limit}`.trim();
}

export function buildAdGroupPerformanceQuery(input: ReportingWindow) {
  return `
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group.status,
  ad_group.type,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM ad_group
WHERE
  ${buildWindowClause(input)}
  AND ad_group.status != 'REMOVED'
ORDER BY metrics.cost_micros DESC
LIMIT ${input.limit}`.trim();
}

export function buildSearchTermPerformanceQuery(input: ReportingWindow) {
  return `
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  search_term_view.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM search_term_view
WHERE
  ${buildWindowClause(input)}
ORDER BY metrics.cost_micros DESC
LIMIT ${input.limit}`.trim();
}

export function buildKeywordPerformanceQuery(input: ReportingWindow) {
  return `
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.status,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM keyword_view
WHERE
  ${buildWindowClause(input)}
  AND ad_group_criterion.status != 'REMOVED'
ORDER BY metrics.cost_micros DESC
LIMIT ${input.limit}`.trim();
}
