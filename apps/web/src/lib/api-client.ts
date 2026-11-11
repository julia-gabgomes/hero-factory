import type { ErrorCode } from "@hero-factory/shared";

const API_BASE = "/api";

export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK_ERROR";
  readonly fields: Record<string, string> | null;
  readonly details: unknown;
  readonly status: number;

  constructor(params: {
    code: ErrorCode | "NETWORK_ERROR";
    message: string;
    fields: Record<string, string> | null;
    details?: unknown;
    status: number;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.fields = params.fields;
    this.details = params.details;
    this.status = params.status;
  }
}

function buildUrl(
  path: string,
  query?: Record<string, string | string[] | undefined>,
): string {
  const url = `${API_BASE}${path}`;
  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
    } else {
      params.set(key, value);
    }
  }

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

interface ErrorEnvelopeBody {
  error?: {
    code: string;
    message: string;
    fields: Record<string, string> | null;
    details?: unknown;
  };
}

interface RequestOptions {
  method?: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const url = buildUrl(options.path, options.query);
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.idempotencyKey !== undefined) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: "Não foi possível conectar à API. Verifique sua conexão.",
      fields: null,
      status: 0,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const envelope = json as ErrorEnvelopeBody | undefined;
    if (envelope?.error) {
      throw new ApiError({
        code: envelope.error.code as ErrorCode,
        message: envelope.error.message,
        fields: envelope.error.fields,
        details: envelope.error.details,
        status: response.status,
      });
    }
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro inesperado. Tente novamente.",
      fields: null,
      status: response.status,
    });
  }

  return json as T;
}

export const apiClient = {
  get<T>(
    path: string,
    query?: Record<string, string | string[] | undefined>,
    signal?: AbortSignal,
  ): Promise<T> {
    return apiRequest<T>({ path, query, signal });
  },
  post<T>(
    path: string,
    body?: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    return apiRequest<T>({
      path,
      method: "POST",
      body,
      idempotencyKey: options?.idempotencyKey,
    });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiRequest<T>({ path, method: "PATCH", body });
  },
  delete<T>(path: string, body?: unknown): Promise<T> {
    return apiRequest<T>({ path, method: "DELETE", body });
  },
};
