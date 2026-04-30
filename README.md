# Jobber MCP

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing [Jobber](https://getjobber.com)'s GraphQL API to any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.) — read + write coverage of every entity, OAuth 2.0 with auto-refresh, and both stdio and Streamable HTTP transports for hosted deployments.

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#requirements)

## What's in the box

**~120 MCP tools** covering every public Jobber mutation + read for the 13 core data types:

- **Read:** list + get for `Client`, `Request`, `Job`, `Quote`, `Invoice`, `Assessment`, `Expense`, `ProductOrService`, `TimeSheetEntry`, `Property`, `User`, `Visit` + `Account` singleton
- **Write:** create / update / archive / unarchive on Clients; full lifecycle on Requests, Jobs, Quotes, Invoices, Visits, Assessments, Expenses, Properties, Tasks, Custom Fields, Webhook Endpoints, Vehicles
- **Status transitions:** `jobClose`/`jobReopen`, `invoiceMarkAsSent`/`invoiceClose`/`invoiceReopen`/`invoiceUnmarkBadDebt`, `requestArchive`/`unarchive`, `assessmentComplete`/`uncomplete`, `visitComplete`/`uncomplete`
- **Line items:** add/edit/delete/reorder on Jobs, Quotes, Requests, Visits
- **Notes:** add/edit/delete on Clients, Jobs, Quotes, Requests, Invoices + file attachments
- **Catalog:** create/edit Products & Services
- **Webhooks:** subscribe/unsubscribe via `webhookEndpointCreate` / `webhookEndpointDelete`
- **Meta:** `jobber_graphql` (raw passthrough), `jobber_authorize`, `jobber_auth_status`, `jobber_introspect`

### Two transports

- **stdio** (`jobber-mcp`) — for local MCP clients (Claude Desktop, Claude Code)
- **Streamable HTTP** (`jobber-mcp-http`) — for hosted deployments (Railway, Render, Fly.io, Vercel, etc.)

Single MCP server class, swappable transport — same tool surface in both.

## Quick start (local / stdio)

### 1. Create a Jobber developer app

1. Sign in at <https://developer.getjobber.com/>.
2. Create an App.
3. Set the **Redirect URI** to `http://localhost:8976/callback` (or any free local URL).
4. Enable the **scopes** you need. For full coverage, check every `read_*` and `write_*` scope.
5. Copy the **Client ID** and **Client Secret**.

### 2. Install

```bash
git clone https://github.com/justinvogel/jobber-mcp.git
cd jobber-mcp
npm install
cp .env.example .env
# Paste your Client ID + Secret into .env
npm run build
```

### 3. Authorize

```bash
npm run auth
```

This spins up a one-shot HTTP listener, opens your browser to Jobber's consent screen, captures the `code` on redirect, exchanges it for tokens, and writes them to `.jobber-tokens.json` (chmod 600, gitignored). Tokens auto-refresh thereafter.

### 4. Wire it into an MCP client

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jobber": {
      "command": "node",
      "args": ["/absolute/path/to/jobber-mcp/dist/index.js"],
      "env": {
        "JOBBER_CLIENT_ID": "...",
        "JOBBER_CLIENT_SECRET": "..."
      }
    }
  }
}
```

**Claude Code** (`~/.claude.json`):

```json
{
  "mcpServers": {
    "jobber": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/jobber-mcp/dist/index.js"],
      "env": {
        "JOBBER_CLIENT_ID": "...",
        "JOBBER_CLIENT_SECRET": "...",
        "JOBBER_TOKEN_FILE": "/absolute/path/to/jobber-mcp/.jobber-tokens.json"
      }
    }
  }
}
```

## Hosted deployment (HTTP)

The HTTP entry point implements MCP's [Streamable HTTP transport](https://modelcontextprotocol.io/specification/draft/basic/transports#streamable-http) — POST/GET on `/mcp`, plus `GET /healthz`.

### Run locally

```bash
JOBBER_MCP_AUTH_TOKEN=secret-shared-token \
JOBBER_CLIENT_ID=... \
JOBBER_CLIENT_SECRET=... \
PORT=3000 \
npm run start:http
```

Then configure your MCP client to `POST /mcp` with `Authorization: Bearer secret-shared-token`.

### Docker

```bash
docker build -t jobber-mcp .
docker run -p 3000:3000 \
  -e JOBBER_CLIENT_ID=... \
  -e JOBBER_CLIENT_SECRET=... \
  -e JOBBER_MCP_AUTH_TOKEN=... \
  -v jobber-tokens:/data \
  jobber-mcp
