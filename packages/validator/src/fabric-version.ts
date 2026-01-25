import type { ModSpecV1 } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Fabric/Minecraft version gate: must be 1.21.1 and Fabric only. */
export function validateFabricVersion(spec: ModSpecV1): ValidationResult {
  if (spec.minecraftVersion !== SUPPORTED_MINECRAFT_VERSION) {
    return { valid: false, reason: `Only Minecraft ${SUPPORTED_MINECRAFT_VERSION} is supported. Got: ${spec.minecraftVersion}` };
  }
  if (spec.loader !== SUPPORTED_LOADER) {
    return { valid: false, reason: `Only Fabric loader is supported. Got: ${spec.loader}` };
  }
  return { valid: true };
}
