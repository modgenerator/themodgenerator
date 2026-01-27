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
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { getPool, getJobById, updateJob } from "@themodgenerator/db";
import { fromSpec } from "@themodgenerator/generator";
import { validateSpec } from "@themodgenerator/validator";
import { uploadFile } from "@themodgenerator/gcp";
import { createHelloWorldSpec } from "@themodgenerator/spec";

// Continue debug logging after imports are available
console.log("FILES IN CWD:", readdirSync("."));
console.log("FILES IN apps/builder/dist:", existsSync("apps/builder/dist")
  ? readdirSync("apps/builder/dist")
  : "MISSING apps/builder/dist");
// ---- HARD START DEBUG ----

// Validate required environment variables at startup
console.log("[BUILDER] Validating environment variables...");
const JOB_ID = process.env.JOB_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const GCS_BUCKET = process.env.GCS_BUCKET;
const MODE = process.env.MODE ?? "test";

console.log("[BUILDER] Environment check:", {
  hasJobId: !!JOB_ID,
  jobIdLength: JOB_ID?.length ?? 0,
  hasDatabaseUrl: !!DATABASE_URL,
  databaseUrlLength: DATABASE_URL?.length ?? 0,
  hasGcsBucket: !!GCS_BUCKET,
  gcsBucket: GCS_BUCKET ?? "not set",
  mode: MODE,
});

if (!JOB_ID) {
  console.error("[BUILDER] FATAL: JOB_ID environment variable is required but not set");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("[BUILDER] FATAL: DATABASE_URL environment variable is required but not set");
  process.exit(1);
}
if (!GCS_BUCKET) {
  console.error("[BUILDER] FATAL: GCS_BUCKET environment variable is required but not set");
  process.exit(1);
}

console.log("[BUILDER] All required environment variables present. Starting main()...");

