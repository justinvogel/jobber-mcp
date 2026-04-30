import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobberClient, JobberApiError } from "../jobber-client.js";
import type { TokenManager } from "../auth.js";

// Stub TokenManager — we don't want to touch real auth state in unit tests.
function makeStubTokens(opts: { access?: string; onRefresh?: () => string } = {}) {
  let token = opts.access ?? "test-access-token";
  return {
    getAccessToken: vi.fn(async () => token),
    refresh: vi.fn(async () => {
      if (opts.onRefresh) token = opts.onRefresh();
      return { access_token: token, refresh_token: "r", expires_at: Date.now() + 3600_000 };
    }),
  } as unknown as TokenManager;
}

function mockFetchOnce(...responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("JobberClient.request", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("returns data on a 200 success", async () => {
    mockFetchOnce({ status: 200, body: { data: { account: { id: "x" } } } });
    const client = new JobberClient(makeStubTokens());
    const out = await client.request("{ account { id } }");
    expect(out).toEqual({ account: { id: "x" } });
  });

  it("throws JobberApiError when GraphQL errors are present", async () => {
    mockFetchOnce({
      status: 200,
      body: { errors: [{ message: "Field 'foo' does not exist" }] },
    });
    const client = new JobberClient(makeStubTokens());
    await expect(client.request("{ foo }")).rejects.toBeInstanceOf(JobberApiError);
  });

  it("refreshes the token and retries once on 401", async () => {
    mockFetchOnce(
      { status: 401, body: { error: "expired" } },
      { status: 200, body: { data: { account: { id: "x" } } } },
    );
    const tokens = makeStubTokens({ onRefresh: () => "fresh-token" });
    const client = new JobberClient(tokens);
    const out = await client.request("{ account { id } }");
    expect(out).toEqual({ account: { id: "x" } });
    expect(tokens.refresh).toHaveBeenCalledOnce();
  });

  it("does not retry a second time on consecutive 401s", async () => {
    mockFetchOnce(
      { status: 401, body: { error: "expired" } },
      { status: 401, body: { error: "still expired" } },
    );
    const tokens = makeStubTokens();
    const client = new JobberClient(tokens);
    await expect(client.request("{ account { id } }")).rejects.toBeInstanceOf(JobberApiError);
    expect(tokens.refresh).toHaveBeenCalledOnce();
  });

  it("captures status + GraphQL errors on the JobberApiError", async () => {
    const errors = [{ message: "boom", path: ["q"] }];
    mockFetchOnce({ status: 200, body: { errors } });
    const client = new JobberClient(makeStubTokens());
    try {
      await client.request("{ x }");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JobberApiError);
      const e = err as JobberApiError;
      expect(e.status).toBe(200);
      expect(e.errors).toEqual(errors);
    }
  });
});
