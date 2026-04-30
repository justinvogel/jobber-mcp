import { describe, it, expect } from "vitest";
import { MUTATION_DEFS } from "../tools/mutation-defs.js";

describe("MUTATION_DEFS catalog", () => {
  it("has at least 90 mutations registered", () => {
    expect(MUTATION_DEFS.length).toBeGreaterThanOrEqual(90);
  });

  it("every tool name is unique", () => {
    const names = MUTATION_DEFS.map((d) => d.tool);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it("every tool name matches /^jobber_[a-z_]+$/", () => {
    for (const d of MUTATION_DEFS) {
      expect(d.tool).toMatch(/^jobber_[a-z0-9_]+$/);
    }
  });

  it("every descriptor has a non-empty description", () => {
    for (const d of MUTATION_DEFS) {
      expect(d.description.length).toBeGreaterThan(5);
    }
  });

  it("every arg type ends with a clear GraphQL type expression", () => {
    for (const d of MUTATION_DEFS) {
      for (const a of d.args) {
        // Should have either a type name (with optional !) or a list expression.
        expect(a.type).toMatch(/^[\[\]A-Za-z_!0-9]+$/);
      }
    }
  });

  it("covers all 13 advertised data types", () => {
    const tools = MUTATION_DEFS.map((d) => d.tool);
    // For each entity, at least one mutation should mention it.
    const entities = [
      "client", "request", "job", "quote", "invoice",
      "assessment", "expense", "product_or_service", "property",
      "visit", "task", "user", "webhook",
    ];
    for (const e of entities) {
      const has = tools.some((t) => t.includes(e));
      expect(has, `missing tool for entity "${e}"`).toBe(true);
    }
  });
});
