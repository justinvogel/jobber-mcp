# Contributing

Thanks for considering a contribution. This connector aims to be the de-facto MCP server for [Jobber](https://getjobber.com) — read + write coverage of every public mutation, multiple transports, and a clean install path for hosted deployments.

## Local setup

```bash
git clone https://github.com/justinvogel/jobber-mcp.git
cd jobber-mcp
npm install
cp .env.example .env
# Fill in JOBBER_CLIENT_ID + JOBBER_CLIENT_SECRET (from your Jobber developer app)
npm run auth        # one-shot OAuth flow, writes .jobber-tokens.json
npm run typecheck
npm test
```

## Project layout

```
src/
├── index.ts              # stdio entry point (default `jobber-mcp` bin)
├── http.ts               # Streamable HTTP entry point (`jobber-mcp-http`)
├── server.ts             # Wires McpServer + tools (transport-agnostic)
├── auth.ts               # TokenManager + OAuth flow
├── auth-cli.ts           # CLI wrapper around the OAuth flow
├── config.ts             # Env parsing + endpoints
├── jobber-client.ts      # fetch-based GraphQL client w/ 401-refresh-retry
├── tools/
│   ├── index.ts                # Aggregator
│   ├── helpers.ts              # Shared list/get builders, result formatters
│   ├── queries.ts              # 12× list + 12× get + account
│   ├── mutations.ts             # Thin wrapper around mutation-registry
│   ├── mutation-registry.ts    # Descriptor type + `registerDescribedMutations`
│   ├── mutation-defs.ts        # 90+ mutation descriptors
│   └── meta.ts                 # jobber_graphql, _authorize, _auth_status, _introspect
├── __tests__/
│   ├── auth.test.ts
│   ├── jobber-client.test.ts
│   └── mutation-registry.test.ts
└── examples/
    └── data-ops/         # Reference scripts for bulk data cleanup (not published)
```

## Adding a new mutation

The 100+ Jobber mutations are wired declaratively. To add one:

1. Open `src/tools/mutation-defs.ts`.
2. Add a `MutationDescriptor` to the `MUTATION_DEFS` array:

```ts
{
  tool: "jobber_short_action_name",
  title: "Human-readable title",
  description: "What this does + a hint about the input shape.",
  mutation: "graphqlMutationFieldName",
  args: [
    { name: "argName", type: "GraphQLType!", description: "..." },
  ],
  payload: "entityName { id ... }",
}
```

3. The registry will auto-build the GraphQL query, Zod input schema, and tool handler. No further wiring required.

## Adding a new query (list or get)

Edit `src/tools/queries.ts`:

- For lists, add an entry to the `lists` array with the GraphQL connection name + filter/sort type names (these follow Jobber's `<Node>FilterAttributes` / `<Node>SortInput` pattern).
- For single-entity gets, add an entry to the `gets` array.
- The default node selection set is in the `FIELDS` map at the top of the file. Keep selections conservative — callers can always pass a `fields:` override or use `jobber_graphql` for custom selections.

## Style

- Imports: ESM only.
- Comments: keep them sparse but useful — explain *why* (constraints, gotchas, schema surprises) not *what*.
- Errors: throw `JobberApiError` from anything that hits Jobber's API; the tool handlers convert it to a structured MCP `isError: true` result.
- Tests: use vitest. Mock `globalThis.fetch` for client tests; never call the real Jobber API in unit tests.

## Releasing

This package is published from CI on tags. To cut a release:

1. Bump `version` in `package.json`.
2. Update `CHANGELOG.md`.
3. `git tag vX.Y.Z && git push --tags`.
4. CI runs `npm publish` once green.

## Code of conduct

Be kind. The Jobber community is small and focused — this is a tool for actual home-service businesses, and we're trying to make their day-to-day better.
