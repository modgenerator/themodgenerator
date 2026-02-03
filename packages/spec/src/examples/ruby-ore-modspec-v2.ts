/**
 * Example ModSpecV2: "ruby ore" — one gem material, RuleEngine expands to gem/raw/ore block/storage/smelting/blasting/9↔block.
 */
import type { ModSpecV2 } from "../modspec-v2.js";

export const rubyOreModSpecV2: ModSpecV2 = {
  schemaVersion: 2,
  namespace: "example",
  modId: "rubyores",
  modName: "Ruby Ores",
  minecraftVersion: "1.21.1",
  fabricVersion: "0.15",
  materials: [
    {
      id: "ruby",
      category: "gem",
      palette: ["red", "#c41e3a"],
      powerProfile: "default",
      styleOverPower: false,
    },
  ],
  blocks: [],
  worldgen: [],
  items: [],
  recipes: [],
  tags: [],
};
