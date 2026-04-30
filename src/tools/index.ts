import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JobberClient } from "../jobber-client.js";
import { TokenManager } from "../auth.js";
import { registerQueryTools } from "./queries.js";
import { registerMutationTools } from "./mutations.js";
import { registerMetaTools } from "./meta.js";

export function registerAllTools(
  server: McpServer,
  client: JobberClient,
  tokens: TokenManager,
): void {
  registerQueryTools(server, client);
  registerMutationTools(server, client);
  registerMetaTools(server, client, tokens);
}
