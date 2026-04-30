#!/usr/bin/env node
import { TokenManager, authorizeInteractive } from "./auth.js";

async function main() {
  const manager = new TokenManager();
  const result = await authorizeInteractive(manager, {
    logger: (msg) => console.error(msg),
  });
  console.error("✓ Jobber OAuth complete.");
  console.error(`  Access token expires at: ${new Date(result.tokens.expires_at).toISOString()}`);
  if (result.scope) console.error(`  Scopes: ${result.scope}`);
}

main().catch((err) => {
  console.error("Auth failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
