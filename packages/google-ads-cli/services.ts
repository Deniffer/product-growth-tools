/**
 * @input resolved CLI context, Google Ads client factory, and output service
 * @output lazy CLI service container for handlers
 * @pos Google Ads runtime services boundary
 */

import {
  type CliContext,
  createGoogleAdsClient,
  type GoogleAdsClient,
} from "./client";
import { createOutputService, type OutputService } from "./output";

export type CliServices = {
  context: CliContext;
  output: OutputService;
  getGoogleAdsClient: () => GoogleAdsClient;
};

export function createCliServices(context: CliContext): CliServices {
  let googleAdsClient: GoogleAdsClient | null = null;

  return {
    context,
    output: createOutputService(context),
    getGoogleAdsClient() {
      googleAdsClient ??= createGoogleAdsClient(context);
      return googleAdsClient;
    },
  };
}
