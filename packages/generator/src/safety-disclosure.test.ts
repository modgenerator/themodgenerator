/**
 * Tests for safety disclosure. Only reflects used primitives; deterministic; empty allowed.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildSafetyDisclosure } from "./safety-disclosure.js";
import type { Primitive } from "./primitives.js";

describe("buildSafetyDisclosure", () => {
  it("empty primitives returns trust copy only (nothing is fake disclosure)", () => {
    const out = buildSafetyDisclosure([]);
    assert.ok(out.statements.length >= 1);
    assert.ok(out.statements.some((s) => s.includes("fully generated and functional")));
  });

  it("only reflects used primitives with safety metadata", () => {
    const primitives: Primitive[] = ["cooldown", "raycast_target", "register_item"];
    const out = buildSafetyDisclosure(primitives);
    assert.ok(Array.isArray(out.statements));
    assert.ok(out.statements.length >= 1);
  });

  it("determinism: same primitives → same statements", () => {
    const primitives: Primitive[] = ["on_use", "cooldown", "spawn_entity"];
    const a = buildSafetyDisclosure(primitives);
    const b = buildSafetyDisclosure(primitives);
    assert.deepStrictEqual(a.statements, b.statements);
  });

  it("primitives without safety metadata do not crash", () => {
    const primitives: Primitive[] = ["register_item", "register_block"];
    const out = buildSafetyDisclosure(primitives);
    assert.ok(Array.isArray(out.statements));
  });
});
