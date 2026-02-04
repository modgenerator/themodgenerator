// ---- HARD START DEBUG ----
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT_EXCEPTION", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED_REJECTION", err);
  process.exit(1);
});

console.log("MOD-BUILDER BOOT: start");
console.log("NODE VERSION:", process.version);
console.log("CWD:", process.cwd());

/**
 * Builder CLI entry. Expects env: JOB_ID, DATABASE_URL, GCS_BUCKET.
 * Steps: load job → validate → generate → Gradle build → upload jar + logs → update job.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn, execSync } from "node:child_process";
import { getPool, getJobById, updateJob } from "@themodgenerator/db";
import {
  composeTier1Stub,
  materializeTier1,
  materializeTier1WithPlans,
  planFromIntent,
  aggregateExecutionPlans,
  buildAggregatedExpectationContract,
  buildSafetyDisclosure,
  expandIntentToScope,
  expandPromptToScope,
  getScopeBudgetResult,
  type MaterializedFile,
  type CreditBudget,
} from "@themodgenerator/generator";
import { validateSpec, validateModSpecV2, validateRecipes, validateSpecHygiene, validateGeneratedRecipeJson } from "@themodgenerator/validator";
import { uploadFile } from "@themodgenerator/gcp";
import { generateOpaquePng16x16WithProfile } from "./texture-png.js";
import { validateTexturePngFile, perceptualFingerprint } from "./texture-validation.js";
import { getVanillaTextureBuffer, type VanillaAssetsSource } from "./vanilla-asset-source.js";
import { validateBlockAsItemAssets } from "./validate-block-as-item-assets.js";
import {
  expandSpecTier1,
  isModSpecV2,
  expandModSpecV2,
  expandedModSpecV2ToV1,
} from "@themodgenerator/spec";

// Continue debug logging after imports are available
console.log("FILES IN CWD:", readdirSync("."));
console.log("FILES IN apps/builder/dist:", existsSync("apps/builder/dist")
  ? readdirSync("apps/builder/dist")
  : "MISSING apps/builder/dist");
// ---- HARD START DEBUG ----

/**
 * Require an environment variable, exiting with code 1 if missing.
 * Returns a guaranteed string (type narrowing for TypeScript).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[BUILDER] FATAL: ${name} environment variable is required but not set`);
    process.exit(1);
  }
  return value;
}

// Validate required environment variables at startup
console.log("[BUILDER] Validating environment variables...");
const JOB_ID: string = requireEnv("JOB_ID");
const DATABASE_URL: string = requireEnv("DATABASE_URL");
const GCS_BUCKET: string = requireEnv("GCS_BUCKET");

/** Require MODE=build. Only execution path is real build → JAR upload → completed. */
function requireModeBuild(): void {
  if (process.env.MODE !== "build") {
    console.error("[BUILDER] FATAL: MODE must be 'build'. Got:", process.env.MODE);
    process.exit(1);
  }
}

console.log("[BUILDER] Environment check:", {
  hasJobId: true,
  jobIdLength: JOB_ID.length,
  hasDatabaseUrl: true,
  databaseUrlLength: DATABASE_URL.length,
  hasGcsBucket: true,
  gcsBucket: GCS_BUCKET,
  mode: "build",
});

console.log("[BUILDER] All required environment variables present. Starting main()...");

/** Log phase transition and persist to DB for observability (buildId = JOB_ID). */
async function logPhase(
  pool: Parameters<typeof updateJob>[0],
  buildId: string,
  phase: string
): Promise<void> {
  const now = new Date();
  console.log(`[BUILDER] buildId=${buildId} phase=${phase} timestamp=${now.toISOString()}`);
  await updateJob(pool, buildId, { current_phase: phase, phase_updated_at: now });
}

/**
 * Build seed string from path + textureProfile so each entity gets distinct texture.
 * Uses semantic fields (intent, materialHint, traits, style) so same color ≠ same texture.
 */
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

/** Per-path texture metadata from profile-driven generator (for manifest). */
const textureMetaByPath = new Map<string, { motifsApplied: string[]; materialClassApplied: string }>();

