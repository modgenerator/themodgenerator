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

const JOB_ID = process.env.JOB_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const GCS_BUCKET = process.env.GCS_BUCKET;
const MODE = process.env.MODE ?? "test";

async function main(): Promise<void> {
  if (!JOB_ID || !DATABASE_URL || !GCS_BUCKET) {
    console.error("JOB_ID, DATABASE_URL, and GCS_BUCKET are required");
    process.exit(1);
  }
  const pool = getPool(DATABASE_URL);
  const job = await getJobById(pool, JOB_ID);
  if (!job) {
    console.error("Job not found:", JOB_ID);
    process.exit(1);
  }
  const mode = MODE || job.mode || "test";
  await updateJob(pool, JOB_ID, { status: "building", started_at: new Date() });
  const workDir = join(tmpdir(), `modbuild-${randomUUID()}`);
  const logPath = join(workDir, "build.log");
  let logContent = "";
  try {
    mkdirSync(workDir, { recursive: true });
    // In test mode, always generate hello-world mod (ignore prompt)
    let specToUse = job.spec_json;
    if (mode === "test") {
      specToUse = createHelloWorldSpec("test_mod", "Test Mod");
    }
    if (!specToUse) {
      await updateJob(pool, JOB_ID, { status: "failed", rejection_reason: "Missing spec_json" });
      process.exit(1);
    }
    const validation = validateSpec(specToUse, { prompt: job.prompt });
    if (!validation.valid) {
      await updateJob(pool, JOB_ID, {
        status: "rejected",
        rejection_reason: validation.reason ?? "Validation failed",
      });
      process.exit(1);
    }
    fromSpec(specToUse, workDir);
    // Run Gradle (assume Gradle is on PATH or use wrapper; we generate wrapper in build step)
    execSync("gradle wrapper", { cwd: workDir, stdio: "pipe" });
    try {
      execSync("./gradlew build --no-daemon -q", {
        cwd: workDir,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (gradleErr: unknown) {
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
      process.exit(1);
    }
    const jarDir = join(workDir, "build", "libs");
    const jars = readdirSync(jarDir).filter((f) => f.endsWith(".jar") && !f.includes("-sources"));
    const jarFile = jars[0];
    if (!jarFile) {
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
      process.exit(1);
    }
    const jarPath = join(jarDir, jarFile);
    // In test mode, use simple path: artifacts/<jobId>.jar
    // In real mode, use: artifacts/<jobId>/<jarFile>
    const artifactKey = mode === "test" 
      ? `artifacts/${JOB_ID}.jar`
      : `artifacts/${JOB_ID}/${jarFile}`;
    const logKey = `logs/${JOB_ID}/build.log`;
    await uploadFile(jarPath, { bucket: GCS_BUCKET, destination: artifactKey, contentType: "application/java-archive" });
    writeFileSync(logPath, "Build succeeded.\n", "utf8");
    await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    await updateJob(pool, JOB_ID, {
      status: "succeeded",
      finished_at: new Date(),
      artifact_path: `gs://${GCS_BUCKET}/${artifactKey}`,
      log_path: `gs://${GCS_BUCKET}/${logKey}`,
    });
  } catch (err) {
    logContent += (err instanceof Error ? err.stack : String(err)) + "\n";
    let logKey: string | null = null;
    try {
      writeFileSync(logPath, logContent, "utf8");
      logKey = `logs/${JOB_ID}/build.log`;
      await uploadFile(logPath, { bucket: GCS_BUCKET, destination: logKey, contentType: "text/plain" });
    } catch (_) {}
    await updateJob(pool, JOB_ID, {
      status: "failed",
      finished_at: new Date(),
      rejection_reason: err instanceof Error ? err.message : "Build error",
      log_path: logKey ? `gs://${GCS_BUCKET}/${logKey}` : undefined,
    }).catch(() => {});
    process.exit(1);
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

main();
