/**
 * @input CLI services plus property dataset input
 * @output accessible Search Console property inventory
 * @pos property read handlers for GSC CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import { validateOptionalPermissionLevel } from "../lib/input-validation";

type PropertyListInput = {
  permissionLevel?: string;
};

function renderSites(data: {
  count: number;
  sites: Array<{ siteUrl: string; permissionLevel?: string | null }>;
}) {
  const lines = [`Properties: ${data.count}`];

  for (const site of data.sites) {
    lines.push(
      `${site.siteUrl}${site.permissionLevel ? ` (${site.permissionLevel})` : ""}`
    );
  }

  return lines;
}

export async function handlePropertySitesDataset(args: {
  input: PropertyListInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const permissionLevel = validateOptionalPermissionLevel(
      args.input.permissionLevel
    );
    const response = await services.getGscClient().listSites();
    const sites = (response.siteEntry ?? [])
      .map((entry) => ({
        siteUrl: entry.siteUrl ?? "",
        permissionLevel: entry.permissionLevel ?? null,
      }))
      .filter((entry) =>
        permissionLevel ? entry.permissionLevel === permissionLevel : true
      );

    services.output.success({ count: sites.length, sites }, renderSites);
  });
}
