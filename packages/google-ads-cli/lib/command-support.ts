/**
 * @input CLI context, service factory, and async handler body
 * @output shared command wrapper for stable CLI error serialization
 * @pos command-support layer for Google Ads handlers
 */

import type { CliContext } from "../client";
import type { CliServices } from "../services";
import { createCliServices } from "../services";

export async function runCliCommand(
  context: CliContext,
  runner: (services: CliServices) => Promise<void>
) {
  const services = createCliServices(context);

  try {
    await runner(services);
  } catch (error) {
    services.output.error(error);
    process.exitCode = 1;
  }
}
