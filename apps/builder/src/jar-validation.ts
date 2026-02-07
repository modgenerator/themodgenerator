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

/** List all entry paths in a zip. */
async function listZipEntries(zipPath: string): Promise<string[]> {
  const yauzl = await getYauzl();
  return new Promise((resolve, reject) => {
    const entries: string[] = [];
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
        entries.push(entry.fileName);
        zipfile.readEntry();
      });
      zipfile.on("end", () => {
        zipfile.close();
        resolve(entries);
      });
      zipfile.on("error", reject);
    });
  });
}

/**
 * JAR-gate: Validate recipes and loot tables in the final JAR.
 * Throws on any validation failure.
 */
export async function validateJarGate(
  jarPath: string,
  modId: string,
  blockIds: string[],
  whitelistNonDropping: string[] = []
): Promise<void> {
  const entries = await listZipEntries(jarPath);

  // 1) Fail if any recipe is under recipes/ (plural)
  const recipesPlural = entries.filter(
    (e) => e.startsWith(`data/${modId}/recipes/`) && e.endsWith(".json")
  );
  if (recipesPlural.length > 0) {
    throw new Error(
      `JAR-GATE: Recipe files must be under data/<modid>/recipe/ (singular), not recipes/. Invalid: ${recipesPlural.slice(0, 5).join(", ")}${recipesPlural.length > 5 ? "..." : ""}`
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

  // 3) Validate loot tables under data/<modid>/loot_tables/
  const lootPrefix = `data/${modId}/loot_tables/`;
  const lootEntries = entries.filter((e) => e.startsWith(lootPrefix) && e.endsWith(".json"));
  for (const entry of lootEntries) {
    const text = await readZipEntry(jarPath, entry);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`JAR-GATE: Loot table ${entry} invalid JSON: ${e}`);
    }
    const lt = parsed as Record<string, unknown>;
    if (typeof lt.type !== "string") {
      throw new Error(`JAR-GATE: Loot table ${entry} must have "type"`);
    }
    if (!Array.isArray(lt.pools)) {
      throw new Error(`JAR-GATE: Loot table ${entry} must have "pools" array`);
    }
  }

  // 4) Every block must have loot table at data/<modid>/loot_tables/blocks/<id>.json
  for (const blockId of blockIds) {
    if (whitelistNonDropping.includes(blockId)) continue;
    const lootPath = `data/${modId}/loot_tables/blocks/${blockId}.json`;
    if (!entries.includes(lootPath)) {
      throw new Error(
        `JAR-GATE: Block ${blockId} must have loot table at ${lootPath}. Add to whitelistNonDropping if intentional.`
      );
    }
  }
}
