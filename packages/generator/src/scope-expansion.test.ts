/**
 * Scope expansion: intent → full scope units. Deterministic; no minimizing.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { expandIntentToScope, expandPromptToScope } from "./scope-expansion.js";
import type { UserIntent } from "./execution-plan.js";

describe("expandIntentToScope", () => {
  it("magic wand that shoots lightning → item + item_behavior + entity", () => {
    const intent: UserIntent = {
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    };
    const scope = expandIntentToScope(intent);
    assert.ok(scope.includes("item"), "must include item");
    assert.ok(scope.includes("item_behavior"), "must include item_behavior");
    assert.ok(scope.includes("entity"), "must include entity");
  });

  it("new dimension → dimension + biome + structure + entity + world_rule", () => {
    const intent: UserIntent = {
      name: "Custom World",
      description: "new dimension with biomes",
      category: "item",
    };
    const scope = expandIntentToScope(intent);
    assert.ok(scope.includes("dimension"), "must include dimension");
    assert.ok(scope.includes("biome"), "must include biome");
    assert.ok(scope.includes("structure"), "must include structure");
    assert.ok(scope.includes("entity"), "must include entity");
    assert.ok(scope.includes("world_rule"), "must include world_rule");
  });

  it("RPG world with quests → dimension + biomes + npc + quest + structure + entity", () => {
    const intent: UserIntent = {
      name: "RPG World",
      description: "RPG world with quests and NPCs",
      category: "item",
    };
    const scope = expandIntentToScope(intent);
    assert.ok(scope.includes("dimension"), "must include dimension");
    assert.ok(scope.includes("biome"), "must include biome");
    assert.ok(scope.includes("npc"), "must include npc");
    assert.ok(scope.includes("quest"), "must include quest");
    assert.ok(scope.includes("structure"), "must include structure");
    assert.ok(scope.includes("entity"), "must include entity");
  });

  it("simple item without behavior → item only", () => {
    const intent: UserIntent = {
      name: "Ruby Ingot",
      description: "",
      category: "item",
    };
    const scope = expandIntentToScope(intent);
    assert.deepStrictEqual(scope, ["item"]);
  });

  it("is deterministic", () => {
    const intent: UserIntent = {
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    };
    const a = expandIntentToScope(intent);
    const b = expandIntentToScope(intent);
    assert.deepStrictEqual(a, b);
  });
});

describe("expandPromptToScope", () => {
  it("prompt with dimension expands to dimension scope", () => {
    const scope = expandPromptToScope("I want a new dimension with structures");
    assert.ok(scope.includes("dimension"));
    assert.ok(scope.includes("structure"));
  });
});
