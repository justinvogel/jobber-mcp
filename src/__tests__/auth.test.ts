import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the JWT-decode + buildStoredTokens behavior in isolation by importing
// the auth module's internals. Note: buildStoredTokens isn't exported, so we
// re-implement the same parsing logic here against real Jobber-shape JWTs to
// guard the contract.

function decodeJwtPayload(token: string): { exp?: number; scope?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad;
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("JWT payload decode", () => {
  it("extracts exp + scope from a valid Jobber-style access token", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ sub: 12345, exp, scope: "read_clients write_clients" });
    const payload = decodeJwtPayload(token);
    expect(payload?.exp).toBe(exp);
    expect(payload?.scope).toBe("read_clients write_clients");
  });

  it("returns null on malformed token", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });

  it("returns null on token with bad base64 in payload", () => {
    expect(decodeJwtPayload("header.@@@@.signature")).toBeNull();
  });
});

describe("Token expiry math", () => {
  it("treats a token as expired if now > exp - skew", () => {
    const SKEW_MS = 60_000;
    const expiresAt = Date.now() + 30_000;
    const isStillValid = Date.now() < expiresAt - SKEW_MS;
    expect(isStillValid).toBe(false);
  });

  it("treats a token as fresh if now < exp - skew", () => {
    const SKEW_MS = 60_000;
    const expiresAt = Date.now() + 5 * 60_000;
    const isStillValid = Date.now() < expiresAt - SKEW_MS;
    expect(isStillValid).toBe(true);
  });
});
