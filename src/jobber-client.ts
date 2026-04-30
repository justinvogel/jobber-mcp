import { config } from "./config.js";
import { TokenManager } from "./auth.js";

export interface GraphQLError {
  message: string;
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

export class JobberApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: GraphQLError[],
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "JobberApiError";
  }
}

export class JobberClient {
  constructor(private readonly tokens: TokenManager) {}

  async request<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    opts: { operationName?: string; retryOn401?: boolean } = {},
  ): Promise<T> {
    const retryOn401 = opts.retryOn401 ?? true;
    const accessToken = await this.tokens.getAccessToken();
    const res = await fetch(config.endpoints.graphql, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-JOBBER-GRAPHQL-VERSION": config.apiVersion,
      },
      body: JSON.stringify({
        query,
        variables: variables ?? {},
        operationName: opts.operationName,
      }),
    });

    // 401 can happen if a token was revoked or clock skew made it expire mid-flight.
    // One-shot refresh + retry so transient expiries are invisible to callers.
    if (res.status === 401 && retryOn401) {
      await this.tokens.refresh();
      return this.request<T>(query, variables, { ...opts, retryOn401: false });
    }

    const text = await res.text();
    let body: GraphQLResponse<T> | undefined;
    try {
      body = text ? (JSON.parse(text) as GraphQLResponse<T>) : undefined;
    } catch {
      throw new JobberApiError(
        `Non-JSON response from Jobber (${res.status}): ${text.slice(0, 500)}`,
        res.status,
      );
    }

    if (!res.ok) {
      throw new JobberApiError(
        `Jobber API HTTP ${res.status}: ${body?.errors?.[0]?.message ?? text.slice(0, 500)}`,
        res.status,
        body?.errors,
        body,
      );
    }
    if (body?.errors && body.errors.length > 0) {
      throw new JobberApiError(
        `Jobber GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`,
        res.status,
        body.errors,
        body,
      );
    }
    if (!body || body.data === undefined) {
      throw new JobberApiError("Jobber returned an empty response body.", res.status, undefined, body);
    }
    return body.data;
  }
}
