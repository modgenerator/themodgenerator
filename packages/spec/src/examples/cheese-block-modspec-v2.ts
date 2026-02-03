/**
 * Example ModSpecV2: "cheese block" — food block, RuleEngine enforces texture base=food and palette.
 */
import type { ModSpecV2 } from "../modspec-v2.js";

export const cheeseBlockModSpecV2: ModSpecV2 = {
  schemaVersion: 2,
  namespace: "example",
  modId: "cheesemod",
  modName: "Cheese Mod",
  minecraftVersion: "1.21.1",
  fabricVersion: "0.15",
  materials: [
    {
      id: "cheese",
      category: "food",
      palette: ["yellow", "#f4c430"],
      powerProfile: "cosmetic",
      styleOverPower: true,
    },
  ],
  blocks: [
    {
      id: "cheese_block",
      name: "Block of Cheese",
      kind: "basic",
      textureSpec: { base: "food", palette: ["yellow"] },
      miningSpec: { toolTag: "none", requiredLevel: 0, hardness: 0.5 },
      dropsSpec: { itemId: "cheese_block", countMin: 1, countMax: 1 },
      materialRef: "cheese",
    },
  ],
  worldgen: [],
  items: [
    {
      id: "cheese_slice",
      kind: "food",
      materialRef: "cheese",
    },
  ],
  recipes: [
    {
      id: "cheese_block_from_slices",
      type: "crafting_shapeless",
      inputs: Array(9).fill({ id: "cheese_slice", count: 1 }),
      result: { id: "cheese_block", count: 1 },
    },
  ],
  tags: [],
};
