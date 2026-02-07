/**
 * JAR-gate validation: validates the final built JAR before upload.
 * - Recipes: must be under data/<modid>/recipe/ (singular), not recipes/; JSON schema (type, result)
 * - Loot tables: valid JSON, type, pools; one JSON per file; every block has loot table
 */

async function getYauzl() {
  return import("yauzl");
}

/** Read a single entry from a zip (JAR) as UTF-8 string. */
async function readZipEntry(zipPath: string, entryPath: string): Promise<string> {
  const yauzl = await getYauzl();
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("Failed to open zip"));
        return;
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry: import("yauzl").Entry) => {
        if (entry.fileName === entryPath) {
          zipfile.openReadStream(entry, (errRead, readStream) => {
            if (errRead) {
              zipfile.close();
              reject(errRead);
              return;
            }
            if (!readStream) {
              zipfile.close();
              reject(new Error("No read stream"));
              return;
            }
            const chunks: Buffer[] = [];
            readStream.on("data", (c: Buffer) => chunks.push(c));
            readStream.on("end", () => {
              zipfile.close();
              resolve(Buffer.concat(chunks).toString("utf8"));
            });
            readStream.on("error", (e) => {
              zipfile.close();
              reject(e);
            });
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on("end", () => {
        zipfile.close();
        reject(new Error(`Entry not found: ${entryPath}`));
      });
      zipfile.on("error", reject);
    });
  });
}

/** List zip entries with uncompressed sizes. */
async function listZipEntriesWithSizes(zipPath: string): Promise<Map<string, number>> {
  const yauzl = await getYauzl();
  return new Promise((resolve, reject) => {
    const map = new Map<string, number>();
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("Failed to open zip"));
        return;
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry: import("yauzl").Entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        map.set(name, entry.uncompressedSize ?? 0);
        zipfile.readEntry();
      });
      zipfile.on("end", () => {
        zipfile.close();
        resolve(map);
      });
      zipfile.on("error", reject);
    });
  });
}

/**
 * JAR-gate: Validate recipes and loot tables in the final JAR.
 * Throws on any validation failure. Error message contains only first failing path + reason.
 */
const MIN_DOOR_TEXTURE_BYTES = 1024;

