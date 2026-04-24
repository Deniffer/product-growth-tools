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

type ProviderError = {
  message?: string;
  error_code?: Record<string, unknown>;
};

function readProviderErrors(error: Error) {
  const providerErrors = Reflect.get(error, "errors");
  return Array.isArray(providerErrors)
    ? (providerErrors as ProviderError[])
    : [];
}

function hasProviderError(errors: ProviderError[], key: string) {
  return errors.some((item) => Boolean(item.error_code?.[key]));
}

function normalizeProviderError(error: Error) {
  const status = Number(Reflect.get(error, "status") ?? 0);
  const providerErrors = readProviderErrors(error);

  if (
    status === 401 ||
    status === 403 ||
    hasProviderError(providerErrors, "authentication_error") ||
    hasProviderError(providerErrors, "authorization_error") ||
    hasProviderError(providerErrors, "header_error")
  ) {
    return cliError({
      code: "provider_auth",
      message: error.message,
      hint: "Verify the service account email has Google Ads access, the developer token is valid, and the MCC login customer is correct.",
    });
  }

  if (
    status === 429 ||
    hasProviderError(providerErrors, "quota_error") ||
    hasProviderError(providerErrors, "resource_count_limit_exceeded_error")
  ) {
    return cliError({
      code: "provider_rate_limited",
      message: error.message,
      hint: "Retry later or reduce request frequency.",
    });
  }

  if (status === 404 || hasProviderError(providerErrors, "customer_error")) {
    return cliError({
      code: "not_found",
      message: error.message,
      hint: "Check the customer ID and confirm the account is accessible.",
    });
  }

  if (status === 400 || hasProviderError(providerErrors, "query_error")) {
    return cliError({
      code: "invalid_input",
      message: error.message,
      hint: "Check the GAQL shape, selected fields, and request filters.",
    });
  }

  if (status > 0 || providerErrors.length > 0) {
    return cliError({
      code: "provider_failure",
      message: error.message,
      hint:
        status >= 500
          ? "Retry later; Google returned a server error."
          : undefined,
    });
  }

  return null;
}

export function normalizeCliError(error: unknown) {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return (
      normalizeProviderError(error) ??
      cliError({ code: "backend_failure", message: error.message })
    );
  }

  return cliError({
    code: "backend_failure",
    message: "Unknown CLI error",
  });
}
