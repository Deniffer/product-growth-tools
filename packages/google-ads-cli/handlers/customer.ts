/**
 * @input CLI services plus Google Ads accessible customer inventory
 * @output raw accessible-customer dataset
 * @pos customer dataset handler for Google Ads CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";

function parseCustomerId(resourceName: string) {
  const parts = resourceName.split("/");
  return parts.at(-1) ?? resourceName;
}

function renderAccounts(data: { count: number }) {
  return [`Accounts: ${data.count}`];
}

export async function handleCustomerAccountsDataset(args: {
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const resourceNames = await services
      .getGoogleAdsClient()
      .listAccessibleCustomers();
    const accounts = resourceNames.map((resourceName) => ({
      customerId: parseCustomerId(resourceName),
      resourceName,
    }));

    services.output.success(
      {
        count: accounts.length,
        accounts,
      },
      renderAccounts
    );
  });
}
