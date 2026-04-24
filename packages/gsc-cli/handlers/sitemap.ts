/**
 * @input CLI context plus sitemap dataset or entity input
 * @output raw Search Console sitemap dataset and entity reads
 * @pos sitemap read handlers for GSC CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import { validateAbsoluteUrl, validateSiteUrl } from "../lib/input-validation";

type SitemapDatasetInput = {
  siteUrl?: string;
  sitemapIndex?: string;
};

type SitemapEntityInput = {
  siteUrl?: string;
  feedpath: string;
};

function renderSitemaps(data: {
  siteUrl: string;
  count: number;
  sitemaps: Array<{
    path?: string | null;
    type?: string | null;
    isPending?: boolean | null;
  }>;
}) {
  const lines = [`Property: ${data.siteUrl}`, `Sitemaps: ${data.count}`];

  for (const sitemap of data.sitemaps) {
    lines.push(
      [
        sitemap.path ?? "unknown",
        sitemap.type ?? "unknown",
        sitemap.isPending === true ? "pending=yes" : "pending=no",
      ].join(" | ")
    );
  }

  return lines;
}

function renderSitemap(data: {
  siteUrl: string;
  feedpath: string;
  sitemap: {
    type?: string | null;
    lastSubmitted?: string | null;
    lastDownloaded?: string | null;
    isPending?: boolean | null;
  };
}) {
  return [
    `Property: ${data.siteUrl}`,
    `Feed: ${data.feedpath}`,
    `Type: ${data.sitemap.type ?? "unknown"}`,
    `Pending: ${data.sitemap.isPending === true ? "yes" : "no"}`,
  ];
}

export async function handleSitemapDatasetSitemaps(args: {
  input: SitemapDatasetInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const siteUrl = validateSiteUrl(
      args.input.siteUrl ?? services.context.siteUrl
    );
    const sitemapIndex = args.input.sitemapIndex
      ? validateAbsoluteUrl(args.input.sitemapIndex, "sitemapIndex")
      : undefined;
    const response = await services.getGscClient().listSitemaps({
      siteUrl,
      sitemapIndex,
    });
    const sitemaps = response.sitemap ?? [];

    services.output.success(
      {
        siteUrl,
        sitemapIndex: sitemapIndex ?? null,
        count: sitemaps.length,
        sitemaps,
      },
      renderSitemaps
    );
  });
}

export async function handleSitemapEntitySitemap(args: {
  input: SitemapEntityInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const siteUrl = validateSiteUrl(
      args.input.siteUrl ?? services.context.siteUrl
    );
    const feedpath = validateAbsoluteUrl(args.input.feedpath, "feedpath");
    const sitemap = await services.getGscClient().getSitemap({
      siteUrl,
      feedpath,
    });

    services.output.success(
      {
        siteUrl,
        feedpath,
        sitemap,
      },
      renderSitemap
    );
  });
}
