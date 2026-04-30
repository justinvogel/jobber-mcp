#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertCredentials } from "./config.js";
import { createJobberMcpServer } from "./server.js";

async function main() {
  // Fail fast on missing credentials — the OAuth flow needs both halves.
  assertCredentials();
  const { server } = createJobberMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay quiet on stdout (it's the JSON-RPC stream); banner goes to stderr.
  process.stderr.write("jobber-mcp: stdio server ready\n");
}

main().catch((err) => {
  process.stderr.write(
    `jobber-mcp failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
