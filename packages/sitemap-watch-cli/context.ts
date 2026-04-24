/**
 * @input CLI global flags
 * @output typed runtime context for output-mode decisions
 * @pos lightweight runtime context boundary for sitemap-watch CLI
 */

export type CliContext = {
  pretty?: boolean;
};

export function createCliContext(input: { pretty?: boolean }): CliContext {
  return {
    pretty: input.pretty ?? false,
  };
}
