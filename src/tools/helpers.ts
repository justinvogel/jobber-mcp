import { z } from "zod";
import { JobberClient, JobberApiError } from "../jobber-client.js";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export const okJson = (data: unknown): ToolResult => {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text }],
    structuredContent:
      data !== null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { value: data },
  };
};

export const errorResult = (err: unknown): ToolResult => {
  if (err instanceof JobberApiError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: err.message,
              status: err.status,
              graphqlErrors: err.errors,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
    isError: true,
  };
};

// Pagination args shared across every list query.
export const connectionArgs = {
  first: z.number().int().positive().max(100).optional().describe(
    "Number of items to return (default 25, max 100).",
  ),
  after: z.string().optional().describe("Cursor for forward pagination."),
  filter: z
    .record(z.any())
    .optional()
    .describe(
      "GraphQL filter object passed to the connection's `filter:` argument. Shape is specific to each node type — see Jobber's API reference.",
    ),
  sort: z
    .array(z.record(z.any()))
    .optional()
    .describe("Array of sort inputs passed to the connection's `sort:` argument."),
  fields: z
    .string()
    .optional()
    .describe(
      "Override the default node selection set. Provide a raw GraphQL selection (without the surrounding braces), e.g. `id firstName emails { address }`.",
    ),
};

export type ConnectionArgs = {
  first?: number;
  after?: string;
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown>[];
  fields?: string;
};

export interface ListQueryConfig {
  /** Name of the connection field on Query, e.g. "clients". */
  connection: string;
  /** Default selection set for nodes (sans braces). */
  defaultFields: string;
  /**
   * Filter input type name as declared in Jobber's schema, e.g. "ClientFilterAttributes".
   * If omitted, the filter arg is not wired into the query (passing `filter` will be ignored).
   */
  filterType?: string;
  /**
   * Sort input type name as declared in Jobber's schema, e.g. "ClientSortInput".
   * Passed as a list type `[${sortType}!]`.
   */
  sortType?: string;
  /** Whether the connection includes `totalCount`. Default true. */
  hasTotalCount?: boolean;
}

/** Build and execute a connection list query, only wiring filter/sort when provided. */
export async function runListQuery(
  client: JobberClient,
  cfg: ListQueryConfig,
  args: ConnectionArgs,
): Promise<unknown> {
  const fields = args.fields ?? cfg.defaultFields;
  const argDecls: string[] = ["$first: Int", "$after: String"];
  const argPass: string[] = ["first: $first", "after: $after"];
  const vars: Record<string, unknown> = {
    first: args.first ?? 25,
    after: args.after,
  };
  if (args.filter && cfg.filterType) {
    argDecls.push(`$filter: ${cfg.filterType}`);
    argPass.push("filter: $filter");
    vars.filter = args.filter;
  }
  if (args.sort && cfg.sortType) {
    argDecls.push(`$sort: [${cfg.sortType}!]`);
    argPass.push("sort: $sort");
    vars.sort = args.sort;
  }
  const totalCount = cfg.hasTotalCount === false ? "" : "totalCount";
  const query = `
    query List_${cfg.connection}(${argDecls.join(", ")}) {
      ${cfg.connection}(${argPass.join(", ")}) {
        ${totalCount}
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        nodes { ${fields} }
      }
    }
  `;
  return client.request(query, vars, { operationName: `List_${cfg.connection}` });
}

export interface SingleQueryConfig {
  /** Query field name, e.g. "client". */
  queryField: string;
  /** Default selection set (sans braces). */
  defaultFields: string;
  /** ID argument type. Jobber generally uses `EncodedId!`. */
  idType?: string;
}

export const getArgs = {
  id: z.string().describe("Jobber node ID (GraphQL global ID)."),
  fields: z
    .string()
    .optional()
    .describe("Override the default selection set. Provide a raw GraphQL selection without braces."),
};

export async function runGetQuery(
  client: JobberClient,
  cfg: SingleQueryConfig,
  args: { id: string; fields?: string },
): Promise<unknown> {
  const fields = args.fields ?? cfg.defaultFields;
  const idType = cfg.idType ?? "EncodedId!";
  const query = `
    query Get_${cfg.queryField}($id: ${idType}) {
      ${cfg.queryField}(id: $id) { ${fields} }
    }
  `;
  return client.request(query, { id: args.id }, { operationName: `Get_${cfg.queryField}` });
}
