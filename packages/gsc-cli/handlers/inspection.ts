/**
 * @input CLI context plus URL inspection input
 * @output raw Search Console URL inspection read
 * @pos inspection entity handler for GSC CLI
 */

import type { CliContext } from "../client";
import { runCliCommand } from "../lib/command-support";
import {
  validateAbsoluteUrl,
  validateOptionalLanguageCode,
  validateSiteUrl,
} from "../lib/input-validation";

type InspectionEntityInput = {
  siteUrl?: string;
  inspectionUrl: string;
  languageCode?: string;
};

function renderInspection(data: {
  siteUrl: string;
  inspectionUrl: string;
  inspectionResult: {
    indexStatusResult?: {
      coverageState?: string | null;
      verdict?: string | null;
    } | null;
  } | null;
}) {
  return [
    `Property: ${data.siteUrl}`,
    `URL: ${data.inspectionUrl}`,
    `Coverage: ${data.inspectionResult?.indexStatusResult?.coverageState ?? "unknown"}`,
    `Verdict: ${data.inspectionResult?.indexStatusResult?.verdict ?? "unknown"}`,
  ];
}

export async function handleInspectionEntityUrl(args: {
  input: InspectionEntityInput;
  context: CliContext;
}) {
  await runCliCommand(args.context, async (services) => {
    const siteUrl = validateSiteUrl(
      args.input.siteUrl ?? services.context.siteUrl
    );
    const inspectionUrl = validateAbsoluteUrl(
      args.input.inspectionUrl,
      "inspectionUrl"
    );
    const languageCode = validateOptionalLanguageCode(args.input.languageCode);
    const response = await services.getGscClient().inspectUrl({
      inspectionUrl,
      siteUrl,
      languageCode,
    });

    services.output.success(
      {
        siteUrl,
        inspectionUrl,
        languageCode: languageCode ?? null,
        inspectionResult: response.inspectionResult ?? null,
      },
      renderInspection
    );
  });
}
