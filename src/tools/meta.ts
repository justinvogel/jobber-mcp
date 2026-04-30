import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JobberClient } from "../jobber-client.js";
import { TokenManager, authorizeInteractive } from "../auth.js";
import { okJson, errorResult } from "./helpers.js";

export function registerMetaTools(
  server: McpServer,
  client: JobberClient,
  tokens: TokenManager,
): void {
  // Raw GraphQL passthrough — covers anything the named tools don't.
  server.registerTool(
    "jobber_graphql",
    {
      title: "Raw Jobber GraphQL",
      description:
        "Execute an arbitrary GraphQL query or mutation against the Jobber API. Use this for any operation not covered by the named tools (introspection, custom selections, unsupported mutations, etc.).",
      inputSchema: {
        query: z.string().describe("The GraphQL query or mutation document."),
        variables: z
          .record(z.any())
          .optional()
          .describe("Variables object for the query."),
        operationName: z
          .string()
          .optional()
          .describe("Operation name if the document defines multiple."),
      },
    },
    async (args: {
      query: string;
      variables?: Record<string, unknown>;
      operationName?: string;
    }) => {
      try {
        const data = await client.request(args.query, args.variables, {
          operationName: args.operationName,
        });
        return okJson(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // On-demand reauthorization (useful if the stored refresh token is revoked).
  server.registerTool(
    "jobber_authorize",
    {
      title: "Run Jobber OAuth flow",
      description:
        "Open a browser to complete Jobber's OAuth 2.0 authorization-code flow and persist the resulting tokens. Run this once on first setup, or any time refreshing fails.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await authorizeInteractive(tokens);
        return okJson({
          success: true,
          expiresAt: new Date(result.tokens.expires_at).toISOString(),
          scope: result.scope,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // Token/connection status for quick sanity checks from the client.
  server.registerTool(
    "jobber_auth_status",
    {
      title: "Jobber auth status",
      description: "Report whether valid Jobber OAuth tokens are on file, their expiry, and scope.",
      inputSchema: {},
    },
    async () => {
      try {
        const stored = await tokens.load();
        if (!stored) {
          return okJson({ authenticated: false, message: "No tokens on file. Run jobber_authorize." });
        }
        return okJson({
          authenticated: true,
          expiresAt: new Date(stored.expires_at).toISOString(),
          isExpired: Date.now() >= stored.expires_at,
          scope: stored.scope,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // Minimal introspection helper — surfaces the schema summary in one call.
  server.registerTool(
    "jobber_introspect",
    {
      title: "Introspect Jobber schema",
      description:
        "Run a GraphQL introspection query and return all types, queries, and mutations the current API version exposes.",
      inputSchema: {
        depth: z
          .enum(["summary", "full"])
          .optional()
          .describe("`summary` (default) lists top-level types and their fields; `full` returns the deep introspection payload."),
      },
    },
    async (args: { depth?: "summary" | "full" }) => {
      try {
        const depth = args.depth ?? "summary";
        const query =
          depth === "full"
            ? FULL_INTROSPECTION
            : SUMMARY_INTROSPECTION;
        const data = await client.request(query, {}, { operationName: "JobberIntrospection" });
        return okJson(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

const SUMMARY_INTROSPECTION = `
  query JobberIntrospection {
    __schema {
      queryType { name fields { name description args { name type { name kind ofType { name kind } } } type { name kind ofType { name kind } } } }
      mutationType { name fields { name description args { name type { name kind ofType { name kind } } } type { name kind ofType { name kind } } } }
    }
  }
`;

const FULL_INTROSPECTION = `
  query JobberIntrospection {
    __schema {
      queryType { name }
      mutationType { name }
      types {
        kind name description
        fields(includeDeprecated: true) {
          name description
          args { name description type { ...TypeRef } defaultValue }
          type { ...TypeRef }
          isDeprecated deprecationReason
        }
        inputFields { name description type { ...TypeRef } defaultValue }
        interfaces { ...TypeRef }
        enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
        possibleTypes { ...TypeRef }
      }
    }
  }
  fragment TypeRef on __Type {
    kind name
    ofType { kind name
      ofType { kind name
        ofType { kind name
          ofType { kind name
            ofType { kind name
              ofType { kind name
                ofType { kind name }
              }
            }
          }
        }
      }
    }
  }
`;
