/**
 * Write Plane 3 materialized files to workDir. Isolated so E2E tests can import
 * without triggering builder env validation (JOB_ID etc.).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { MaterializedFile } from "@themodgenerator/generator";
import { generateOpaquePng16x16WithProfile } from "./texture-png.js";
import {
  perceptualFingerprint,
  ensurePngRgba,
  applyPerEntityVariation,
  applySemanticColorTheme,
} from "./texture-validation.js";
import {
  getVanillaTextureBuffer,
  getVanillaTextureBufferWithFallbacks,
  type VanillaAssetsSource,
} from "./vanilla-asset-source.js";
import { collectVanillaDepsForBlock } from "./vanilla-dep-collector.js";

/** Per-path texture metadata from profile-driven generator (for manifest). */
const textureMetaByPath = new Map<string, { motifsApplied: string[]; materialClassApplied: string }>();

export function getTextureMetaByPath(): ReadonlyMap<string, { motifsApplied: string[]; materialClassApplied: string }> {
  return textureMetaByPath;
}

export interface WriteMaterializedFilesOptions {
  mcVersion?: string;
}

function textureSeedFromFile(relPath: string, file: MaterializedFile): string {
  const base = relPath.replace(/\.png$/, "").replace(/\//g, "_");
  const intent = file.textureIntent ?? "item";
  const profile = (file as { textureProfile?: { materialHint: string; physicalTraits: string[]; surfaceStyle: string[]; visualMotifs?: string[] } }).textureProfile;
  if (profile) {
    const parts = [base, intent, profile.materialHint, profile.physicalTraits.join("-"), profile.surfaceStyle.join("-")];
    if (profile.visualMotifs?.length) parts.push(profile.visualMotifs.join("-"));
    return parts.join("_");
  }
  return [base, intent].join("_");
}

function ensurePerceptuallyUnique(
  buffer: Buffer,
  relPath: string,
  seenFingerprints: Set<string>,
  maxAttempts: number,
  applyTheme: (buf: Buffer, path: string, strength?: number) => Buffer,
  applyVariation: (buf: Buffer, path: string) => Buffer
): Buffer {
  let current = buffer;
  let fp = perceptualFingerprint(current);
  let attempt = 0;
  while (fp != null && seenFingerprints.has(fp) && attempt < maxAttempts) {
    const strength = Math.min(0.95, 0.45 + attempt * 0.12);
    current = applyTheme(current, relPath, strength);
    current = applyVariation(current, `${relPath}-perceptual-retry-${attempt}`);
    fp = perceptualFingerprint(current);
    attempt++;
  }
  if (fp != null) seenFingerprints.add(fp);
  return current;
}

/**
 * Write Plane 3 materialized files to workDir. Creates parent dirs as needed.
 * If a .png has copyFromVanillaPaths/vanillaTemplateBlockId, copies from VANILLA_ASSETS_SOURCE; fail loud if not set or not found.
 * Exported for E2E tests (e.g. Maple wood type build regression).
 */
export async function writeMaterializedFiles(
  files: MaterializedFile[],
  workDir: string,
  options?: WriteMaterializedFilesOptions
): Promise<void> {
  textureMetaByPath.clear();
  const needsVanilla = files.some(
    (f) =>
      f.path.endsWith(".png") &&
      (f.copyFromVanillaPaths?.length || (f as { vanillaTemplateBlockId?: string }).vanillaTemplateBlockId)
  );
  let vanillaSource: VanillaAssetsSource | null = null;
  if (needsVanilla) {
    const raw = process.env.VANILLA_ASSETS_SOURCE;
    if (raw !== "client_jar" && raw !== "bundled_pack") {
      throw new Error(
        `[VANILLA_ASSETS] Some textures require copying from vanilla (copyFromVanillaPaths). Set VANILLA_ASSETS_SOURCE to "client_jar" or "bundled_pack". Current value: ${raw ?? "(unset)"}`
      );
    }
    vanillaSource = raw;
  }

  const MAX_PERCEPTUAL_ATTEMPTS = 5;
  const seenPerceptualFingerprints = new Set<string>();

  for (const file of files) {
    const { path: relPath, contents, placeholderMaterial, colorHint, texturePrompt, copyFromVanillaPaths } = file;
    const fullPath = join(workDir, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });

    if (relPath.endsWith(".png") && (copyFromVanillaPaths?.length || (file as { vanillaTemplateBlockId?: string }).vanillaTemplateBlockId)) {
      const vanillaTemplateBlockId = (file as { vanillaTemplateBlockId?: string }).vanillaTemplateBlockId;
      const opts = {
        mcVersion: options?.mcVersion ?? process.env.MC_VERSION ?? "1.21.1",
        bundledPackRoot: process.env.VANILLA_ASSETS_PACK,
      };
      let buffer: Buffer;
      if (vanillaTemplateBlockId) {
        const deps = await collectVanillaDepsForBlock(vanillaTemplateBlockId, vanillaSource!, opts);
        const vanillaPath = deps.texturePaths[0] ?? copyFromVanillaPaths?.[0] ?? "";
        if (!vanillaPath) {
          throw new Error(
            `[VANILLA_ASSETS] collectVanillaDepsForBlock("${vanillaTemplateBlockId}") returned no textures for ${relPath}.`
          );
        }
        buffer = await getVanillaTextureBuffer(vanillaSource!, vanillaPath, opts);
      } else if (copyFromVanillaPaths!.length > 1) {
        buffer = await getVanillaTextureBufferWithFallbacks(
          vanillaSource!,
          copyFromVanillaPaths!,
          opts,
          relPath
        );
      } else {
        buffer = await getVanillaTextureBuffer(vanillaSource!, copyFromVanillaPaths![0], opts);
      }
      buffer = ensurePngRgba(buffer);
      buffer = applySemanticColorTheme(buffer, relPath);
      buffer = applyPerEntityVariation(buffer, relPath);
      buffer = ensurePerceptuallyUnique(buffer, relPath, seenPerceptualFingerprints, MAX_PERCEPTUAL_ATTEMPTS, applySemanticColorTheme, applyPerEntityVariation);
      writeFileSync(fullPath, buffer);
    } else if (relPath.endsWith(".png") && (contents === "" || contents.length === 0)) {
      const material = (placeholderMaterial ?? "generic") as "wood" | "stone" | "metal" | "gem" | "generic";
      const seed = textureSeedFromFile(relPath, file);
      const profile = (file as { textureProfile?: { materialClass?: string; visualMotifs?: string[] } }).textureProfile;
      if (process.env.DEBUG && texturePrompt) {
        console.log(`[BUILDER] texture prompt ${relPath}: ${texturePrompt}`);
      }
      const { buffer: pngBuffer, motifsApplied, materialClassApplied } = generateOpaquePng16x16WithProfile({
        material,
        colorHint,
        seed,
        textureProfile: profile ?? undefined,
      });
      let rgbaBuffer = ensurePngRgba(pngBuffer);
      rgbaBuffer = applySemanticColorTheme(rgbaBuffer, relPath);
      rgbaBuffer = applyPerEntityVariation(rgbaBuffer, relPath);
      rgbaBuffer = ensurePerceptuallyUnique(rgbaBuffer, relPath, seenPerceptualFingerprints, MAX_PERCEPTUAL_ATTEMPTS, applySemanticColorTheme, applyPerEntityVariation);
      writeFileSync(fullPath, rgbaBuffer);
      if (profile) textureMetaByPath.set(relPath, { motifsApplied, materialClassApplied });
    } else if (relPath.endsWith(".png") && contents.length > 0 && /^[A-Za-z0-9+/=]+$/.test(contents.trim())) {
      let rgbaBuffer = ensurePngRgba(Buffer.from(contents, "base64"));
      rgbaBuffer = applySemanticColorTheme(rgbaBuffer, relPath);
      rgbaBuffer = applyPerEntityVariation(rgbaBuffer, relPath);
      rgbaBuffer = ensurePerceptuallyUnique(rgbaBuffer, relPath, seenPerceptualFingerprints, MAX_PERCEPTUAL_ATTEMPTS, applySemanticColorTheme, applyPerEntityVariation);
      writeFileSync(fullPath, rgbaBuffer);
    } else {
      writeFileSync(fullPath, contents, "utf8");
    }
  }
}