```

The image runs as non-root, exposes port 3000, persists tokens to `/data` (mount a volume), and includes a `/healthz` healthcheck.

### Railway / Render / Fly.io

Point your platform at this repo. Set the same env vars + persist the volume mount. The default `CMD` runs the HTTP transport.

## Usage examples

### Read

```
jobber_list_clients          { first: 25, sort: [{ key: "CREATED_AT", direction: "DESCENDING" }] }
jobber_get_job               { id: "Z2lkOi8vSm9iYmVyL0pvYi8xMjM=", fields: "id total lineItems(first: 50) { nodes { name quantity unitCost } }" }
jobber_list_invoices         { filter: { invoiceStatus: ["PAID"] }, first: 50 }
```

### Write — common operations

```
jobber_create_client         { input: { firstName: "Ada", lastName: "Lovelace", emails: [{ primary: true, address: "ada@example.com", description: "MAIN" }] } }
jobber_create_job            { input: { clientId: "...", propertyId: "...", title: "AV Install", jobType: "ONE_OFF", lineItems: [...] } }
jobber_create_visit          { jobId: "...", input: { startAt: "2026-05-01T09:00:00Z", endAt: "...", title: "TV mount", assignedUserIds: ["..."] } }
jobber_complete_visit        { visitId: "..." }
jobber_mark_invoice_sent     { id: "..." }
jobber_close_job             { jobId: "...", input: { closeAllVisits: true } }
```

### Subscribing to webhooks

```
jobber_create_webhook_endpoint  { input: { url: "https://your-server/webhooks/jobber", topics: ["CLIENT_CREATE", "INVOICE_PAID"] } }
```

### Custom GraphQL via passthrough

```
jobber_graphql  { query: "query { payments(first: 5) { nodes { id amount paymentDate } } }" }
```

## Programmatic use

Beyond MCP, the package exposes its core building blocks for direct use:

```ts
import { createJobberMcpServer } from "jobber-mcp";
import { JobberClient } from "jobber-mcp/client";
import { TokenManager, authorizeInteractive } from "jobber-mcp/auth";

// Direct GraphQL (no MCP):
const client = new JobberClient(new TokenManager());
const data = await client.request(`{ account { id name } }`);
```

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JOBBER_CLIENT_ID` | yes | — | OAuth client ID from your Jobber developer app |
| `JOBBER_CLIENT_SECRET` | yes | — | OAuth client secret |
| `JOBBER_REDIRECT_URI` | no | `http://localhost:8976/callback` | Must match your Jobber app's redirect URI |
| `JOBBER_API_VERSION` | no | `2025-01-20` | Sent as `X-JOBBER-GRAPHQL-VERSION` |
| `JOBBER_TOKEN_FILE` | no | `./.jobber-tokens.json` | Where persisted tokens live |
| `JOBBER_SCOPES` | no | (whatever your app has) | Scopes to request during auth |
| `PORT` | no (HTTP only) | `3000` | HTTP listen port |
| `JOBBER_MCP_AUTH_TOKEN` | no (HTTP only) | — | Bearer token clients must send. **Strongly recommended for any internet-reachable deployment.** |

## Architecture

```
src/
├── index.ts              # stdio entry (`jobber-mcp` bin)
├── http.ts               # Streamable HTTP entry (`jobber-mcp-http` bin)
├── server.ts             # createJobberMcpServer() — transport-agnostic factory
├── auth-cli.ts           # CLI wrapper around the OAuth flow
├── auth.ts               # TokenManager + authorizeInteractive
├── config.ts             # Env parsing + Jobber endpoints
├── jobber-client.ts      # GraphQL client w/ 401-refresh-retry + throttle
└── tools/
    ├── helpers.ts                # List/get builders, result formatters
    ├── queries.ts                # 12× list + 12× get + account
    ├── mutations.ts              # Thin wrapper around the registry
    ├── mutation-registry.ts      # Builds tools from MutationDescriptor[]
    ├── mutation-defs.ts          # 90+ mutation descriptors
    ├── meta.ts                   # jobber_graphql, _authorize, _auth_status, _introspect
    └── index.ts                  # Aggregator
```

## Development

```bash
npm run dev              # tsx-watching stdio server
npm run dev:http         # tsx-watching HTTP server
npm test                 # vitest
npm run test:watch
npm run typecheck
npm run build            # tsc → dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding mutations / queries.

## Troubleshooting

- **"No Jobber OAuth tokens found"** — run `npm run auth`, or call the `jobber_authorize` MCP tool from your client.
- **"Throttled" GraphQL errors** — Jobber uses cost-based rate limits. The client retries automatically with backoff (up to 8 attempts). For long-running scripts, batch requests via aliasing in a single GraphQL call rather than serial calls. See `examples/data-ops/_phone_plan.mjs` for a paced-pagination example.
- **Token refresh fails** — refresh token revoked. Delete `.jobber-tokens.json` and re-run `npm run auth`.
- **`<Node>FilterAttributes` is not defined** — Jobber renamed a filter input type. Bump `JOBBER_API_VERSION`, or fall back to `jobber_graphql` with the correct type name.
- **HTTP transport returns 401** — `JOBBER_MCP_AUTH_TOKEN` is set; ensure your client sends a matching `Authorization: Bearer <token>` header.

## License

MIT — see [LICENSE](LICENSE).
