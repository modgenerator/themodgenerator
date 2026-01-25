import type { ModSpecV1 } from "@themodgenerator/spec";
import { emitHelloWorld } from "./templates/hello-world.js";

/**
 * Generate a deterministic Fabric project from a ModSpecV1 into outDir.
 * Dispatches by feature; swapping or adding generators is done here.
 */
export function fromSpec(spec: ModSpecV1, outDir: string): void {
  if (spec.features.includes("hello-world")) {
    emitHelloWorld(spec, outDir);
  }
  // Future: if (spec.features.includes("ore")) { emitOre(spec, outDir); } etc.
}
