/**
 * @input CLI services plus campaign performance report input
 * @output raw campaign performance dataset
 * @pos campaign dataset handler for Google Ads CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import {
  validateCustomerId,
  validateDateRange,
  validateLimit,
} from "../lib/input-validation";
import {
  buildCampaignPerformanceQuery,
  type ReportingWindow,
} from "../lib/reporting";

export type CampaignPerformanceInput = {
  customerId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
};

type NormalizedCampaignPerformanceInput = ReportingWindow & {
  customerId: string;
};

function normalizeInput(
  input: CampaignPerformanceInput,
  context: CliContext
): NormalizedCampaignPerformanceInput {
  const customerId = validateCustomerId(input.customerId ?? context.customerId);
  const { startDate, endDate } = validateDateRange(
    input.startDate,
    input.endDate
  );

  return {
    customerId,
    startDate,
    endDate,
    limit: validateLimit(input.limit) ?? 100,
  };
}

function renderCampaignPerformance(data: {
  customerId: string;
  rowCount: number;
  request: { startDate: string; endDate: string };
}) {
  return [
    `Customer: ${data.customerId}`,
    `Rows: ${data.rowCount}`,
    `Range: ${data.request.startDate}..${data.request.endDate}`,
  ];
}

export async function handleCampaignPerformanceDataset(args: {
  input: CampaignPerformanceInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const input = normalizeInput(args.input, services.context);
    const query = buildCampaignPerformanceQuery(input);
    const rows = await services.getGoogleAdsClient().runGaql({
      customerId: input.customerId,
      loginCustomerId: services.context.loginCustomerId,
      linkedCustomerId: services.context.linkedCustomerId,
      query,
    });

    services.output.success(
      {
        customerId: input.customerId,
        request: input,
        query,
        rowCount: rows.length,
        rows,
      },
      renderCampaignPerformance
    );
  });
}
