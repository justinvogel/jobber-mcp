#!/usr/bin/env node
/**
 * HTTP entry point — exposes the MCP server over the Streamable HTTP transport
 * (the modern MCP transport, supersedes plain SSE). Good for hosted
 * deployments on Railway, Render, Fly.io, Vercel, etc.
 *
 * Run: `node dist/http.js` (or `npm run start:http`).
 *
 * Environment:
 *   PORT (default 3000)         — listen port
 *   JOBBER_MCP_AUTH_TOKEN       — if set, requests must send `Authorization:
 *                                 Bearer <token>` matching this value. Optional
 *                                 but strongly recommended for any
 *                                 internet-reachable deployment.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { assertCredentials } from "./config.js";
import { createJobberMcpServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const AUTH_TOKEN = process.env.JOBBER_MCP_AUTH_TOKEN ?? "";

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  assertCredentials();

  // One server, one transport — the streamable transport multiplexes sessions.
  const { server } = createJobberMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    // CORS — permissive by default. Lock this down behind a reverse proxy
    // or by overriding via your platform's networking layer.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Optional shared-secret auth.
    if (AUTH_TOKEN) {
      const got = req.headers["authorization"];
      if (got !== `Bearer ${AUTH_TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
    }

    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    const body = req.method === "POST" ? await readJson(req) : undefined;
    try {
      await transport.handleRequest(req, res, body);
    } catch (err) {
      process.stderr.write(`request error: ${err instanceof Error ? err.message : String(err)}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal" }));
      }
    }
  });

  httpServer.listen(PORT, () => {
    process.stderr.write(
      `jobber-mcp: HTTP server listening on :${PORT} (POST /mcp, GET /healthz)${AUTH_TOKEN ? " [auth required]" : " [no auth — set JOBBER_MCP_AUTH_TOKEN]"}\n`,
    );
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      process.stderr.write(`\nshutting down (${sig})\n`);
      await transport.close();
      httpServer.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  process.stderr.write(`http server failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
