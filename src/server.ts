import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TokenManager } from "./auth.js";
import { JobberClient } from "./jobber-client.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Build a fully-wired MCP server. Transport is the caller's choice — connect
 * stdio for `jobber-mcp`, or use the HTTP entry point for hosted deployments.
 */
export function createJobberMcpServer(): {
  server: McpServer;
  tokens: TokenManager;
  client: JobberClient;
} {
  const tokens = new TokenManager();
  const client = new JobberClient(tokens);
  const server = new McpServer({
    name: "jobber-mcp",
    version: "0.2.0",
  });
  registerAllTools(server, client, tokens);
  return { server, tokens, client };
}
