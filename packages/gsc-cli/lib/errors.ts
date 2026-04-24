/**
 * @input machine-classified CLI error metadata
 * @output stable CliError shape for agent-facing runtime failures
 * @pos shared error contract between handlers, client, and output
 */

export type CliErrorCode =
  | "invalid_input"
  | "not_found"
  | "unsupported"
  | "backend_failure"
  | "provider_auth"
  | "provider_rate_limited"
  | "provider_failure";

export class CliError extends Error {
  code: CliErrorCode;
  hint?: string;

  constructor(input: { code: CliErrorCode; message: string; hint?: string }) {
    super(input.message);
    this.name = "CliError";
    this.code = input.code;
    this.hint = input.hint;
  }
}

export function cliError(input: {
  code: CliErrorCode;
  message: string;
  hint?: string;
}) {
  return new CliError(input);
}

function readProviderReason(error: Error) {
  const response = Reflect.get(error, "response") as
    | { data?: { error?: { errors?: Array<{ reason?: string }> } } }
    | undefined;

  return (
    (Reflect.get(error, "reason") as string | undefined) ??
    response?.data?.error?.errors?.[0]?.reason ??
    ""
  );
}

function normalizeGoogleProviderError(error: Error) {
  const status = Number(
    Reflect.get(error, "status") ?? Reflect.get(error, "code") ?? 0
  );
  const reason = readProviderReason(error);

  if (!status) {
    return null;
  }

  if (
    status === 401 ||
    status === 403 ||
    reason === "insufficientPermissions" ||
    reason === "accessNotConfigured"
  ) {
    return cliError({
      code: "provider_auth",
      message: error.message,
      hint: "Verify the service account has Search Console access and the Search Console API is enabled.",
    });
  }

  if (
    status === 429 ||
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "quotaExceeded"
  ) {
    return cliError({
      code: "provider_rate_limited",
      message: error.message,
      hint: "Retry later or reduce request frequency.",
    });
  }

  if (status === 404) {
    return cliError({
      code: "not_found",
      message: error.message,
      hint: "Check the property URL and confirm the account can access it.",
    });
  }

  if (status === 400) {
    return cliError({
      code: "invalid_input",
      message: error.message,
      hint: "Check the request shape, property URL, and filter values.",
    });
  }

  return cliError({
    code: "provider_failure",
    message: error.message,
    hint:
      status >= 500
        ? "Retry later; Google returned a server error."
        : undefined,
  });
}

export function normalizeCliError(error: unknown) {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return (
      normalizeGoogleProviderError(error) ??
      cliError({ code: "backend_failure", message: error.message })
    );
  }

  return cliError({
    code: "backend_failure",
    message: "Unknown CLI error",
  });
}