export interface WriteMaterializedFilesOptions {
  mcVersion?: string;
}

/**
 * Write Plane 3 materialized files to workDir. Creates parent dirs as needed.
 * If a .png has copyFromVanillaPaths, copies from VANILLA_ASSETS_SOURCE (client_jar or bundled_pack); fail loud if source not set or not found.
 * Otherwise .png with empty contents gets a 32x32 opaque PNG (material color + noise + motifs when profile present).
 */
async function writeMaterializedFiles(
  files: MaterializedFile[],
  workDir: string,
  options?: WriteMaterializedFilesOptions
): Promise<void> {
  textureMetaByPath.clear();
  const needsVanilla = files.some((f) => f.path.endsWith(".png") && f.copyFromVanillaPaths?.length);
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

  for (const file of files) {
    const { path: relPath, contents, placeholderMaterial, colorHint, texturePrompt, copyFromVanillaPaths } = file;
    const fullPath = join(workDir, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });

    if (relPath.endsWith(".png") && copyFromVanillaPaths?.length) {
      const vanillaPath = copyFromVanillaPaths[0];
      const buffer = await getVanillaTextureBuffer(vanillaSource!, vanillaPath, {
        mcVersion: options?.mcVersion ?? process.env.MC_VERSION ?? "1.21.1",
        bundledPackRoot: process.env.VANILLA_ASSETS_PACK,
      });
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
      writeFileSync(fullPath, pngBuffer);
      if (profile) textureMetaByPath.set(relPath, { motifsApplied, materialClassApplied });
    } else if (relPath.endsWith(".png") && contents.length > 0 && /^[A-Za-z0-9+/=]+$/.test(contents.trim())) {
      writeFileSync(fullPath, Buffer.from(contents, "base64"));
    } else {
      writeFileSync(fullPath, contents, "utf8");
    }
  }
}

/** Texture manifest entry for auditing and regression detection. */
export interface TextureManifestEntry {
  id: string;
  intent: "block" | "item" | "processed";
  materialHint: string;
  derivedFrom: string | null;
  materialClassApplied?: string;
  motifsApplied?: string[];
}

/**
 * Build texture manifest from materialized PNG files that have textureProfile; use motifsApplied/materialClassApplied from writeMaterializedFiles.
 */
function buildAndWriteTextureManifest(files: MaterializedFile[], workDir: string): TextureManifestEntry[] {
  const manifest: TextureManifestEntry[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".png") || !(f as { textureProfile?: { intent: string; materialHint: string } }).textureProfile) continue;
    const profile = (f as { textureProfile: { intent: string; materialHint: string; materialClass?: string; visualMotifs?: string[] } }).textureProfile;
    const id = f.path.replace(/.*\/(?:item|block)\//, "").replace(/\.png$/, "");
    const meta = textureMetaByPath.get(f.path);
    manifest.push({
      id,
      intent: profile.intent as "block" | "item" | "processed",
      materialHint: profile.materialHint,
      derivedFrom: null,
      ...(meta && { materialClassApplied: meta.materialClassApplied, motifsApplied: meta.motifsApplied }),
    });
  }
  const manifestPath = join(workDir, "texture-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

/**
 * Fail if any two texture PNGs are perceptually identical (same 4x4 average fingerprint).
 */
function validateNoPerceptuallyIdenticalTextures(files: MaterializedFile[], workDir: string): void {
  const pngFiles = files.filter((f) => f.path.endsWith(".png"));
  const entries: { path: string; fingerprint: string }[] = [];
  for (const f of pngFiles) {
    const fullPath = join(workDir, f.path);
    if (!existsSync(fullPath)) continue;
    const buf = readFileSync(fullPath);
    const fp = perceptualFingerprint(buf);
    if (fp == null) continue;
    entries.push({ path: f.path, fingerprint: fp });
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].fingerprint === entries[j].fingerprint) {
        throw new Error(
          `Texture perceptually identical: ${entries[i].path} and ${entries[j].path} have the same visual fingerprint. Block ≠ item ≠ processed; every entity must be visually distinct.`
        );
      }
    }
  }
}

