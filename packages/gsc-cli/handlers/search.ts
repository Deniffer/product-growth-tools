/**
 * @input CLI services plus search analytics report input
 * @output raw Search Console analytics dataset
 * @pos search dataset handler for GSC CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import {
  type AnalyticsInput,
  buildAnalyticsRequest,
} from "../lib/search-analytics";

function renderAnalytics(data: {
  siteUrl: string;
  request: AnalyticsInput;
  rows: unknown[];
}) {
  return [
    `Property: ${data.siteUrl}`,
    `Rows: ${data.rows.length}`,
    `Range: ${data.request.startDate}..${data.request.endDate}`,
  ];
}

export async function handleSearchAnalyticsDataset(args: {
  input: AnalyticsInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const query = buildAnalyticsRequest({
      ...args.input,
      siteUrl: args.input.siteUrl ?? services.context.siteUrl,
    });
    const response = await services.getGscClient().querySearchAnalytics(query);
    const rows = response.rows ?? [];

    services.output.success(
      {
        siteUrl: query.siteUrl,
        request: {
          ...args.input,
          siteUrl: query.siteUrl,
          dimensions: query.dimensions.join(","),
        },
        dimensions: query.dimensions,
        responseAggregationType: response.responseAggregationType ?? null,
        rowCount: rows.length,
        rows,
      },
      renderAnalytics
    );
  });
}
