/** Errors from AI providers, normalised into something safe to show users. */
export type AiErrorKind = "not_configured" | "rate_limited" | "auth" | "unavailable" | "bad_response" | "refused";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status: number;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = AI_ERROR_STATUS[kind];
  }
}

const AI_ERROR_STATUS: Record<AiErrorKind, number> = {
  not_configured: 503,
  rate_limited: 429,
  auth: 502,
  unavailable: 503,
  bad_response: 502,
  refused: 422,
};

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}