/**
 * Fail if any generated recipe JSON does not match MC 1.21.1 schema (result.item for crafting, result string for cooking, refs in spec, no self-loop).
 */
function validateGeneratedRecipeJsonFromFiles(
  files: MaterializedFile[],
  workDir: string,
  spec: { modId?: string; items?: { id: string }[]; blocks?: { id: string }[] }
): void {
  const recipePaths = files.filter((f) => f.path.includes("/data/") && f.path.includes("/recipe/") && f.path.endsWith(".json"));
  const recipesByPath = new Map<string, unknown>();
  for (const f of recipePaths) {
    const fullPath = join(workDir, f.path);
    if (!existsSync(fullPath)) continue;
    try {
      const raw = readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      recipesByPath.set(f.path, parsed);
    } catch (err) {
      throw new Error(`Recipe file ${f.path}: invalid JSON or unreadable. ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const result = validateGeneratedRecipeJson(spec as import("@themodgenerator/spec").ModSpecV1, recipesByPath);
  if (!result.valid) {
    throw new Error(`Recipe schema validation failed (MC 1.21.1): ${result.errors.join("; ")}`);
  }
}

/**
 * Fail if any two texture PNGs are byte-identical (no reuse across entities).
 */
function validateNoDuplicateTextures(files: MaterializedFile[], workDir: string): void {
  const pngFiles = files.filter((f) => f.path.endsWith(".png"));
  const buffers: { path: string; buf: Buffer }[] = [];
  for (const f of pngFiles) {
    const fullPath = join(workDir, f.path);
    if (!existsSync(fullPath)) continue;
    buffers.push({ path: f.path, buf: readFileSync(fullPath) });
  }
  for (let i = 0; i < buffers.length; i++) {
    for (let j = i + 1; j < buffers.length; j++) {
      if (buffers[i].buf.length === buffers[j].buf.length && buffers[i].buf.equals(buffers[j].buf)) {
        throw new Error(
          `Texture reuse forbidden: ${buffers[i].path} and ${buffers[j].path} are byte-identical. Every entity must have a distinct texture.`
        );
      }
    }
  }
}

/**
 * Fail fast if any texture PNG is missing or fails decode/opacity/variation validation.
 * Validation: PNG decodes, width/height >= 16, not fully transparent, not a single flat color.
 */
function validateTexturePngs(files: MaterializedFile[], workDir: string): void {
  const pngFiles = files.filter((f) => f.path.endsWith(".png"));
  for (const f of pngFiles) {
    const fullPath = join(workDir, f.path);
    if (!existsSync(fullPath)) {
      throw new Error(`Texture missing: ${fullPath}`);
    }
    const st = statSync(fullPath);
    if (st.size === 0) {
      throw new Error(`Texture is 0 bytes: ${fullPath}`);
    }
    validateTexturePngFile(fullPath, f.path);
  }
}

/**
 * Copy vendored Gradle wrapper into outDir so ./gradlew build can run.
 * Resolves template path relative to this file (works in Docker: /app/templates/fabric-wrapper).
 */
function copyFabricWrapperTo(outDir: string): void {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = join(dirname(currentFile), "../../../");
  const templateDir = join(repoRoot, "templates", "fabric-wrapper");
  mkdirSync(join(outDir, "gradle", "wrapper"), { recursive: true });
  copyFileSync(join(templateDir, "gradlew"), join(outDir, "gradlew"));
  copyFileSync(join(templateDir, "gradlew.bat"), join(outDir, "gradlew.bat"));
  copyFileSync(
    join(templateDir, "gradle", "wrapper", "gradle-wrapper.properties"),
    join(outDir, "gradle", "wrapper", "gradle-wrapper.properties")
  );
  const wrapperJar = join(templateDir, "gradle", "wrapper", "gradle-wrapper.jar");
  if (existsSync(wrapperJar)) {
    copyFileSync(wrapperJar, join(outDir, "gradle", "wrapper", "gradle-wrapper.jar"));
  }
  try {
    chmodSync(join(outDir, "gradlew"), 0o755);
  } catch {
    // Ignore chmod on Windows
  }
}

/**
 * Execute a Gradle command with timeout, streaming, and proper error handling.
 * Returns stdout and stderr as strings.
 */
async function runGradle(
  command: string[],
  cwd: string,
  timeoutMs: number = 600000, // 10 minutes default
  buildId?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const bid = buildId ?? "unknown";
  return new Promise((resolve, reject) => {
    const gradleEnv = {
      ...process.env,
      GRADLE_OPTS: "-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.workers.max=1",
    };
    
    console.log(`[BUILDER] buildId=${bid} executing: ${command.join(" ")}`);
    console.log(`[BUILDER] buildId=${bid} cwd=${cwd}`);
    
    const proc = spawn(command[0], command.slice(1), {
      cwd,
      env: gradleEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      // Stream to console in real-time
      process.stdout.write(text);
    });
    
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      // Stream to console in real-time
      process.stderr.write(text);
    });
    
    const timeout = setTimeout(() => {
      console.error(`[BUILDER] buildId=${bid} Gradle timed out after ${timeoutMs}ms`);
      proc.kill("SIGKILL");
      reject(new Error(`Gradle command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    proc.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (signal) {
        const err = new Error(`Gradle process killed by signal: ${signal}`) as Error & { stdout: string; stderr: string };
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else if (code !== 0) {
        const err = new Error(`Gradle command failed with exit code ${code}`) as Error & { stdout: string; stderr: string };
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      }
    });
  });
}

