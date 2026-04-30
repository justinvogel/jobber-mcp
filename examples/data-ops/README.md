# examples/data-ops

This folder is reserved for ad-hoc data-ops scripts you might write while using `jobber-mcp` programmatically — bulk imports, cleanup passes, migrations, and so on.

The recommended pattern: write a small ESM script that imports the package's `JobberClient` and `TokenManager` directly, then drives whatever GraphQL calls you need.

```ts
// my-script.mjs
import { TokenManager } from "jobber-mcp/auth";
import { JobberClient } from "jobber-mcp/client";

const client = new JobberClient(new TokenManager());

const res = await client.request(
  `query { clients(first: 5) { nodes { id firstName lastName } } }`,
);
console.log(res.clients.nodes);
```

Run with:

```bash
node my-script.mjs
```

## Tips for bulk operations

- **Pace your calls.** Jobber rate-limits with a cost-based system. Sleep ~1–3 seconds between mutations.
- **Retry on `THROTTLED`.** The `JobberClient` already retries 401s automatically; for throttle errors, wrap your loop with exponential backoff.
- **Use aliasing for parallel reads.** `query { p1: clients(first: 100) { ... } p2: clients(first: 100, after: "MTAw") { ... } }` is one API call.
- **Always preview before writing.** Build a "plan" JSON file, eyeball it, then push.
- **Keep tokens out of git.** `.jobber-tokens.json` should already be gitignored — never commit it.
- **Keep data files out of git.** Anything you export from Jobber (CSVs, snapshot JSON) belongs in `.gitignore`.

## Security note

This folder is `.gitignore`d for `_*.mjs` and `_*.json` files (any name starting with an underscore) — that pattern is a convention here for "scratch / local-only" scripts. Use it for anything containing customer-specific data so you don't accidentally publish it.
