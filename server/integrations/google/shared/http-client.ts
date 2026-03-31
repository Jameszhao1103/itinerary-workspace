import {
  GoogleIntegrationError,
  mapGoogleErrorResponse,
  type GoogleErrorPayload,
} from "./errors.ts";

type QueryValue = string | number | boolean | null | undefined;

export type GoogleFieldMask = string | string[];

export type GoogleHttpClientOptions = {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
};

type GoogleRequest = {
  path: string;
  query?: Record<string, QueryValue>;
  fieldMask?: GoogleFieldMask;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

type GooglePostRequest = GoogleRequest & {
  body?: unknown;
};

export class GoogleHttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly options: GoogleHttpClientOptions;

  constructor(options: GoogleHttpClientOptions) {
    this.options = options;
    if (!options.apiKey) {
      throw new GoogleIntegrationError(
        "configuration_error",
        "Google API key is required for GoogleHttpClient."
      );
    }

    if (!globalThis.fetch && !options.fetchImpl) {
      throw new GoogleIntegrationError(
        "configuration_error",
        "No fetch implementation is available for GoogleHttpClient."
      );
    }

    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getJson<T>(request: GoogleRequest): Promise<T> {
    return this.requestJson<T>("GET", request);
  }

  async postJson<T>(request: GooglePostRequest): Promise<T> {
    return this.requestJson<T>("POST", request);
  }

  async postJsonLines<T>(request: GooglePostRequest): Promise<T[]> {
    const response = await this.request("POST", request);
    return parseJsonLines<T>(await response.text());
  }

  private async requestJson<T>(
    method: "GET" | "POST",
    request: GoogleRequest | GooglePostRequest
  ): Promise<T> {
    const response = await this.request(method, request);
    return (await response.json()) as T;
  }

  private async request(
    method: "GET" | "POST",
    request: GoogleRequest | GooglePostRequest
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? this.timeoutMs
    );

    try {
      const response = await this.fetchImpl(this.buildUrl(request.path, request.query), {
        method,
        headers: this.buildHeaders(request.fieldMask, request.headers),
        body: method === "POST" ? JSON.stringify((request as GooglePostRequest).body ?? {}) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await this.tryReadJson(response)) as GoogleErrorPayload | undefined;
        throw mapGoogleErrorResponse(response.status, payload, response.statusText);
      }

      return response;
    } catch (error) {
      if (error instanceof GoogleIntegrationError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new GoogleIntegrationError("upstream_timeout", "Google API request timed out.", {
          cause: error,
        });
      }

      throw new GoogleIntegrationError(
        "upstream_bad_response",
        "Google API request failed unexpectedly.",
        { cause: error }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(
    fieldMask?: GoogleFieldMask,
    extraHeaders?: Record<string, string>
  ): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.options.apiKey,
      ...this.options.defaultHeaders,
      ...extraHeaders,
    });

    const mask = normalizeFieldMask(fieldMask);
    if (mask) {
      headers.set("X-Goog-FieldMask", mask);
    }

    return headers;
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(path, this.options.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private async tryReadJson(response: Response): Promise<unknown | undefined> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

export function normalizeFieldMask(fieldMask?: GoogleFieldMask): string | undefined {
  if (!fieldMask) {
    return undefined;
  }

  if (Array.isArray(fieldMask)) {
    return fieldMask.join(",");
  }

  return fieldMask;
}

function parseJsonLines<T>(value: string): T[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as T | T[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }
}
