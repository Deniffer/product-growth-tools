/**
 * @input raw CLI strings for files, URLs, and timestamps
 * @output validated and normalized scalar inputs for sitemap-watch commands
 * @pos shared validation layer between handlers and provider
 */

import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cliError } from "./errors";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageDirectory, "../../..");

export function validateRegistryFile(value: string) {
  if (!value.trim()) {
    throw cliError({
      code: "invalid_input",
      message: "registryFile cannot be empty.",
      hint: "Pass --registry-file <path>.",
    });
  }

  if (isAbsolute(value)) {
    return value;
  }

  const cwdCandidate = resolve(process.cwd(), value);
  if (existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  const repositoryCandidate = resolve(repositoryRoot, value);
  return repositoryCandidate;
}

export function validateAbsoluteUrl(value: string, label: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }

    return url.toString();
  } catch {
    throw cliError({
      code: "invalid_input",
      message: `Invalid ${label}: ${value}`,
      hint: `${label} must be an absolute http(s) URL.`,
    });
  }
}

export function validateOptionalCapturedAt(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw cliError({
      code: "invalid_input",
      message: `Invalid capturedAt: ${value}`,
      hint: "capturedAt must be a valid ISO-8601 timestamp.",
    });
  }

  return date.toISOString();
}
