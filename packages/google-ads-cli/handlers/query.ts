/**
 * @input CLI services plus raw GAQL input
 * @output raw Google Ads query dataset
 * @pos GAQL passthrough dataset handler for Google Ads CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import { validateCustomerId, validateGaqlQuery } from "../lib/input-validation";

export type GaqlInput = {
  customerId?: string;
  query: string;
};

function normalizeInput(input: GaqlInput, context: CliContext) {
  return {
    customerId: validateCustomerId(input.customerId ?? context.customerId),
    query: validateGaqlQuery(input.query),
  };
}

function renderGaql(data: { customerId: string; rowCount: number }) {
  return [`Customer: ${data.customerId}`, `Rows: ${data.rowCount}`];
}

export async function handleGaqlDataset(args: {
  input: GaqlInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const input = normalizeInput(args.input, services.context);
    const rows = await services.getGoogleAdsClient().runGaql({
      customerId: input.customerId,
      loginCustomerId: services.context.loginCustomerId,
      linkedCustomerId: services.context.linkedCustomerId,
      query: input.query,
    });

    services.output.success(
      {
        customerId: input.customerId,
        query: input.query,
        rowCount: rows.length,
        rows,
      },
      renderGaql
    );
  });
}