export async function validateJarGate(
  jarPath: string,
  modId: string,
  blockIds: string[],
  whitelistNonDropping: string[] = []
): Promise<void> {
  const entriesWithSizes = await listZipEntriesWithSizes(jarPath);
  const entries = [...entriesWithSizes.keys()];

  // 1) Fail if any recipe is under recipes/ (plural)
  const recipesPlural = entries.filter(
    (e) => e.startsWith(`data/${modId}/recipes/`) && e.endsWith(".json")
  );
  if (recipesPlural.length > 0) {
    throw new Error(
      `JAR-GATE: Recipe files must be under data/<modid>/recipe/ (singular), not recipes/. Invalid: ${recipesPlural[0]}`
    );
  }

  // 2) Validate each recipe under data/<modid>/recipe/
  const recipeEntries = entries.filter(
    (e) => e.startsWith(`data/${modId}/recipe/`) && e.endsWith(".json")
  );
  for (const entry of recipeEntries) {
    const text = await readZipEntry(jarPath, entry);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`JAR-GATE: Recipe ${entry} invalid JSON: ${e}`);
    }
    const r = parsed as Record<string, unknown>;
    if (typeof r.type !== "string") {
      throw new Error(`JAR-GATE: Recipe ${entry} must have "type"`);
    }
    if (!("result" in r)) {
      throw new Error(`JAR-GATE: Recipe ${entry} must have "result"`);
    }
  }

  // 3) Fail if loot tables are under loot_tables/ (plural). MC 1.21.1 requires loot_table/ (singular).
  const lootTablesPlural = entries.filter((e) => e.startsWith(`data/${modId}/loot_tables/`));
  if (lootTablesPlural.length > 0) {
    const first = lootTablesPlural[0];
    throw new Error(`JAR-GATE: Loot tables must be under data/<modid>/loot_table/ (singular), not loot_tables/. Invalid: ${first}`);
  }

  // 4) Validate loot tables under data/<modid>/loot_table/
  const lootPrefix = `data/${modId}/loot_table/`;
  const lootEntries = entries.filter((e) => e.startsWith(lootPrefix) && e.endsWith(".json"));
  for (const entry of lootEntries) {
    const text = await readZipEntry(jarPath, entry);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`JAR-GATE: ${entry} invalid JSON: ${e}`);
    }
    const lt = parsed as Record<string, unknown>;
    if (typeof lt.type !== "string") {
      throw new Error(`JAR-GATE: ${entry} must have "type"`);
    }
    if (!Array.isArray(lt.pools)) {
      throw new Error(`JAR-GATE: ${entry} must have "pools" array`);
    }
  }

  // 5) Every block must have loot table at data/<modid>/loot_table/blocks/<id>.json
  for (const blockId of blockIds) {
    if (whitelistNonDropping.includes(blockId)) continue;
    const lootPath = `data/${modId}/loot_table/blocks/${blockId}.json`;
    if (!entries.includes(lootPath)) {
      throw new Error(`JAR-GATE: Block ${blockId} missing loot table at ${lootPath}`);
    }
  }

  // 6) Door: bottom/top textures must exist and not be suspiciously small
  for (const blockId of blockIds) {
    if (blockId.endsWith("_door")) {
      const bottomPath = `assets/${modId}/textures/block/${blockId}_bottom.png`;
      const topPath = `assets/${modId}/textures/block/${blockId}_top.png`;
      if (!entries.includes(bottomPath)) {
        throw new Error(`JAR-GATE: Door ${blockId} missing texture at ${bottomPath}`);
      }
      if (!entries.includes(topPath)) {
        throw new Error(`JAR-GATE: Door ${blockId} missing texture at ${topPath}`);
      }
      const bottomSize = entriesWithSizes.get(bottomPath) ?? 0;
      const topSize = entriesWithSizes.get(topPath) ?? 0;
      if (bottomSize < MIN_DOOR_TEXTURE_BYTES) {
        throw new Error(`JAR-GATE: Door ${blockId} texture ${bottomPath} too small (${bottomSize} < ${MIN_DOOR_TEXTURE_BYTES} bytes)`);
      }
      if (topSize < MIN_DOOR_TEXTURE_BYTES) {
        throw new Error(`JAR-GATE: Door ${blockId} texture ${topPath} too small (${topSize} < ${MIN_DOOR_TEXTURE_BYTES} bytes)`);
      }
    }
  }

  // 7) Sign/hanging_sign: models, block textures, and entity textures must exist
  const assetsPrefix = `assets/${modId}/`;
  for (const blockId of blockIds) {
    if (blockId.endsWith("_hanging_sign")) {
      const woodId = blockId.replace(/_hanging_sign$/, "");
      const blockstatePath = `${assetsPrefix}blockstates/${blockId}.json`;
      if (!entries.includes(blockstatePath)) {
        throw new Error(`JAR-GATE: Hanging sign ${blockId} missing blockstate at ${blockstatePath}`);
      }
      const modelPath = `${assetsPrefix}models/block/${blockId}.json`;
      if (!entries.includes(modelPath)) {
        throw new Error(`JAR-GATE: Hanging sign ${blockId} missing model at ${modelPath}`);
      }
      const blockTexPath = `${assetsPrefix}textures/block/${blockId}.png`;
      if (!entries.includes(blockTexPath)) {
        throw new Error(`JAR-GATE: Hanging sign ${blockId} missing block texture at ${blockTexPath}`);
      }
      const entityTexHanging = `${assetsPrefix}textures/entity/signs/hanging/${woodId}.png`;
      const entityTexSigns = `${assetsPrefix}textures/entity/signs/${woodId}.png`;
      if (!entries.includes(entityTexHanging)) {
        throw new Error(`JAR-GATE: Hanging sign ${blockId} missing entity texture at ${entityTexHanging}`);
      }
      if (!entries.includes(entityTexSigns)) {
        throw new Error(`JAR-GATE: Hanging sign ${blockId} missing entity texture at ${entityTexSigns}`);
      }
    } else if (blockId.endsWith("_sign")) {
      const woodId = blockId.replace(/_sign$/, "");
      const blockstatePath = `${assetsPrefix}blockstates/${blockId}.json`;
      if (!entries.includes(blockstatePath)) {
        throw new Error(`JAR-GATE: Sign ${blockId} missing blockstate at ${blockstatePath}`);
      }
      const modelPath = `${assetsPrefix}models/block/${blockId}.json`;
      if (!entries.includes(modelPath)) {
        throw new Error(`JAR-GATE: Sign ${blockId} missing model at ${modelPath}`);
      }
      const blockTexPath = `${assetsPrefix}textures/block/${blockId}.png`;
      if (!entries.includes(blockTexPath)) {
        throw new Error(`JAR-GATE: Sign ${blockId} missing block texture at ${blockTexPath}`);
      }
      const entityTexPath = `${assetsPrefix}textures/entity/signs/${woodId}.png`;
      if (!entries.includes(entityTexPath)) {
        throw new Error(`JAR-GATE: Sign ${blockId} missing entity texture at ${entityTexPath}`);
      }
    }
  }
}
