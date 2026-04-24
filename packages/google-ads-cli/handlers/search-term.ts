/**
 * @input CLI services plus search term performance report input
 * @output raw search term performance dataset
 * @pos search-term dataset handler for Google Ads CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import {
  validateCustomerId,
  validateDateRange,
  validateLimit,
} from "../lib/input-validation";
import {
  buildSearchTermPerformanceQuery,
  type ReportingWindow,
} from "../lib/reporting";

export type SearchTermPerformanceInput = {
  customerId?: string;
  startDate: string;
  endDate: string;
  limit?: number;
};

type NormalizedSearchTermPerformanceInput = ReportingWindow & {
  customerId: string;
};

function normalizeInput(
  input: SearchTermPerformanceInput,
  context: CliContext
): NormalizedSearchTermPerformanceInput {
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

function renderPerformance(data: {
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

export async function handleSearchTermPerformanceDataset(args: {
  input: SearchTermPerformanceInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const input = normalizeInput(args.input, services.context);
    const query = buildSearchTermPerformanceQuery(input);
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
      renderPerformance
    );
  });
}
