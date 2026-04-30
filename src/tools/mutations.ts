import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JobberClient } from "../jobber-client.js";
import { registerDescribedMutations } from "./mutation-registry.js";
import { MUTATION_DEFS } from "./mutation-defs.js";

/**
 * Register every Jobber mutation as an MCP tool. Definitions live in
 * mutation-defs.ts; the registry in mutation-registry.ts builds the GraphQL
 * query, Zod input schema, and tool handler from each descriptor.
 */
export function registerMutationTools(server: McpServer, client: JobberClient): void {
  registerDescribedMutations(server, client, MUTATION_DEFS);
}
