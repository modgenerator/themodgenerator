/**
 * Phase F — Tests & Guarantees for Canonical Interpretation Layer.
 * Asserts: same intent → same archetype; unknown → stable fallback; no randomness;
 * user-provided bypass (when implemented); Tier 1 invariants preserved.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolveArchetype,
  hasUserProvidedAsset,
  ARCHETYPES,
  getCanonicalMaterial,
  type IntentSignals,
  type ArchetypeId,
} from "./canonical-interpretation.js";

function signals(
  contentId: string,
  category: "item" | "block",
  material: string,
  name?: string
): IntentSignals {
  return { contentId, name, category, material };
}

describe("resolveArchetype", () => {
  it("same intent signals yield same archetype (determinism)", () => {
    const s = signals("magic_wand", "item", "generic", "Magic Wand");
    const a = resolveArchetype(s);
    const b = resolveArchetype(s);
    assert.strictEqual(a, b);
  });

  it('"magic wand" + item → magical_wand', () => {
    assert.strictEqual(
      resolveArchetype(signals("magic_wand", "item", "generic", "Magic Wand")),
      "magical_wand"
    );
    assert.strictEqual(
      resolveArchetype(signals("wand", "item", "generic")),
      "magical_wand"
    );
  });

  it('"crystal" + gem material → crystal_object', () => {
    assert.strictEqual(
      resolveArchetype(signals("crystal_block", "block", "gem", "Crystal Block")),
      "crystal_object"
    );
    assert.strictEqual(
      resolveArchetype(signals("ruby_block", "block", "gem")),
      "crystal_object"
    );
  });

  it('"tech" + metal → tech_device (item) or industrial_block (block)', () => {
    assert.strictEqual(
      resolveArchetype(signals("tech_device", "item", "metal")),
      "tech_device"
    );
    assert.strictEqual(
      resolveArchetype(signals("industrial_cube", "block", "metal")),
      "industrial_block"
    );
  });

  it("tech/industrial compound ids and generic names map to tech archetypes (generic keyword)", () => {
    assert.strictEqual(resolveArchetype(signals("tech_gadget", "item", "generic")), "tech_device");
    assert.strictEqual(resolveArchetype(signals("industrial_machine", "block", "generic")), "industrial_block");
  });

  it("unknown intent → stable fallback archetype (creative_item / creative_block)", () => {
    assert.strictEqual(
      resolveArchetype(signals("thing", "item", "generic")),
      "creative_item"
    );
    assert.strictEqual(
      resolveArchetype(signals("thing", "block", "generic")),
      "creative_block"
    );
  });

  it("always returns a valid ArchetypeId", () => {
    const ids: ArchetypeId[] = [
      "magical_wand",
      "ancient_relic",
      "tech_device",
      "crystal_object",
      "organic_material",
      "corrupted_item",
      "industrial_block",
      "mystical_block",
      "creative_item",
      "creative_block",
    ];
    const result = resolveArchetype(signals("xyz_unknown", "item", "generic"));
    assert.ok(ids.includes(result), `archetype ${result} must be in ARCHETYPES`);
  });
});

describe("hasUserProvidedAsset", () => {
  it("returns false in Tier 1 (no user asset fields in spec yet)", () => {
    assert.strictEqual(hasUserProvidedAsset({}, "ruby", "item"), false);
    assert.strictEqual(hasUserProvidedAsset({}, "ruby_block", "block"), false);
  });
});

describe("ARCHETYPES", () => {
  it("every archetype has required fields", () => {
    for (const [id, def] of Object.entries(ARCHETYPES)) {
      assert.ok(def.intendedFeel, `${id}: intendedFeel`);
      assert.ok(def.interactionStyle, `${id}: interactionStyle`);
      assert.ok(def.visualExpectations, `${id}: visualExpectations`);
      assert.ok(def.behaviorExpectations, `${id}: behaviorExpectations`);
      assert.strictEqual(typeof def.emissiveHint, "boolean", `${id}: emissiveHint`);
      assert.strictEqual(typeof def.translucencyHint, "boolean", `${id}: translucencyHint`);
      assert.strictEqual(typeof def.glowHint, "boolean", `${id}: glowHint`);
    }
  });
});

describe("getCanonicalMaterial", () => {
  it("is deterministic", () => {
    assert.strictEqual(getCanonicalMaterial("ruby"), getCanonicalMaterial("ruby"));
    assert.strictEqual(getCanonicalMaterial("  OAK  "), "wood");
  });
  it("unknown material → generic", () => {
    assert.strictEqual(getCanonicalMaterial("unknown_xyz"), "generic");
  });
});
