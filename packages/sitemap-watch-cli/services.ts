/**
 * @input runtime context, provider factory, and output service
 * @output lazy service container for sitemap-watch handlers
 * @pos runtime composition layer for provider and serializer boundaries
 */

import type { CliContext } from "./context";
import { createOutputService, type OutputService } from "./output";
import { createSitemapClient, type SitemapClient } from "./provider";

export type CliServices = {
  context: CliContext;
  output: OutputService;
  getSitemapClient: () => SitemapClient;
};

export function createCliServices(context: CliContext): CliServices {
  let sitemapClient: SitemapClient | null = null;

  return {
    context,
    output: createOutputService(context),
    getSitemapClient() {
      sitemapClient ??= createSitemapClient();
      return sitemapClient;
    },
  };
}
