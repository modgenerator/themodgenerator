import type { ModSpecV1 } from "@themodgenerator/spec";
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Emit a minimal valid Fabric 1.21.1 mod from spec into outDir. No free-form code. */
export function emitHelloWorld(spec: ModSpecV1, outDir: string): void {
  const id = spec.modId;
  const name = spec.modName;
  const javaPackage = id.replace(/-/g, "_");

  const dirs = [
    outDir,
    join(outDir, "src", "main", "java", "net", "themodgenerator", javaPackage),
    join(outDir, "src", "main", "resources"),
    join(outDir, "src", "main", "resources", "assets", id, "lang"),
    join(outDir, "gradle", "wrapper"),
  ];
  for (const d of dirs) {
    mkdirSync(d, { recursive: true });
  }

  // Copy vendored Gradle wrapper files
  // Resolve template path relative to compiled JS file location
  // Compiled file: packages/generator/dist/templates/hello-world.js
  // Template dir: templates/fabric-wrapper (at repo root)
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = join(dirname(currentFile), "../../../../");
  const templateDir = join(repoRoot, "templates", "fabric-wrapper");
  
  copyFileSync(join(templateDir, "gradlew"), join(outDir, "gradlew"));
  copyFileSync(join(templateDir, "gradlew.bat"), join(outDir, "gradlew.bat"));
  copyFileSync(join(templateDir, "gradle", "wrapper", "gradle-wrapper.properties"), join(outDir, "gradle", "wrapper", "gradle-wrapper.properties"));
  
  // Copy gradle-wrapper.jar if it exists in template (will be downloaded by wrapper if missing)
  const wrapperJarPath = join(templateDir, "gradle", "wrapper", "gradle-wrapper.jar");
  if (existsSync(wrapperJarPath)) {
    copyFileSync(wrapperJarPath, join(outDir, "gradle", "wrapper", "gradle-wrapper.jar"));
  }
  
  // Make gradlew executable (may fail on Windows, that's okay)
  try {
    chmodSync(join(outDir, "gradlew"), 0o755);
  } catch {
    // Ignore chmod errors on Windows
  }

  writeFileSync(join(outDir, "build.gradle"), buildGradle(id), "utf8");
  writeFileSync(join(outDir, "gradle.properties"), gradleProperties(), "utf8");
  writeFileSync(join(outDir, "settings.gradle"), settingsGradle(id), "utf8");
  writeFileSync(
    join(outDir, "src", "main", "resources", "fabric.mod.json"),
    fabricModJson(id, name),
    "utf8"
  );
  const className = toClassName(id) + "Mod";
  writeFileSync(
    join(outDir, "src", "main", "java", "net", "themodgenerator", javaPackage, `${className}.java`),
    mainClass(id, name, javaPackage, className),
    "utf8"
  );
  writeFileSync(
    join(outDir, "src", "main", "resources", `${id}.mixins.json`),
    mixinsJson(id),
    "utf8"
  );
  writeFileSync(
    join(outDir, "src", "main", "resources", "assets", id, "lang", "en_us.json"),
    langEn(id, name),
    "utf8"
  );
}

function toClassName(s: string): string {
  return s
    .split(/[-_]/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""))
    .join("");
}

function buildGradle(modId: string): string {
  return `plugins {
	id 'java'
	id 'fabric-loom' version '1.7-SNAPSHOT'
	id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
	archivesName = project.archives_base_name
}

repositories {
	mavenCentral()
	maven { url = "https://maven.fabricmc.net/" }
}

loom {
	splitEnvironmentSourceSets()
	mods {
		"${modId}" {
			sourceSet("main")
		}
	}
}

dependencies {
	minecraft "com.mojang:minecraft:\${project.minecraft_version}"
	mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
	modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"
	modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
}

processResources {
	inputs.property "version", project.version
	filteringCharset "UTF-8"
	filesMatching("fabric.mod.json") {
		expand "version": project.version
	}
}

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
	withSourcesJar()
}
`;
}

function gradleProperties(): string {
  return `# Fabric 1.21.1
minecraft_version=1.21.1
yarn_mappings=1.21.1+build.3
loader_version=0.16.9
fabric_version=0.109.0+1.21.1

mod_version=1.0.0
maven_group=net.themodgenerator
archives_base_name=generated

# Disable daemon for Cloud Run / CI stability
# Gradle daemons are incompatible with ephemeral containers:
# - Daemons expect persistent JVM processes across builds
# - Containers are memory-constrained and may kill long-running processes
# - Ephemeral filesystems don't preserve daemon state
# Solution: run single foreground Gradle invocation with --no-daemon
org.gradle.daemon=false
org.gradle.parallel=false
org.gradle.configureondemand=false
org.gradle.jvmargs=-Xms64m -Xmx256m
`;
}

function settingsGradle(modId: string): string {
  return `pluginManagement {
	repositories {
		maven { url = "https://maven.fabricmc.net/" }
		gradlePluginPortal()
	}
}

rootProject.name = "${modId}"
`;
}

function fabricModJson(modId: string, modName: string): string {
  return `{
  "schemaVersion": 1,
  "id": "${modId}",
  "version": "\${version}",
  "name": "${escapeJson(modName)}",
  "description": "Generated by The Mod Generator",
  "environment": "*",
  "entrypoints": {
    "main": [
      "net.themodgenerator.${modId.replace(/-/g, "_")}.${toClassName(modId)}Mod"
    ]
  },
  "depends": {
    "fabricloader": ">=0.16.0",
    "minecraft": "~1.21.1",
    "java": ">=21",
    "fabric-api": "*"
  }
}
`;
}

function mainClass(modId: string, modName: string, javaPackage: string, className: string): string {
  return `package net.themodgenerator.${javaPackage};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className} implements ModInitializer {
	public static final String MOD_ID = "${modId}";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		LOGGER.info("${escapeJava(modName)} initialized.");
	}
}
`;
}

function mixinsJson(modId: string): string {
  return `{
  "required": true,
  "package": "net.themodgenerator.${modId.replace(/-/g, "_")}.mixin",
  "compatibilityLevel": "JAVA_21",
  "mixins": [],
  "injectors": {
    "defaultRequire": 1
  }
}
`;
}

function langEn(modId: string, modName: string): string {
  return `{
  "mod.${modId}.name": "${escapeJson(modName)}"
}
`;
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function escapeJava(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
