import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { URL } from "node:url";
import open from "open";
import { config, assertCredentials } from "./config.js";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope?: string;
  token_type?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

// Treat tokens as expired 60s before actual expiry to avoid edge-of-expiry races.
const EXPIRY_SKEW_MS = 60_000;

// Jobber's token responses only contain access_token + refresh_token. The
// expiry and scope live inside the access token's JWT payload. Decode those
// so we can honour them without a server-side roundtrip.
interface JwtPayload {
  exp?: number;
  scope?: string;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad;
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

/** Build a StoredTokens record from whatever fields the provider gives us. */
function buildStoredTokens(
  data: TokenResponse,
  prev?: StoredTokens | null,
): StoredTokens {
  const payload = decodeJwtPayload(data.access_token);
  const expiresAt = payload?.exp
    ? payload.exp * 1000
    : data.expires_in
      ? Date.now() + data.expires_in * 1000
      // Fallback: Jobber access tokens currently live 60 minutes. Used only
      // if both JWT decode and expires_in fail.
      : Date.now() + 60 * 60 * 1000;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? prev?.refresh_token ?? "",
    expires_at: expiresAt,
    scope: data.scope ?? payload?.scope ?? prev?.scope,
    token_type: data.token_type ?? prev?.token_type ?? "Bearer",
  };
}

export class TokenManager {
  private tokens: StoredTokens | null = null;
  private refreshInFlight: Promise<StoredTokens> | null = null;

  async load(): Promise<StoredTokens | null> {
    if (this.tokens) return this.tokens;
    try {
      const raw = await fs.readFile(config.tokenFile, "utf8");
      this.tokens = JSON.parse(raw) as StoredTokens;
      return this.tokens;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") return null;
      throw err;
    }
  }

  async save(tokens: StoredTokens): Promise<void> {
    this.tokens = tokens;
    await fs.writeFile(config.tokenFile, JSON.stringify(tokens, null, 2), {
      mode: 0o600,
    });
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.load();
    if (!tokens) {
      throw new Error(
        "No Jobber OAuth tokens found. Run `npm run auth` (or invoke the `jobber_authorize` tool) to complete the OAuth flow first.",
      );
    }
    if (Date.now() < tokens.expires_at - EXPIRY_SKEW_MS) {
      return tokens.access_token;
    }
    const refreshed = await this.refresh();
    return refreshed.access_token;
  }

  async refresh(): Promise<StoredTokens> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const tokens = this.tokens ?? (await this.load());
    if (!tokens?.refresh_token) {
      throw new Error("Cannot refresh: no refresh_token on file. Re-run the auth flow.");
    }
    assertCredentials();
    this.refreshInFlight = (async () => {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      const res = await fetch(config.endpoints.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token refresh failed (${res.status}): ${text}`);
      }
      const data = (await res.json()) as TokenResponse;
      const stored = buildStoredTokens(data, tokens);
      await this.save(stored);
      return stored;
    })();
    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }
}

export interface AuthorizeResult {
  tokens: StoredTokens;
  scope?: string;
}

/**
 * Run the full OAuth 2.0 authorization-code flow:
 *   1. Spin up a one-shot HTTP listener on the redirect URI's port.
 *   2. Open the user's browser to Jobber's authorize URL.
 *   3. Catch the `code` + `state` on the callback.
 *   4. Exchange the code for access + refresh tokens.
 *   5. Persist to disk via TokenManager.
 */
export async function authorizeInteractive(
  manager: TokenManager,
  opts: { openBrowser?: boolean; logger?: (msg: string) => void } = {},
): Promise<AuthorizeResult> {
  assertCredentials();
  const log = opts.logger ?? (() => {});
  const redirectUrl = new URL(config.redirectUri);
  const port = Number(redirectUrl.port) || (redirectUrl.protocol === "https:" ? 443 : 80);
  const expectedPath = redirectUrl.pathname || "/callback";
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(config.endpoints.authorize);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);
  if (config.scopes) authorizeUrl.searchParams.set("scope", config.scopes);

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400).end("Bad request");
          return;
        }
        const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        if (reqUrl.pathname !== expectedPath) {
          res.writeHead(404).end("Not found");
          return;
        }
        const error = reqUrl.searchParams.get("error");
        if (error) {
          const desc = reqUrl.searchParams.get("error_description") ?? "";
          res.writeHead(400, { "Content-Type": "text/html" }).end(htmlPage(
            "Authorization failed",
            `<p>Jobber returned: <code>${escapeHtml(error)}</code></p><p>${escapeHtml(desc)}</p>`,
          ));
          server.close();
          reject(new Error(`OAuth error: ${error} ${desc}`));
          return;
        }
        const returnedState = reqUrl.searchParams.get("state");
        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" }).end(htmlPage(
            "State mismatch",
            "<p>The returned state did not match the request. Please retry.</p>",
          ));
          server.close();
          reject(new Error("OAuth state mismatch — possible CSRF. Aborting."));
          return;
        }
        const code = reqUrl.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" }).end(htmlPage(
            "Missing code",
            "<p>No authorization code in callback.</p>",
          ));
          server.close();
          reject(new Error("No code on callback"));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" }).end(htmlPage(
          "Jobber connected",
          "<p>You can close this tab and return to your terminal.</p>",
        ));
        // Give the browser a moment to render before tearing down the socket.
        setTimeout(() => server.close(), 100);
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      log(`Waiting for OAuth callback on ${config.redirectUri} ...`);
    });
  });

  log(`Opening browser: ${authorizeUrl.toString()}`);
  if (opts.openBrowser !== false) {
    open(authorizeUrl.toString()).catch(() => {
      log(`Could not auto-open browser. Open this URL manually:\n${authorizeUrl.toString()}`);
    });
  }

  const code = await codePromise;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(config.endpoints.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as TokenResponse;
  const stored = buildStoredTokens(data);
  await manager.save(stored);
  return { tokens: stored, scope: stored.scope };
}

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:540px;margin:4rem auto;padding:0 1rem;color:#1f2937}h1{font-size:1.25rem}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style>
</head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
