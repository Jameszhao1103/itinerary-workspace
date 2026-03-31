export type GoogleIntegrationErrorCode =
  | "place_not_found"
  | "place_ambiguous"
  | "route_unavailable"
  | "quota_exceeded"
  | "upstream_timeout"
  | "upstream_bad_response"
  | "configuration_error";

export type GoogleErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown[];
  };
};

export class GoogleIntegrationError extends Error {
  readonly code: GoogleIntegrationErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: GoogleIntegrationErrorCode,
    message: string,
    options?: {
      status?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "GoogleIntegrationError";
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;

    if (options?.cause) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
      });
    }
  }
}

export function mapGoogleErrorResponse(
  status: number,
  payload: GoogleErrorPayload | undefined,
  fallbackMessage: string
): GoogleIntegrationError {
  const upstreamStatus = payload?.error?.status;
  const upstreamMessage = payload?.error?.message ?? fallbackMessage;

  if (status === 404) {
    return new GoogleIntegrationError("place_not_found", upstreamMessage, {
      status,
      details: payload,
    });
  }

  if (status === 408) {
    return new GoogleIntegrationError("upstream_timeout", upstreamMessage, {
      status,
      details: payload,
    });
  }

  if (status === 429 || upstreamStatus === "RESOURCE_EXHAUSTED") {
    return new GoogleIntegrationError("quota_exceeded", upstreamMessage, {
      status,
      details: payload,
    });
  }

  if (status >= 500) {
    return new GoogleIntegrationError("upstream_bad_response", upstreamMessage, {
      status,
      details: payload,
    });
  }

  return new GoogleIntegrationError("upstream_bad_response", upstreamMessage, {
    status,
    details: payload,
  });
}