async function main(): Promise<void> {
  console.log(`[BUILDER] Main function started. JOB_ID=${JOB_ID}, MODE=${MODE}`);
  console.log("[BUILDER] Connecting to database...");
  const pool = getPool(DATABASE_URL);
  console.log("[BUILDER] Database connection pool created");
  
  console.log(`[BUILDER] Fetching job from database: ${JOB_ID}`);
  const job = await getJobById(pool, JOB_ID);
  if (!job) {
    console.error(`[BUILDER] FATAL: Job not found in database: ${JOB_ID}`);
    process.exit(1);
  }
  console.log(`[BUILDER] Job found: status=${job.status}, prompt=${job.prompt?.substring(0, 50)}...`);
  const mode = MODE || job.mode || "test";
  console.log(`[BUILDER] Using mode: ${mode}`);
  
  console.log("[BUILDER] Updating job status to 'building'...");
  await updateJob(pool, JOB_ID, { status: "building", started_at: new Date() });
  console.log("[BUILDER] Job status updated to 'building'");
  
  const workDir = join(tmpdir(), `modbuild-${randomUUID()}`);
  const logPath = join(workDir, "build.log");
  console.log(`[BUILDER] Work directory: ${workDir}`);
  
  let logContent = "";
  try {
    console.log("[BUILDER] Creating work directory...");
    mkdirSync(workDir, { recursive: true });
    console.log("[BUILDER] Work directory created");
    
    // In test mode, always generate hello-world mod (ignore prompt)
    let specToUse = job.spec_json;
    if (mode === "test") {
      console.log("[BUILDER] Test mode: generating hello-world spec");
      specToUse = createHelloWorldSpec("test_mod", "Test Mod");
    }
    if (!specToUse) {
      console.error("[BUILDER] FATAL: Missing spec_json in job");
      await updateJob(pool, JOB_ID, { status: "failed", rejection_reason: "Missing spec_json" });
      process.exit(1);
    }
    console.log("[BUILDER] Spec obtained, validating...");
    const validation = validateSpec(specToUse, { prompt: job.prompt });
    if (!validation.valid) {
      console.error(`[BUILDER] FATAL: Spec validation failed: ${validation.reason}`);
      await updateJob(pool, JOB_ID, {
        status: "rejected",
        rejection_reason: validation.reason ?? "Validation failed",
      });
      process.exit(1);
    }
    console.log("[BUILDER] Spec validation passed");
    
    console.log("[BUILDER] Generating Fabric project from spec...");
    fromSpec(specToUse, workDir);
    console.log("[BUILDER] Fabric project generated");
    
    // Run Gradle (assume Gradle is on PATH or use wrapper; we generate wrapper in build step)
    console.log("[BUILDER] Running 'gradle wrapper'...");
    execSync("gradle wrapper", { cwd: workDir, stdio: "pipe" });
    console.log("[BUILDER] Gradle wrapper created");
    try {
      console.log("[BUILDER] Running './gradlew build --no-daemon -q'...");
      execSync("./gradlew build --no-daemon -q", {
        cwd: workDir,
        encoding: "utf8",
        stdio: "pipe",
      });
      console.log("[BUILDER] Gradle build completed successfully");
    } catch (gradleErr: unknown) {
      console.error("[BUILDER] FATAL: Gradle build failed");
      const out = (gradleErr as { stdout?: string; stderr?: string }).stdout ?? "";
      const err = (gradleErr as { stderr?: string }).stderr ?? "";
      logContent = `stdout:\n${out}\nstderr:\n${err}`;
      writeFileSync(logPath, logContent, "utf8");
      const logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        rejection_reason: "Gradle build failed",
        log_path: `gs://${GCS_BUCKET}/${logKey}`,
      });
      console.error("[BUILDER] Exiting with code 1: Gradle build failed");
      process.exit(1);
    }
    console.log("[BUILDER] Looking for built JAR file...");
    const jarDir = join(workDir, "build", "libs");
    const jars = readdirSync(jarDir).filter((f) => f.endsWith(".jar") && !f.includes("-sources"));
    const jarFile = jars[0];
    if (!jarFile) {
      console.error("[BUILDER] FATAL: No jar file produced in build/libs");
      logContent = "No jar produced";
      writeFileSync(logPath, logContent, "utf8");
      const logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        rejection_reason: "No jar produced",
        log_path: `gs://${GCS_BUCKET}/${logKey}`,
      });
      console.error("[BUILDER] Exiting with code 1: No jar produced");
      process.exit(1);
    }
    console.log(`[BUILDER] Found JAR file: ${jarFile}`);
    const jarPath = join(jarDir, jarFile);
    // In test mode, use simple path: artifacts/<jobId>.jar
    // In real mode, use: artifacts/<jobId>/<jarFile>
    const artifactKey = mode === "test" 
      ? `artifacts/${JOB_ID}.jar`
      : `artifacts/${JOB_ID}/${jarFile}`;
    const logKey = `logs/${JOB_ID}/build.log`;
    
    console.log(`[BUILDER] Uploading JAR to GCS: gs://${GCS_BUCKET}/${artifactKey}`);
    await uploadFile(jarPath, { bucket: GCS_BUCKET, destination: artifactKey, contentType: "application/java-archive" });
    console.log("[BUILDER] JAR uploaded successfully");
    
    writeFileSync(logPath, "Build succeeded.\n", "utf8");
    console.log(`[BUILDER] Uploading build log to GCS: gs://${GCS_BUCKET}/${logKey}`);
    await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    console.log("[BUILDER] Build log uploaded successfully");
    
    console.log("[BUILDER] Updating job status to 'succeeded'...");
    await updateJob(pool, JOB_ID, {
      status: "succeeded",
      finished_at: new Date(),
      artifact_path: `gs://${GCS_BUCKET}/${artifactKey}`,
      log_path: `gs://${GCS_BUCKET}/${logKey}`,
    });
    console.log("[BUILDER] Job status updated to 'succeeded'");
  } catch (err) {
    console.error("[BUILDER] FATAL: Unhandled exception in main()");
    console.error("[BUILDER] Error:", err);
    if (err instanceof Error) {
      console.error("[BUILDER] Stack:", err.stack);
    }
    
    logContent += (err instanceof Error ? err.stack : String(err)) + "\n";
    let logKey: string | null = null;
    try {
      writeFileSync(logPath, logContent, "utf8");
      logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    } catch (uploadErr) {
      console.error("[BUILDER] Failed to upload error log:", uploadErr);
    }
    
    try {
      await updateJob(pool, JOB_ID, {
        status: "failed",
        finished_at: new Date(),
        rejection_reason: err instanceof Error ? err.message : "Build error",
        log_path: logKey ? `gs://${GCS_BUCKET}/${logKey}` : undefined,
      });
    } catch (updateErr) {
      console.error("[BUILDER] Failed to update job status:", updateErr);
    }
    
    console.error("[BUILDER] Exiting with code 1: Unhandled exception");
    process.exit(1);
  } finally {
    try {
      console.log("[BUILDER] Cleaning up work directory...");
      rmSync(workDir, { recursive: true, force: true });
      console.log("[BUILDER] Work directory cleaned up");
    } catch (cleanupErr) {
      console.error("[BUILDER] Failed to cleanup work directory:", cleanupErr);
    }
  }
  
  console.log("[BUILDER] Main function completed successfully");
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
