/**
 * @input CLI services plus registry dataset input
 * @output active competitor registry datasets for agent consumers
 * @pos registry read handlers for sitemap-watch CLI
 */

import type { CliContext } from "../context";
import { runCliCommand } from "../lib/command-support";
import { validateRegistryFile } from "../lib/input-validation";

type RegistryDatasetInput = {
  registryFile: string;
  competitor?: string;
};

function renderCompetitors(data: {
  count: number;
  competitors: Array<{
    competitorId: string;
    domain: string;
    sitemapUrls: string[];
  }>;
}) {
  const lines = [`Competitors: ${data.count}`];

  for (const competitor of data.competitors) {
    lines.push(
      `${competitor.competitorId} | ${competitor.domain} | sitemaps=${competitor.sitemapUrls.length}`
    );
  }

  return lines;
}

export async function handleRegistryDatasetCompetitors(args: {
  input: RegistryDatasetInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const registryFile = validateRegistryFile(args.input.registryFile);
    const data = await services.getSitemapClient().listCompetitors({
      registryFile,
      competitor: args.input.competitor,
    });

    services.output.success(data, renderCompetitors);
  });
}
