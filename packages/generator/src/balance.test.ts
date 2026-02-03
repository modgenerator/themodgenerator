import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeRarityScore,
  deriveToolStats,
  deriveArmorStats,
} from "./balance.js";

describe("Balance", () => {
  it("computeRarityScore with empty worldgen returns default normalized ~0.5", () => {
    const r = computeRarityScore([]);
    assert.ok(r.normalized >= 0 && r.normalized <= 1);
    assert.strictEqual(r.score, 50);
  });

  it("computeRarityScore with sparse worldgen gives higher score", () => {
    const r = computeRarityScore([
      {
        oreBlockId: "ruby_ore",
        minY: -64,
        maxY: 32,
        veinSize: 2,
        veinsPerChunk: 0.5,
        biomeTags: ["minecraft:rare_biome"],
      },
    ]);
    assert.ok(r.score > 50);
    assert.ok(r.normalized > 0.5);
  });

  it("deriveToolStats returns values within clamped bounds", () => {
    const rarity = { score: 60, normalized: 0.6, factors: { veinsPerChunk: 2, veinSize: 4, verticalRange: 128, biomeRestriction: 0 } };
    const stats = deriveToolStats("ruby", rarity);
    assert.ok(stats.durability >= 32 && stats.durability <= 2031);
    assert.ok(stats.miningSpeed >= 1 && stats.miningSpeed <= 16);
    assert.ok(stats.attackDamageBonus >= 0 && stats.attackDamageBonus <= 12);
    assert.ok(stats.enchantability >= 5 && stats.enchantability <= 25);
    assert.ok(stats.miningLevel >= 0 && stats.miningLevel <= 4);
  });

  it("deriveToolStats with styleOverPower reduces stats", () => {
    const rarity = { score: 80, normalized: 0.8, factors: { veinsPerChunk: 1, veinSize: 2, verticalRange: 64, biomeRestriction: 1 } };
    const normal = deriveToolStats("ruby", rarity);
    const style = deriveToolStats("ruby", rarity, { styleOverPower: true });
    assert.ok(style.durability <= normal.durability);
    assert.ok(style.attackDamageBonus <= normal.attackDamageBonus);
  });

  it("deriveArmorStats returns protectionPoints length 4 and within bounds", () => {
    const rarity = { score: 50, normalized: 0.5, factors: { veinsPerChunk: 2, veinSize: 4, verticalRange: 128, biomeRestriction: 0 } };
    const stats = deriveArmorStats("ruby", rarity);
    assert.strictEqual(stats.protectionPoints.length, 4);
    assert.ok(stats.durabilityMultiplier >= 5 && stats.durabilityMultiplier <= 40);
    assert.ok(stats.toughness >= 0 && stats.toughness <= 4);
    assert.ok(stats.knockbackResistance >= 0 && stats.knockbackResistance <= 0.2);
  });
});
