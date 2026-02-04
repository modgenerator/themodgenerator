/**
 * Fail the job if any block is missing block-as-item model.
 * Required: assets/<modId>/models/item/<blockId>.json
 * Block-as-item model MUST reference block model: { "parent": "<modId>:block/<blockId>" } (no separate texture).
 * If model uses layer0 instead, the referenced texture file must exist.
 */

import type { MaterializedFile } from "@themodgenerator/generator";

const ASSETS_PREFIX = "src/main/resources/assets";

export function validateBlockAsItemAssets(
  files: MaterializedFile[],
  blockIds: string[],
  modId: string
): void {
  const filePaths = new Set(files.map((f) => f.path));
  const texturePaths = new Set(
    files.filter((f) => f.path.includes("textures/item/") && f.path.endsWith(".png")).map((f) => f.path)
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
      if (typeof parent === "string") {
        const expectedParent = `${modId}:block/${blockId}`;
        if (parent !== expectedParent) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" item model must have "parent": "${expectedParent}" (got "${parent}")`
          );
        }
        const expectedBlockModel = `${ASSETS_PREFIX}/${modId}/models/block/${blockId}.json`;
        if (!blockModelPaths.has(expectedBlockModel)) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" references block model but file is missing: ${expectedBlockModel}`
          );
        }
        continue;
      }
      const layer0 = json.textures?.layer0;
      if (typeof layer0 === "string") {
        const match = /^[^:]+:item\/(.+)$/.exec(layer0);
        const itemId = match?.[1] ?? blockId;
        const expectedTexture = `${ASSETS_PREFIX}/${modId}/textures/item/${itemId}.png`;
        if (!texturePaths.has(expectedTexture)) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" item model references texture "${layer0}" but file is missing: ${expectedTexture}`
          );
        }
      } else {
        const expectedTexture = `${ASSETS_PREFIX}/${modId}/textures/item/${blockId}.png`;
        if (!texturePaths.has(expectedTexture)) {
          throw new Error(
            `Block-as-item validation failed: blockId "${blockId}" is missing texture: ${expectedTexture}`
          );
        }
      }
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
