/**
 * @input resolved CLI context, GSC client factory, and output service
 * @output lazy CLI service container for handlers
 * @pos GSC runtime services boundary
 */

import { type CliContext, createGscClient, type GscClient } from "./client";
import { createOutputService, type OutputService } from "./output";

export type CliServices = {
  context: CliContext;
  output: OutputService;
  getGscClient: () => GscClient;
};

export function createCliServices(context: CliContext): CliServices {
  let gscClient: GscClient | null = null;

  return {
    context,
    output: createOutputService(context),
    getGscClient() {
      gscClient ??= createGscClient(context);
      return gscClient;
    },
  };
}
