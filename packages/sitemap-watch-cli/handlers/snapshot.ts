/**
 * @input CLI services plus snapshot dataset and entity inputs
 * @output normalized current sitemap snapshot datasets and single-page reads
 * @pos snapshot read handlers for sitemap-watch CLI
 */

import type { CliContext } from "../context";
import { runCliCommand } from "../lib/command-support";
import {
  validateAbsoluteUrl,
  validateOptionalCapturedAt,
  validateRegistryFile,
} from "../lib/input-validation";

type SnapshotDatasetInput = {
  registryFile: string;
  competitor?: string;
  capturedAt?: string;
};

type SnapshotEntityInput = {
  registryFile: string;
  competitor: string;
  url: string;
  capturedAt?: string;
};

function renderPages(data: {
  capturedAt: string;
  count: number;
  pages: Array<{
    competitorId: string;
    pageType: string;
    topicCluster: string;
    url: string;
  }>;
}) {
  const lines = [`Captured At: ${data.capturedAt}`, `Pages: ${data.count}`];

  for (const page of data.pages) {
    lines.push(
      `${page.competitorId} | ${page.pageType} | ${page.topicCluster} | ${page.url}`
    );
  }

  return lines;
}

function renderPage(data: {
  capturedAt: string;
  page: {
    competitorId: string;
    pageType: string;
    topicCluster: string;
    url: string;
  };
}) {
  return [
    `Captured At: ${data.capturedAt}`,
    `Competitor: ${data.page.competitorId}`,
    `Page Type: ${data.page.pageType}`,
    `Topic Cluster: ${data.page.topicCluster}`,
    `URL: ${data.page.url}`,
  ];
}

export async function handleSnapshotDatasetPages(args: {
  input: SnapshotDatasetInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const registryFile = validateRegistryFile(args.input.registryFile);
    const capturedAt = validateOptionalCapturedAt(args.input.capturedAt);
    const data = await services.getSitemapClient().getPages({
      registryFile,
      competitor: args.input.competitor,
      capturedAt,
    });

    services.output.success(data, renderPages);
  });
}

export async function handleSnapshotEntityPage(args: {
  input: SnapshotEntityInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const registryFile = validateRegistryFile(args.input.registryFile);
    const capturedAt = validateOptionalCapturedAt(args.input.capturedAt);
    const url = validateAbsoluteUrl(args.input.url, "url");
    const data = await services.getSitemapClient().getPage({
      registryFile,
      competitor: args.input.competitor,
      url,
      capturedAt,
    });

    services.output.success(data, renderPage);
  });
}
