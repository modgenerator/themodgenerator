/**
 * Fail the job if any block is missing block-as-item model.
 * Required: assets/<modId>/models/item/<blockId>.json
 *
 * Accepts two valid patterns:
 * Pattern A (preferred): parent "minecraft:item/generated" + textures.layer0 "<modid>:block/<textureId>"
 *   - Referenced texture must exist at textures/block/<textureId>.png
 * Pattern B (legacy): parent "<modId>:block/<blockId>"
 *   - Block model must exist at models/block/<blockId>.json (or _bottom for door/trapdoor)
 */

import type { MaterializedFile } from "@themodgenerator/generator";

const ASSETS_PREFIX = "src/main/resources/assets";

export function validateBlockAsItemAssets(
  files: MaterializedFile[],
  blockIds: string[],
  modId: string
): void {
  const filePaths = new Set(files.map((f) => f.path));
  const blockTexturePaths = new Set(
    files.filter((f) => f.path.includes("textures/block/") && f.path.endsWith(".png")).map((f) => f.path)
  );
  const blockModelPaths = new Set(
    files.filter((f) => f.path.includes("models/block/") && f.path.endsWith(".json")).map((f) => f.path)
  );

  for (const blockId of blockIds) {
    const itemModelPath = `${ASSETS_PREFIX}/${modId}/models/item/${blockId}.json`;
    if (!filePaths.has(itemModelPath)) {
      throw new Error(
        `Block-as-item validation failed: blockId "${blockId}" is missing required file: ${itemModelPath}`
      );
    }
    const modelFile = files.find((f) => f.path === itemModelPath);
    if (!modelFile?.contents) {
      throw new Error(
        `Block-as-item validation failed: blockId "${blockId}" model file has no contents: ${itemModelPath}`
      );
    }
    try {
      const json = JSON.parse(modelFile.contents) as { parent?: string; textures?: { layer0?: string } };
      const parent = json.parent;
      const layer0 = json.textures?.layer0;

      // Pattern A: minecraft:item/generated + layer0 pointing at block texture
      if (parent === "minecraft:item/generated" && typeof layer0 === "string") {
        const match = new RegExp(`^${modId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:block/(.+)$`).exec(layer0);
        if (!match) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" layer0 must be "<modid>:block/<textureId>" (got "${layer0}")`
          );
        }
        const textureId = match[1];
        const expectedTexture = `${ASSETS_PREFIX}/${modId}/textures/block/${textureId}.png`;
        const hasTexture = blockTexturePaths.has(expectedTexture);
        if (!hasTexture && blockId.endsWith("_door") && textureId === blockId) {
          const fallbackTexture = `${ASSETS_PREFIX}/${modId}/textures/block/${blockId}_bottom.png`;
          if (blockTexturePaths.has(fallbackTexture)) {
            continue;
          }
        }
        if (!hasTexture) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" item model references texture "${layer0}" but file is missing: ${expectedTexture}`
          );
        }
        continue;
      }

      // Pattern B: parent "<modId>:block/<blockId>" (or _bottom for door/trapdoor)
      if (typeof parent === "string" && parent.startsWith(`${modId}:block/`)) {
        const modelId = parent.replace(`${modId}:block/`, "");
        const blockModelPath = `${ASSETS_PREFIX}/${modId}/models/block/${modelId}.json`;
        const hasModel = blockModelPaths.has(blockModelPath) || filePaths.has(blockModelPath);
        if (!hasModel) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" item model references block "${parent}" but file is missing: ${blockModelPath}`
          );
        }
        continue;
      }

      throw new Error(
        `Block-as-item validation failed: blockId "${blockId}" item model must use Pattern A (parent "minecraft:item/generated" + layer0 "<modid>:block/<id>") or Pattern B (parent "<modid>:block/<blockId>"). Got parent="${parent ?? "undefined"}"`
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(
          `Block-as-item validation failed: blockId "${blockId}" model invalid JSON in ${itemModelPath}: ${(err as Error).message}`
        );
      }
      throw err;
    }
  }
}
