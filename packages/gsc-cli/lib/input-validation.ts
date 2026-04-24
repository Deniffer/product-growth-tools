/**
 * @input raw CLI strings and scalar provider parameters
 * @output validated and normalized inputs for GSC provider calls
 * @pos shared validation layer for GSC CLI handlers and request builders
 */

import { cliError } from "./errors";

const SEARCH_DIMENSIONS = new Set([
  "country",
  "date",
  "device",
  "page",
  "query",
  "searchAppearance",
]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOMAIN_WHITESPACE_RE = /\s/;
const LANGUAGE_CODE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const COUNTRY_CODE_RE = /^[A-Z]{3}$/;

function requireMatch(value: string, pattern: RegExp) {
  return pattern.test(value);
}

function parseHttpUrl(value: string, label: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return value;
  } catch {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be an absolute http(s) URL.`,
    });
  }
}

function parseIsoDate(value: string, label: string) {
  if (!requireMatch(value, ISO_DATE_RE)) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must use YYYY-MM-DD format.`,
    });
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be a real calendar date.`,
    });
  }

  const normalized = date.toISOString().slice(0, 10);

  if (normalized !== value) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be a real calendar date.`,
    });
  }

  return value;
}

function parseInteger(
  value: number,
  label: string,
  options: { min: number; max?: number }
) {
  if (!Number.isInteger(value)) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be an integer.`,
    });
  }

  if (
    value < options.min ||
    (options.max !== undefined && value > options.max)
  ) {
    const range =
      options.max === undefined
        ? `>= ${options.min}`
        : `between ${options.min} and ${options.max}`;

    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be ${range}.`,
    });
  }

  return value;
}

export function validateSiteUrl(siteUrl?: string) {
  if (!siteUrl) {
    throw cliError({
      code: "invalid_input",
      message: "Missing Search Console property URL.",
      hint: "Pass --site-url <url> or set GSC_SITE_URL.",
    });
  }

  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length);
    if (!domain || DOMAIN_WHITESPACE_RE.test(domain) || domain.includes("/")) {
      throw cliError({
        code: "invalid_input",
        message: `Invalid siteUrl: ${siteUrl}`,
        hint: 'Domain properties must look like "sc-domain:example.com".',
      });
    }
    return siteUrl;
  }

  return parseHttpUrl(siteUrl, "siteUrl");
}

export function validateAbsoluteUrl(value: string, label: string) {
  return parseHttpUrl(value, label);
}

export function validateOptionalLanguageCode(value?: string) {
  if (!value) {
    return value;
  }

  if (!requireMatch(value, LANGUAGE_CODE_RE)) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid languageCode: ${value}`,
      hint: "languageCode must be a BCP-47 style language tag like en or en-US.",
    });
  }

  return value;
}

export function validateOptionalPermissionLevel(value?: string) {
  if (!value) {
    return value;
  }

  const allowed = new Set([
    "siteOwner",
    "siteFullUser",
    "siteRestrictedUser",
    "siteUnverifiedUser",
  ]);

  if (!allowed.has(value)) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid permissionLevel: ${value}`,
      hint: "permissionLevel must be one of siteOwner, siteFullUser, siteRestrictedUser, or siteUnverifiedUser.",
    });
  }

  return value;
}

export function validateDimensions(value?: string) {
  if (!value) {
    return ["query", "page"];
  }

  const dimensions = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (dimensions.length === 0) {
    throw cliError({
      code: "invalid_input",
      message: "dimensions cannot be empty.",
      hint: 'Pass comma-separated values like "query,page".',
    });
  }

  const unique = new Set<string>();
  for (const dimension of dimensions) {
    if (!SEARCH_DIMENSIONS.has(dimension)) {
      throw cliError({
        code: "invalid_input",
        message: `Unsupported dimension: ${dimension}`,
        hint: "Allowed dimensions are query, page, country, device, searchAppearance, and date.",
      });
    }
    unique.add(dimension);
  }

  return [...unique];
}

export function validateDateRange(startDate: string, endDate: string) {
  const start = parseIsoDate(startDate, "startDate");
  const end = parseIsoDate(endDate, "endDate");

  if (start > end) {
    throw cliError({
      code: "invalid_input",
      message: "startDate cannot be after endDate.",
      hint: "Pass a date range where startDate <= endDate.",
    });
  }

  return { startDate: start, endDate: end };
}

export function validateRowLimit(rowLimit?: number) {
  if (rowLimit === undefined) {
    return rowLimit;
  }
  return parseInteger(rowLimit, "rowLimit", { min: 1, max: 25_000 });
}

export function validateStartRow(startRow?: number) {
  if (startRow === undefined) {
    return startRow;
  }
  return parseInteger(startRow, "startRow", { min: 0 });
}

export function validateCountryFilter(countryFilter?: string) {
  if (!countryFilter) {
    return countryFilter;
  }

  if (!requireMatch(countryFilter, COUNTRY_CODE_RE)) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid countryFilter: ${countryFilter}`,
      hint: "countryFilter must use an ISO 3166-1 alpha-3 country code like USA.",
    });
  }

  return countryFilter;
}

export function validateFilterOperator(
  operator: string | undefined,
  filters: Array<string | undefined>
) {
  const resolved = operator ?? "contains";
  const hasRegexLikeFilter = filters.some((value) =>
    value?.startsWith("regex:")
  );
  const isRegexOperator =
    resolved === "includingRegex" || resolved === "excludingRegex";

  if (hasRegexLikeFilter && !isRegexOperator) {
    throw cliError({
      code: "invalid_input",
      message: "Regex-prefixed filters require a regex filterOperator.",
      hint: "Use --filter-operator includingRegex or excludingRegex with regex:<pattern> filters.",
    });
  }

  if (!hasRegexLikeFilter && isRegexOperator) {
    throw cliError({
      code: "invalid_input",
      message:
        "Regex filterOperator requires at least one regex:<pattern> filter.",
      hint: "Prefix queryFilter or pageFilter with regex: when using a regex operator.",
    });
  }

  return resolved;
}
