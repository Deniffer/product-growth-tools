/**
 * @input registry JSON files, remote sitemap XML documents, and classification rules
 * @output active competitor inventory plus normalized current snapshot records
 * @pos provider-adjacent sitemap snapshot boundary for the feedback loop
 */

import { existsSync, readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import {
  array,
  boolean,
  number,
  object,
  optional,
  parse,
  string,
} from "valibot";
import { cliError } from "./lib/errors";
import { validateAbsoluteUrl } from "./lib/input-validation";

const pageTypeRuleSchema = object({
  pattern: string(),
  pageType: string(),
});

const topicRuleSchema = object({
  pattern: string(),
  topicCluster: string(),
});

const competitorSchema = object({
  competitorId: string(),
  domain: string(),
  active: boolean(),
  priority: optional(number()),
  sitemapUrls: array(string()),
  pageTypeRules: optional(array(pageTypeRuleSchema)),
  topicRules: optional(array(topicRuleSchema)),
});

const registrySchema = object({
  competitors: array(competitorSchema),
});

type FetchLike = (
  url: string
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export type PageTypeRule = {
  pattern: string;
  pageType: string;
};

export type TopicRule = {
  pattern: string;
  topicCluster: string;
};

export type CompetitorConfig = {
  competitorId: string;
  domain: string;
  active: boolean;
  priority?: number;
  sitemapUrls: string[];
  pageTypeRules?: PageTypeRule[];
  topicRules?: TopicRule[];
};

export type SnapshotPage = {
  competitorId: string;
  domain: string;
  url: string;
  path: string;
  slug: string;
  pageType: string;
  topicCluster: string;
  lastmod: string | null;
  sitemapUrl: string;
  capturedAt: string;
};

type RegistryData = {
  competitors: CompetitorConfig[];
};

type SitemapUrlEntry = {
  loc: string;
  lastmod: string | null;
  sitemapUrl: string;
};

type SitemapDocument =
  | { kind: "index"; sitemaps: Array<{ loc: string }> }
  | { kind: "urlset"; urls: SitemapUrlEntry[] };

export type SitemapClient = {
  listCompetitors: (input: {
    registryFile: string;
    competitor?: string;
  }) => Promise<{ count: number; competitors: CompetitorConfig[] }>;
  getPages: (input: {
    registryFile: string;
    competitor?: string;
    capturedAt: string;
  }) => Promise<{ capturedAt: string; count: number; pages: SnapshotPage[] }>;
  getPage: (input: {
    registryFile: string;
    competitor: string;
    url: string;
    capturedAt: string;
  }) => Promise<{ capturedAt: string; page: SnapshotPage }>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
  removeNSPrefix: true,
});
const TRAILING_SLASH_RE = /\/+$/;
const LOCALE_PREFIX_RE = /^\/([a-z]{2}(?:-[A-Za-z]{2,4})?)(?=\/|$)/i;

export function createSitemapClient(fetcher: FetchLike = fetch): SitemapClient {
  return {
    listCompetitors(input) {
      const registry = readRegistryFile(input.registryFile);
      const competitors = resolveCompetitors(registry, input.competitor);
      return Promise.resolve({
        count: competitors.length,
        competitors,
      });
    },
    async getPages(input) {
      const registry = readRegistryFile(input.registryFile);
      const competitors = resolveCompetitors(registry, input.competitor);
      const pages = await collectPages(fetcher, competitors, input.capturedAt);

      return {
        capturedAt: input.capturedAt,
        count: pages.length,
        pages,
      };
    },
    async getPage(input) {
      const registry = readRegistryFile(input.registryFile);
      const competitors = resolveCompetitors(registry, input.competitor);
      const normalizedTarget = validateAbsoluteUrl(input.url, "url");
      const pages = await collectPages(fetcher, competitors, input.capturedAt);
      const page = pages.find((entry) => entry.url === normalizedTarget);

      if (!page) {
        throw cliError({
          code: "not_found",
          message: `Page URL not found in current snapshot: ${normalizedTarget}`,
          hint: "Confirm the URL is present in the competitor sitemap and retry.",
        });
      }

      return {
        capturedAt: input.capturedAt,
        page,
      };
    },
  };
}

function readRegistryFile(path: string) {
  if (!existsSync(path)) {
    throw cliError({
      code: "invalid_input",
      message: `Registry file not found: ${path}`,
      hint: "Pass a valid --registry-file <path>.",
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw cliError({
      code: "invalid_input",
      message: `Registry file is not valid JSON: ${path}`,
      hint: "Fix the registry JSON structure and retry.",
    });
  }

  let parsedRegistry: RegistryData;
  try {
    parsedRegistry = parse(registrySchema, raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid registry";
    throw cliError({
      code: "invalid_input",
      message: `Registry file is not valid: ${message}`,
      hint: "Match the competitor registry schema before retrying.",
    });
  }

  for (const competitor of parsedRegistry.competitors) {
    validateCompetitorRules(competitor);
    for (const sitemapUrl of competitor.sitemapUrls) {
      validateAbsoluteUrl(sitemapUrl, "sitemapUrl");
    }
  }

  return parsedRegistry;
}

function validateCompetitorRules(competitor: CompetitorConfig) {
  for (const rule of competitor.pageTypeRules ?? []) {
    validateRulePattern(rule.pattern, competitor.competitorId, "pageTypeRules");
  }
  for (const rule of competitor.topicRules ?? []) {
    validateRulePattern(rule.pattern, competitor.competitorId, "topicRules");
  }
}

function validateRulePattern(
  pattern: string,
  competitorId: string,
  label: string
) {
  try {
    new RegExp(pattern, "i");
  } catch {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label} pattern for competitor ${competitorId}: ${pattern}`,
      hint: "Use valid regular expressions in the registry file.",
    });
  }
}

function resolveCompetitors(registry: RegistryData, competitorId?: string) {
  const active = registry.competitors.filter((entry) => entry.active);

  if (!competitorId) {
    return active;
  }

  const selected = active.find((entry) => entry.competitorId === competitorId);
  if (!selected) {
    throw cliError({
      code: "invalid_input",
      message: `Unknown or inactive competitor: ${competitorId}`,
      hint: "Choose a competitorId that exists and is active in the registry.",
    });
  }

  return [selected];
}

async function collectPages(
  fetcher: FetchLike,
  competitors: CompetitorConfig[],
  capturedAt: string
) {
  const deduped = new Map<string, SnapshotPage>();

  for (const competitor of competitors) {
    const entries = await collectCompetitorEntries(fetcher, competitor);

    for (const entry of entries) {
      const page = normalizeSnapshotPage(competitor, entry, capturedAt);
      const key = `${page.competitorId}::${page.url}`;
      const existing = deduped.get(key);
      deduped.set(key, mergeSnapshotPage(existing, page));
    }
  }

  return [...deduped.values()].sort((left, right) =>
    left.url.localeCompare(right.url)
  );
}

async function collectCompetitorEntries(
  fetcher: FetchLike,
  competitor: CompetitorConfig
) {
  const entries: SitemapUrlEntry[] = [];
  const seenSitemaps = new Set<string>();

  for (const sitemapUrl of competitor.sitemapUrls) {
    const childEntries = await collectEntriesFromSitemap(
      fetcher,
      sitemapUrl,
      seenSitemaps
    );
    entries.push(...childEntries);
  }

  return entries;
}

async function collectEntriesFromSitemap(
  fetcher: FetchLike,
  sitemapUrl: string,
  seenSitemaps: Set<string>
): Promise<SitemapUrlEntry[]> {
  const normalizedSitemapUrl = validateAbsoluteUrl(sitemapUrl, "sitemapUrl");
  if (seenSitemaps.has(normalizedSitemapUrl)) {
    return [];
  }
  seenSitemaps.add(normalizedSitemapUrl);

  const xml = await fetchSitemapXml(fetcher, normalizedSitemapUrl);
  const document = parseSitemapDocument(xml, normalizedSitemapUrl);

  if (document.kind === "urlset") {
    return document.urls;
  }

  const pages: SitemapUrlEntry[] = [];
  for (const child of document.sitemaps) {
    const childPages = await collectEntriesFromSitemap(
      fetcher,
      child.loc,
      seenSitemaps
    );
    pages.push(...childPages);
  }
  return pages;
}

async function fetchSitemapXml(fetcher: FetchLike, sitemapUrl: string) {
  let response: Awaited<ReturnType<FetchLike>>;

  try {
    response = await fetcher(sitemapUrl);
  } catch (error) {
    if (error instanceof Error) {
      throw cliError({
        code: "network_error",
        message: `Failed to fetch sitemap: ${sitemapUrl} (${error.message})`,
        hint: "Check network reachability and retry the request.",
      });
    }

    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      `Failed to fetch sitemap: ${sitemapUrl} (status ${response.status})`
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response.text();
}

function parseSitemapDocument(
  xml: string,
  sitemapUrl: string
): SitemapDocument {
  let parsed: Record<string, unknown>;

  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw cliError({
      code: "parse_error",
      message: `Failed to parse sitemap XML: ${sitemapUrl}`,
      hint: "Verify the sitemap endpoint returns valid XML.",
    });
  }

  const urlset = parsed.urlset;
  if (urlset && typeof urlset === "object") {
    return {
      kind: "urlset",
      urls: ensureArray((urlset as { url?: unknown }).url).map((entry) =>
        parseUrlEntry(entry, sitemapUrl)
      ),
    };
  }

  const sitemapindex = parsed.sitemapindex;
  if (sitemapindex && typeof sitemapindex === "object") {
    return {
      kind: "index",
      sitemaps: ensureArray(
        (sitemapindex as { sitemap?: unknown }).sitemap
      ).map(parseIndexEntry),
    };
  }

  throw cliError({
    code: "parse_error",
    message: `Unsupported sitemap XML shape: ${sitemapUrl}`,
    hint: "Expected either <urlset> or <sitemapindex>.",
  });
}

function parseIndexEntry(value: unknown) {
  const loc = readRequiredText(value, "loc");
  return {
    loc: validateAbsoluteUrl(loc, "sitemapUrl"),
  };
}

function parseUrlEntry(value: unknown, sitemapUrl: string): SitemapUrlEntry {
  const loc = validateAbsoluteUrl(readRequiredText(value, "loc"), "url");
  return {
    loc,
    lastmod: normalizeOptionalDate(readOptionalText(value, "lastmod")),
    sitemapUrl,
  };
}

function readRequiredText(value: unknown, key: string) {
  const text = readOptionalText(value, key);
  if (!text) {
    throw cliError({
      code: "parse_error",
      message: `Missing ${key} in sitemap entry.`,
      hint: "Each sitemap item must expose a loc value.",
    });
  }
  return text;
}

function readOptionalText(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const raw = record[key];
  if (typeof raw === "string") {
    return raw.trim() || null;
  }

  if (raw && typeof raw === "object" && "#text" in raw) {
    const text = (raw as { "#text"?: unknown })["#text"];
    return typeof text === "string" ? text.trim() || null : null;
  }

  return null;
}

function ensureArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

function normalizeOptionalDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeSnapshotPage(
  competitor: CompetitorConfig,
  entry: SitemapUrlEntry,
  capturedAt: string
): SnapshotPage {
  const parsedUrl = new URL(entry.loc);
  const path = parsedUrl.pathname || "/";
  const slug = resolveSlug(path);

  return {
    competitorId: competitor.competitorId,
    domain: competitor.domain,
    url: parsedUrl.toString(),
    path,
    slug,
    pageType: resolvePageType(competitor, path, slug, parsedUrl.toString()),
    topicCluster: resolveTopicCluster(
      competitor,
      path,
      slug,
      parsedUrl.toString()
    ),
    lastmod: entry.lastmod,
    sitemapUrl: entry.sitemapUrl,
    capturedAt,
  };
}

function resolveSlug(path: string) {
  const trimmed = path.replace(TRAILING_SLASH_RE, "");
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const segments = trimmed.split("/").filter(Boolean);
  return segments.at(-1) ?? "";
}

function stripLocalePrefix(path: string) {
  return path.replace(LOCALE_PREFIX_RE, "") || "/";
}

function resolvePageType(
  competitor: CompetitorConfig,
  path: string,
  slug: string,
  url: string
) {
  const normalizedPath = stripLocalePrefix(path);
  const custom = matchRuleValue(
    competitor.pageTypeRules ?? [],
    [path, normalizedPath, slug, url],
    "pageType"
  );
  if (custom) {
    return custom;
  }

  const lowerPath = normalizedPath.toLowerCase();
  const lowerSlug = slug.toLowerCase();

  if (lowerPath.startsWith("/blog/")) {
    return "blog";
  }
  if (lowerPath.startsWith("/faq/")) {
    return "faq";
  }
  if (lowerPath.startsWith("/guides/")) {
    return "guide";
  }
  if (lowerPath.startsWith("/use-cases/")) {
    return "use_case";
  }
  if (lowerPath.startsWith("/compare/") || lowerSlug.includes("-vs-")) {
    return "comparison";
  }

  return "other";
}

function resolveTopicCluster(
  competitor: CompetitorConfig,
  path: string,
  slug: string,
  url: string
) {
  const normalizedPath = stripLocalePrefix(path);
  const custom = matchRuleValue(
    competitor.topicRules ?? [],
    [path, normalizedPath, slug, url],
    "topicCluster"
  );
  if (custom) {
    return custom;
  }

  const haystack = `${path} ${normalizedPath} ${slug} ${url}`.toLowerCase();
  for (const keyword of [
    "discord",
    "slack",
    "telegram",
    "whatsapp",
    "automation",
    "browser",
    "agent",
    "email",
  ]) {
    if (haystack.includes(keyword)) {
      return keyword;
    }
  }

  return "unknown";
}

function matchRuleValue<
  T extends PageTypeRule | TopicRule,
  K extends keyof T & string,
>(rules: T[], candidates: string[], valueKey: K) {
  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern, "i");
    if (candidates.some((candidate) => pattern.test(candidate))) {
      return rule[valueKey];
    }
  }

  return null;
}

function mergeSnapshotPage(
  existing: SnapshotPage | undefined,
  incoming: SnapshotPage
) {
  if (!existing) {
    return incoming;
  }

  if (!existing.lastmod && incoming.lastmod) {
    return incoming;
  }

  return existing;
}