async function main(): Promise<void> {
  requireModeBuild();
  const buildId = JOB_ID;
  console.log(`[BUILDER] buildId=${buildId} main started (build mode only)`);
  console.log(`[BUILDER] buildId=${buildId} connecting to database`);
  const pool = getPool(DATABASE_URL);
  console.log(`[BUILDER] buildId=${buildId} database pool created`);
  
  console.log(`[BUILDER] buildId=${buildId} fetching job`);
  const job = await getJobById(pool, JOB_ID);
  if (!job) {
    console.error(`[BUILDER] buildId=${buildId} FATAL: job not found`);
    process.exit(1);
  }
  await logPhase(pool, buildId, "prompt_parsed");
  console.log(`[BUILDER] buildId=${buildId} job found status=${job.status}`);
  
  await updateJob(pool, JOB_ID, { status: "building", started_at: new Date() });
  console.log(`[BUILDER] buildId=${buildId} status=building`);
  
  const workDir = join(tmpdir(), `modbuild-${randomUUID()}`);
  const logPath = join(workDir, "build.log");
  console.log(`[BUILDER] Work directory: ${workDir}`);
  
  let logContent = "";
  try {
    console.log("[BUILDER] Creating work directory...");
    mkdirSync(workDir, { recursive: true });
    console.log("[BUILDER] Work directory created");
    
    let specToUse = job.spec_json as Parameters<typeof expandSpecTier1>[0];
    if (!specToUse) {
      console.error("[BUILDER] FATAL: Missing spec_json in job");
      await updateJob(pool, JOB_ID, { status: "failed", rejection_reason: "Missing spec_json" });
      process.exit(1);
    }
    await logPhase(pool, buildId, "spec_generated");

    if (isModSpecV2(specToUse)) {
      const expandedV2 = expandModSpecV2(specToUse);
      await logPhase(pool, buildId, "rules_expanded");
      const v2Validation = validateModSpecV2(expandedV2);
      if (!v2Validation.valid) {
        const msg = v2Validation.errors.join("; ");
        console.error(`[BUILDER] buildId=${buildId} ModSpecV2 validation failed:`, msg);
        await updateJob(pool, JOB_ID, {
          status: "failed",
          rejection_reason: `ModSpecV2 validation: ${msg}`,
          current_phase: "failed",
          phase_updated_at: new Date(),
        });
        process.exit(1);
      }
      await logPhase(pool, buildId, "validated");
      specToUse = expandedModSpecV2ToV1(expandedV2);
    } else {
      const validation = validateSpec(specToUse, { prompt: job.prompt });
      if (!validation.valid) {
        const msg = [validation.gate, validation.reason].filter(Boolean).join(": ");
        console.error(`[BUILDER] buildId=${buildId} Spec validation failed: ${msg}`);
        await updateJob(pool, JOB_ID, {
          status: "failed",
          rejection_reason: `Validation (${validation.gate}): ${validation.reason ?? "invalid spec"}`,
          current_phase: "failed",
          phase_updated_at: new Date(),
        });
        process.exit(1);
      }
      const recipeCheck = validateRecipes(specToUse);
      if (!recipeCheck.valid) {
        const msg = recipeCheck.errors.join("; ");
        console.error(`[BUILDER] buildId=${buildId} Recipe validation failed: ${msg}`);
        await updateJob(pool, JOB_ID, {
          status: "failed",
          rejection_reason: `Recipe validation: ${msg}`,
          current_phase: "failed",
          phase_updated_at: new Date(),
        });
        process.exit(1);
      }
      const hygieneCheck = validateSpecHygiene(specToUse);
      if (!hygieneCheck.valid) {
        const msg = hygieneCheck.errors.join("; ");
        console.error(`[BUILDER] buildId=${buildId} Spec hygiene failed: ${msg}`);
        await updateJob(pool, JOB_ID, {
          status: "failed",
          rejection_reason: `Spec hygiene: ${msg}`,
          current_phase: "failed",
          phase_updated_at: new Date(),
        });
        process.exit(1);
      }
    }

    console.log(`[BUILDER] buildId=${buildId} Tier 1 materialized project`);
    const expanded = expandSpecTier1(specToUse);
      await logPhase(pool, buildId, "world_interactions");
      const assets = composeTier1Stub(expanded.descriptors);
      const prompt = job.prompt ?? "";
      // Scope-based credits (before build). Never block or reduce scope.
      const scopeFromPrompt = expandPromptToScope(prompt);
      const scopeFromItems = expanded.items.flatMap((item, i) =>
        expandIntentToScope({
          name: item.name,
          description: i === 0 && prompt.length > 0 ? prompt : undefined,
          category: "item",
          material: item.material ?? "generic",
        })
      );
      const scopeFromBlocks = expanded.blocks.flatMap((b) =>
        expandIntentToScope({
          name: b.name,
          description: undefined,
          category: "block",
          material: b.material ?? "generic",
        })
      );
      const fullScope = [...scopeFromPrompt, ...scopeFromItems, ...scopeFromBlocks];
      const budget: CreditBudget = 30;
      const scopeResult = getScopeBudgetResult(fullScope, budget);
      const itemPlans = expanded.items.map((item, i) =>
        planFromIntent({
          name: item.name,
          description: i === 0 && prompt.length > 0 ? prompt : undefined,
          category: "item",
          material: item.material ?? "generic",
        })
      );
      const blockPlans = expanded.blocks.map((b) =>
        planFromIntent({
          name: b.name,
          description: undefined,
          category: "block",
          material: b.material ?? "generic",
        })
      );
      const allPlans = [...itemPlans, ...blockPlans];
      const aggregatedPlan = aggregateExecutionPlans(allPlans);
      await logPhase(pool, buildId, "behaviors");
      const expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
      const safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);
      if (process.env.NODE_ENV !== "production") {
        if (aggregatedPlan.systems.length === 0 && fullScope.length > 0) {
          throw new Error(
            "Invariant violation: scope exists without planned systems"
          );
        }
      }
      console.log("[BUILDER] --- Build explanation ---");
      console.log("[BUILDER] executionPlan systems:", aggregatedPlan.systems.join(", ") || "none");
      console.log("[BUILDER] executionPlan explanation:", aggregatedPlan.explanation.join(" | ") || "none");
      if (aggregatedPlan.upgradePath?.length) {
        console.log("[BUILDER] executionPlan upgradePath:", aggregatedPlan.upgradePath.join("; "));
      }
      if (aggregatedPlan.futureExpansion?.length) {
        console.log("[BUILDER] executionPlan futureExpansion:", aggregatedPlan.futureExpansion.join("; "));
      }
      console.log("[BUILDER] expectationContract whatItDoes:", expectationContract.whatItDoes.join("; "));
      console.log("[BUILDER] expectationContract howYouUseIt:", expectationContract.howYouUseIt.join("; "));
      console.log("[BUILDER] expectationContract limits:", expectationContract.limits.join("; "));
      console.log("[BUILDER] expectationContract scalesWithCredits:", expectationContract.scalesWithCredits.join("; "));
      console.log("[BUILDER] safetyDisclosure statements:", safetyDisclosure.statements.join("; ") || "none");
      console.log("[BUILDER] scopeSummary:", scopeResult.scopeSummary.join(", "));
      console.log("[BUILDER] totalCredits:", scopeResult.totalCredits);
      console.log("[BUILDER] fitsBudget:", scopeResult.fitsBudget);
      if (scopeResult.explanation) {
        console.log("[BUILDER] explanation:", scopeResult.explanation);
      }
      console.log("[BUILDER] --- End build explanation ---");
      const files =
        expanded.items.length > 0 && itemPlans.length > 0
          ? materializeTier1WithPlans(expanded, assets, itemPlans)
          : materializeTier1(expanded, assets);
      await writeMaterializedFiles(files, workDir, {
        mcVersion: specToUse.minecraftVersion ?? "1.21.1",
      });
      validateGeneratedRecipeJsonFromFiles(files, workDir, specToUse);
      buildAndWriteTextureManifest(files, workDir);
      validateBlockAsItemAssets(files, expanded.blocks.map((b) => b.id), expanded.spec.modId);
      validateTexturePngs(files, workDir);
      validateNoDuplicateTextures(files, workDir);
      validateNoPerceptuallyIdenticalTextures(files, workDir);
      copyFabricWrapperTo(workDir);
      await logPhase(pool, buildId, "compiled");
      console.log("[BUILDER] Tier 1 project written; Gradle wrapper copied");

    const gradlewPath = join(workDir, "gradlew");
    if (!existsSync(gradlewPath)) {
      throw new Error(`FATAL: gradlew not found at ${gradlewPath}. Wrapper must be vendored, not generated at runtime.`);
    }
    
    try {
      await logPhase(pool, buildId, "building_mod");
      console.log(`[BUILDER] buildId=${buildId} running gradlew build`);
      const buildResult = await runGradle(
        ["./gradlew", "build", "--no-daemon", "--no-build-cache"],
        workDir,
        600000,
        buildId
      );
      console.log(`[BUILDER] Gradle build completed successfully (exit code: ${buildResult.exitCode})`);
      logContent = `Build succeeded.\n\nSTDOUT:\n${buildResult.stdout}\n\nSTDERR:\n${buildResult.stderr}`;
      writeFileSync(logPath, logContent, "utf8");
    } catch (gradleErr: unknown) {
      console.error("[BUILDER] FATAL: Gradle build failed");
      const errorMsg = gradleErr instanceof Error ? gradleErr.message : String(gradleErr);
      logContent = `Gradle build failed: ${errorMsg}\n\nSTDOUT:\n${(gradleErr as { stdout?: string })?.stdout ?? ""}\n\nSTDERR:\n${(gradleErr as { stderr?: string })?.stderr ?? ""}`;
      writeFileSync(logPath, logContent, "utf8");
      const logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        current_phase: "failed",
        phase_updated_at: new Date(),
        rejection_reason: `Gradle build failed: ${errorMsg}`,
        log_path: `gs://${GCS_BUCKET}/${logKey}`,
      });
      console.error(`[BUILDER] buildId=${buildId} phase=failed exiting`);
      process.exit(1);
    }
    console.log(`[BUILDER] buildId=${buildId} looking for JAR`);
    const jarDir = join(workDir, "build", "libs");
    const jars = readdirSync(jarDir).filter((f) => f.endsWith(".jar") && !f.includes("-sources"));
    const jarFile = jars[0];
    if (!jarFile) {
      console.error(`[BUILDER] buildId=${buildId} FATAL: no jar in build/libs`);
      logContent = "No jar produced";
      writeFileSync(logPath, logContent, "utf8");
      const logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        current_phase: "failed",
        phase_updated_at: new Date(),
        rejection_reason: "No jar produced",
        log_path: `gs://${GCS_BUCKET}/${logKey}`,
      });
      process.exit(1);
    }
    console.log(`[BUILDER] buildId=${buildId} jar=${jarFile}`);
    const jarPath = join(jarDir, jarFile);
    const modId = (specToUse as { modId?: string }).modId ?? "generated";
    const specRecipes = (specToUse as { recipes?: unknown[] }).recipes ?? [];
    const recipesPrefix = `data/${modId}/recipe/`;
    let jarList = "";
    try {
      jarList = execSync(`jar tf "${jarPath}"`, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
    } catch (e) {
      console.error(`[BUILDER] buildId=${buildId} jar tf failed:`, e);
      jarList = "";
    }
    const hasRecipes = jarList.split(/\r?\n/).some((line) => line.startsWith(recipesPrefix));
    if (specRecipes.length > 0 && !hasRecipes) {
      console.error(`[BUILDER] buildId=${buildId} JAR missing ${recipesPrefix}; failing job`);
      const logKey = `logs/${JOB_ID}/build.log`;
      logContent = `Build produced JAR but missing required data: ${recipesPrefix}`;
      writeFileSync(logPath, logContent, "utf8");
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        current_phase: "failed",
        phase_updated_at: new Date(),
        rejection_reason: `JAR is missing data/${modId}/recipe/. Spec requires recipes but directory not found in JAR.`,
        log_path: `gs://${GCS_BUCKET}/${logKey}`,
      });
      process.exit(1);
    }
    const artifactKey = `artifacts/${JOB_ID}/${jarFile}`;
    const logKey = `logs/${JOB_ID}/build.log`;
    
    console.log(`[BUILDER] buildId=${buildId} uploading JAR gs://${GCS_BUCKET}/${artifactKey}`);
    await uploadFile(jarPath, { bucket: GCS_BUCKET, destination: artifactKey, contentType: "application/java-archive" });
    writeFileSync(logPath, "Build succeeded.\n", "utf8");
    await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    await logPhase(pool, buildId, "uploaded");
    await updateJob(pool, JOB_ID, {
      status: "succeeded",
      finished_at: new Date(),
      current_phase: "completed",
      phase_updated_at: new Date(),
      artifact_path: `gs://${GCS_BUCKET}/${artifactKey}`,
      log_path: `gs://${GCS_BUCKET}/${logKey}`,
      spec_json: specToUse,
    });
    console.log(`[BUILDER] buildId=${buildId} phase=completed status=succeeded (spec persisted)`);
  } catch (err) {
    console.error(`[BUILDER] buildId=${buildId} FATAL: unhandled exception`, err);
    if (err instanceof Error) {
      console.error(`[BUILDER] buildId=${buildId} stack:`, err.stack);
    }
    
    logContent += (err instanceof Error ? err.stack : String(err)) + "\n";
    let logKey: string | null = null;
    try {
      writeFileSync(logPath, logContent, "utf8");
      logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    } catch (uploadErr) {
      console.error(`[BUILDER] buildId=${buildId} failed to upload error log:`, uploadErr);
    }
    
    try {
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        current_phase: "failed",
        phase_updated_at: new Date(),
        rejection_reason: err instanceof Error ? err.message : "Build error",
        log_path: logKey ? `gs://${GCS_BUCKET}/${logKey}` : undefined,
      });
    } catch (updateErr) {
      console.error(`[BUILDER] buildId=${buildId} failed to update job:`, updateErr);
    }
    
    process.exit(1);
  } finally {
    try {
      console.log(`[BUILDER] buildId=${buildId} cleaning up workDir`);
      rmSync(workDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error(`[BUILDER] buildId=${buildId} cleanup failed:`, cleanupErr);
    }
  }
  
  console.log(`[BUILDER] buildId=${buildId} main completed`);
}

console.log("[BUILDER] Starting main() function...");
main()
  .then(() => {
    console.log("[BUILDER] Main function resolved successfully. Exiting with code 0.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[BUILDER] Main function rejected:", err);
    if (err instanceof Error) {
      console.error("[BUILDER] Rejection stack:", err.stack);
    }
    console.error("[BUILDER] Exiting with code 1: Main function rejected");
    process.exit(1);
  });
