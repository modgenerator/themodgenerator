import { describe, it } from "node:test";
import assert from "node:assert";
import { expandModSpecV2 } from "./rule-engine.js";
import { rubyOreModSpecV2 } from "./examples/ruby-ore-modspec-v2.js";
import { cheeseBlockModSpecV2 } from "./examples/cheese-block-modspec-v2.js";

describe("RuleEngine", () => {
  it("expands ruby ore: adds gem, raw, ore block, storage block, smelting, blasting, 9<->block, worldgen", () => {
    const expanded = expandModSpecV2(rubyOreModSpecV2);
    const itemIds = (expanded.items ?? []).map((i) => i.id);
    const blockIds = (expanded.blocks ?? []).map((b) => b.id);
    const recipeTypes = (expanded.recipes ?? []).map((r) => ({ id: r.id, type: r.type }));

    assert.ok(itemIds.includes("ruby"), "gem ruby item");
    assert.ok(itemIds.includes("raw_ruby"), "raw_ruby item");
    assert.ok(blockIds.includes("ruby_ore"), "ruby_ore block");
    assert.ok(blockIds.includes("ruby_block"), "ruby_block storage");
    assert.ok(
      recipeTypes.some((r) => r.type === "smelting" && r.id.includes("raw_ruby")),
      "smelting raw_ruby -> ruby"
    );
    assert.ok(
      recipeTypes.some((r) => r.type === "blasting" && r.id.includes("raw_ruby")),
      "blasting raw_ruby -> ruby"
    );
    assert.ok(
      (expanded.recipes ?? []).some((r) => r.id.includes("compress") && r.type === "crafting_shapeless"),
      "9 ruby -> ruby_block"
    );
    assert.ok(
      (expanded.recipes ?? []).some((r) => r.id.includes("decompress") && r.result.count === 9),
      "ruby_block -> 9 ruby"
    );
    assert.strictEqual((expanded.worldgen ?? []).length, 1);
    assert.strictEqual((expanded.worldgen ?? [])[0].oreBlockId, "ruby_ore");
  });

  it("cheese block keeps food texture and does not add ore worldgen", () => {
    const expanded = expandModSpecV2(cheeseBlockModSpecV2);
    const cheeseBlock = (expanded.blocks ?? []).find((b) => b.id === "cheese_block");
    assert.ok(cheeseBlock);
    assert.strictEqual(cheeseBlock.textureSpec.base, "food");
    assert.strictEqual((expanded.worldgen ?? []).length, 0);
    assert.ok((expanded.recipes ?? []).some((r) => r.result.id === "cheese_block"));
  });
});
