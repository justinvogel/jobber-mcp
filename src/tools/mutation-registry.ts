import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import { JobberClient } from "../jobber-client.js";
import { okJson, errorResult } from "./helpers.js";

// ──────────────────────────────────────────────────────────────────────────────
// Declarative descriptor for a single Jobber mutation.
//
// Why this exists: Jobber has 100+ mutations with broadly similar shapes —
// take some args, send them, return a payload + userErrors. Writing each as
// its own MCP tool is repetitive. The registry below turns a small descriptor
// into a fully-wired tool with a Zod input schema, the GraphQL query string,
// and the result handler.
// ──────────────────────────────────────────────────────────────────────────────

export interface MutationArg {
  /** Argument name as it appears on the mutation field. */
  name: string;
  /** GraphQL type literal, e.g. "EncodedId!", "JobCreateAttributes!", "[EncodedId!]!". */
  type: string;
  /** Short user-facing description. */
  description?: string;
}

export interface MutationDescriptor {
  /** MCP tool name, e.g. "jobber_create_job". */
  tool: string;
  /** Short title shown to the LLM. */
  title: string;
  /** Longer description, including notes about the GraphQL input shape. */
  description: string;
  /** GraphQL mutation field name (camelCase), e.g. "jobCreate". */
  mutation: string;
  /** Args in the order they should appear in the query. */
  args: MutationArg[];
  /**
   * Selection set inside the payload, NOT including userErrors. Use this to
   * pull back the affected entity. Example: "client { id firstName lastName }".
   * If omitted, the payload is queried with just `__typename`.
   */
  payload?: string;
  /** Set false if the mutation's payload doesn't include `userErrors`. Default true. */
  hasUserErrors?: boolean;
}

const ID_TYPES = new Set(["EncodedId", "ID", "String"]);

function zodForGqlType(type: string): z.ZodTypeAny {
  // Strip outer "!" — required-ness is handled separately by zod via .optional() if not present.
  const required = type.endsWith("!");
  const inner = required ? type.slice(0, -1) : type;
  const isList = inner.startsWith("[") && inner.endsWith("]");
  const elem = isList ? inner.slice(1, -1) : inner;
  const elemRequired = elem.endsWith("!");
  const elemBase = elemRequired ? elem.slice(0, -1) : elem;

  let leaf: z.ZodTypeAny;
  if (isList) {
    const elemSchema = ID_TYPES.has(elemBase)
      ? z.string()
      : z.record(z.any());
    leaf = z.array(elemSchema);
  } else if (ID_TYPES.has(elemBase) || elemBase === "Boolean" || elemBase === "Int" || elemBase === "Float") {
    if (elemBase === "Boolean") leaf = z.boolean();
    else if (elemBase === "Int" || elemBase === "Float") leaf = z.number();
    else leaf = z.string();
  } else {
    // Treat all input objects as opaque records — Jobber's GraphQL server validates them.
    leaf = z.record(z.any());
  }
  return required ? leaf : leaf.optional();
}

function buildInputSchema(args: MutationArg[]): ZodRawShape {
  const shape: ZodRawShape = {};
  for (const arg of args) {
    shape[arg.name] = arg.description
      ? zodForGqlType(arg.type).describe(arg.description)
      : zodForGqlType(arg.type);
  }
  return shape;
}

function buildQuery(d: MutationDescriptor): string {
  const declarations = d.args.map((a) => `$${a.name}: ${a.type}`).join(", ");
  const passes = d.args.map((a) => `${a.name}: $${a.name}`).join(", ");
  const userErrors = d.hasUserErrors === false ? "" : "userErrors { message path }";
  const payload = d.payload ?? "__typename";
  return `
    mutation Run_${d.mutation}(${declarations}) {
      ${d.mutation}(${passes}) {
        ${payload}
        ${userErrors}
      }
    }
  `;
}

export function registerDescribedMutations(
  server: McpServer,
  client: JobberClient,
  descriptors: MutationDescriptor[],
): void {
  for (const d of descriptors) {
    const query = buildQuery(d);
    const schema = buildInputSchema(d.args);
    server.registerTool(
      d.tool,
      { title: d.title, description: d.description, inputSchema: schema },
      async (args: Record<string, unknown>) => {
        try {
          const data = await client.request(query, args, {
            operationName: `Run_${d.mutation}`,
          });
          return okJson(data);
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }
}
