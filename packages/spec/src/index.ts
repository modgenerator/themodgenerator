export type {
  ModSpecV1,
  FeatureKey,
  ModItem,
  ModBlock,
  ModOre,
  ModRecipe,
  ModLoot,
  AssetRef,
  ConstraintsReport,
} from "./types.js";
export {
  SUPPORTED_MINECRAFT_VERSION,
  SUPPORTED_LOADER,
  createHelloWorldSpec,
} from "./types.js";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
export const modSpecV1JsonSchema = JSON.parse(
  readFileSync(join(__dirname, "schema.json"), "utf8")
) as Record<string, unknown>;
