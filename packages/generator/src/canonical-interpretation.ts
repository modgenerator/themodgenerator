/**
 * Canonical Interpretation Layer — Plane 3 only.
 * Interprets user intent semantically; provides expressive fallback archetypes when details are missing.
 * Guarantees: no missing assets, no purple/black textures, no broken mechanics.
 * NEVER limits creativity. Deterministic, replaceable, overridable. Safe fallback only.
 *
 * INVARIANT (Phase D): If the user supplies ANY explicit asset, model, color, texture, or behavior
 * hint, it ALWAYS overrides canonical fallbacks. Canonical logic checks for user-provided data
 * first and only activates when data is missing. Never overwrite user intent.
 *
 * Plane 1 and Plane 2 MUST NOT change. All realization happens in Plane 3.
 */

/** Canonical placeholder materials for texture sourcing when user does not provide a texture. */
export type CanonicalMaterial = "wood" | "stone" | "metal" | "gem" | "generic";

// =============================================================================
// Phase A — Expressive Archetype System (conceptual, not textures)
// Archetypes are fallbacks only. They define intended feel and expectations;
// they do NOT cap creativity or force vanilla aesthetics.
// =============================================================================

export type ArchetypeId =
  | "magical_wand"
  | "ancient_relic"
  | "tech_device"
  | "crystal_object"
  | "organic_material"
  | "corrupted_item"
  | "industrial_block"
  | "mystical_block"
  | "creative_item"
  | "creative_block";

/** Semantic visual guarantees (not asset quality). Every archetype must define these. */
export interface ArchetypeGuarantees {
  silhouetteRule: string;
  contrastRule: string;
  motionRule?: string;
  emissiveRule?: string;
}

export interface ArchetypeDefinition {
  id: ArchetypeId;
  /** Intended feel: magical, tech, organic, etc. */
  intendedFeel: string;
  /** Expected interaction: handheld, placed, passive. */
  interactionStyle: string;
  /** Visual expectations: glow, emissive, rigid, organic. */
  visualExpectations: string;
  /** Behavior expectations for future tiers. */
  behaviorExpectations: string;
  /** Hint for fallback placeholder: emissive yes/no. */
  emissiveHint: boolean;
  /** Hint: translucency. */
  translucencyHint: boolean;
  /** Hint: glow. */
  glowHint: boolean;
  /** Semantic visual guarantees. Every archetype must define these. */
  guarantees: ArchetypeGuarantees;
}

/** Expressive archetypes. Fallbacks only; never limit user creativity. */
export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  magical_wand: {
    id: "magical_wand",
    intendedFeel: "magical",
    interactionStyle: "handheld",
    visualExpectations: "glow, enchanted",
    behaviorExpectations: "right-click use, durability or cooldown",
    emissiveHint: true,
    translucencyHint: false,
    glowHint: true,
    guarantees: {
      silhouetteRule: "elongated, thin",
      contrastRule: "readable against inventory and hand",
      motionRule: "particle emphasis during use",
      emissiveRule: "glowing accents",
    },
  },
  ancient_relic: {
    id: "ancient_relic",
    intendedFeel: "ancient, mysterious",
    interactionStyle: "handheld or placed",
    visualExpectations: "aged, runes, subtle glow",
    behaviorExpectations: "passive or activation",
    emissiveHint: false,
    translucencyHint: false,
    glowHint: true,
    guarantees: {
      silhouetteRule: "distinct shape, relic-like",
      contrastRule: "aged but readable",
      emissiveRule: "subtle glow on runes",
    },
  },
  tech_device: {
    id: "tech_device",
    intendedFeel: "tech, mechanical",
    interactionStyle: "handheld",
    visualExpectations: "rigid, metallic, lights",
    behaviorExpectations: "activation, cooldown",
    emissiveHint: true,
    translucencyHint: false,
    glowHint: true,
    guarantees: {
      silhouetteRule: "mechanical, rigid outline",
      contrastRule: "high contrast for indicators",
      motionRule: "indicator feedback on use",
      emissiveRule: "lights or screens",
    },
  },
  crystal_object: {
    id: "crystal_object",
    intendedFeel: "crystalline, pure",
    interactionStyle: "handheld or placed",
    visualExpectations: "translucent, refractive",
    behaviorExpectations: "passive or energy",
    emissiveHint: false,
    translucencyHint: true,
    glowHint: true,
    guarantees: {
      silhouetteRule: "crystalline, faceted",
      contrastRule: "clear edges, refractive feel",
      emissiveRule: "inner glow",
    },
  },
  organic_material: {
    id: "organic_material",
    intendedFeel: "organic, natural",
    interactionStyle: "handheld or placed",
    visualExpectations: "soft, irregular",
    behaviorExpectations: "passive",
    emissiveHint: false,
    translucencyHint: false,
    glowHint: false,
    guarantees: {
      silhouetteRule: "organic, irregular",
      contrastRule: "natural variation, readable",
    },
  },
  corrupted_item: {
    id: "corrupted_item",
    intendedFeel: "corrupted, dark",
    interactionStyle: "handheld",
    visualExpectations: "dark, crackling",
    behaviorExpectations: "risk or cost",
    emissiveHint: true,
    translucencyHint: false,
    glowHint: true,
    guarantees: {
      silhouetteRule: "corrupted, distorted",
      contrastRule: "dark with crackling accents",
      emissiveRule: "corruption glow",
    },
  },
  industrial_block: {
    id: "industrial_block",
    intendedFeel: "industrial, mechanical",
    interactionStyle: "placed",
    visualExpectations: "rigid, metallic",
    behaviorExpectations: "passive or machine",
    emissiveHint: false,
    translucencyHint: false,
    glowHint: false,
    guarantees: {
      silhouetteRule: "blocky, mechanical",
      contrastRule: "metallic, industrial",
    },
  },
  mystical_block: {
    id: "mystical_block",
    intendedFeel: "mystical, magical",
    interactionStyle: "placed",
    visualExpectations: "glow, runes",
    behaviorExpectations: "passive or aura",
    emissiveHint: true,
    translucencyHint: false,
    glowHint: true,
    guarantees: {
      silhouetteRule: "block with runes or symbols",
      contrastRule: "readable runes",
      emissiveRule: "glow or rune glow",
    },
  },
  creative_item: {
    id: "creative_item",
    intendedFeel: "expressive, open",
    interactionStyle: "handheld",
    visualExpectations: "replaceable by user",
    behaviorExpectations: "user-defined",
    emissiveHint: false,
    translucencyHint: false,
    glowHint: false,
    guarantees: {
      silhouetteRule: "generic item shape",
      contrastRule: "readable placeholder",
    },
  },
  creative_block: {
    id: "creative_block",
    intendedFeel: "expressive, open",
    interactionStyle: "placed",
    visualExpectations: "replaceable by user",
    behaviorExpectations: "user-defined",
    emissiveHint: false,
    translucencyHint: false,
    glowHint: false,
    guarantees: {
      silhouetteRule: "generic block shape",
      contrastRule: "readable placeholder",
    },
  },
};

// --- Asset rules (hard constraints) ---

/** Items: one texture per item, flat, Minecraft-native. */
export const CANONICAL_MODEL_ITEM = "minecraft:item/generated" as const;

/** Blocks: one texture per block, cube. */
export const CANONICAL_MODEL_BLOCK = "minecraft:block/cube_all" as const;

/** Texture path pattern: assets/<modid>/textures/item/<contentId>.png */
export const TEXTURE_ITEM_PATTERN = "textures/item" as const;

/** Texture path pattern: assets/<modid>/textures/block/<contentId>.png */
export const TEXTURE_BLOCK_PATTERN = "textures/block" as const;

/**
 * Map descriptor/spec material string to canonical placeholder material.
 * Deterministic; no randomness. Used when no user texture is provided.
 */
const MATERIAL_TO_CANONICAL: Record<string, CanonicalMaterial> = {
  // wood
  wood: "wood",
  oak: "wood",
  spruce: "wood",
  birch: "wood",
  jungle: "wood",
  acacia: "wood",
  dark_oak: "wood",
  mangrove: "wood",
  cherry: "wood",
  bamboo: "wood",
  plank: "wood",
  planks: "wood",
  log: "wood",
  // stone
  stone: "stone",
  cobble: "stone",
  cobblestone: "stone",
  andesite: "stone",
  diorite: "stone",
  granite: "stone",
  deepslate: "stone",
  ore: "stone",
  // metal
  metal: "metal",
  iron: "metal",
  gold: "metal",
  copper: "metal",
  ingot: "metal",
  nugget: "metal",
  // gem
  gem: "gem",
  ruby: "gem",
  sapphire: "gem",
  emerald: "gem",
  diamond: "gem",
  amethyst: "gem",
  crystal: "gem",
};

/**
 * Resolve a descriptor/spec material string to a canonical placeholder material.
 * Deterministic; unknown materials map to "generic".
 */
export function getCanonicalMaterial(material: string): CanonicalMaterial {
  const normalized = material.toLowerCase().trim();
  return MATERIAL_TO_CANONICAL[normalized] ?? "generic";
}

// =============================================================================
// Phase B — Intent → Archetype Resolution
// Deterministic: User intent (inferred from id/name) + descriptor + material → Archetype.
// Centralized, documented. Never random. Always returns something.
// Unknown intent → sensible generic archetype (creative_item / creative_block), NOT vanilla.
// =============================================================================

export interface IntentSignals {
  contentId: string;
  name?: string;
  category: "item" | "block";
  material: string;
}

/**
 * Resolve archetype from intent signals (contentId, name, category, material).
 * Deterministic. No randomness. Always returns an archetype.
 * Phase D: Only used when user has NOT supplied explicit asset/model/color/texture/behavior;
 * caller must check hasUserProvidedAsset() first and skip resolution when true.
 */
export function resolveArchetype(signals: IntentSignals): ArchetypeId {
  const id = signals.contentId.toLowerCase().replace(/-/g, "_");
  const name = (signals.name ?? "").toLowerCase();
  const combined = `${id} ${name}`;
  const mat = getCanonicalMaterial(signals.material);
  const isItem = signals.category === "item";
  const isBlock = signals.category === "block";

  // Item archetypes (deterministic keyword matching)
  if (isItem) {
    if (/\b(wand|staff|scepter|magic)\b/.test(combined)) return "magical_wand";
    if (/\b(relic|artifact|ancient)\b/.test(combined)) return "ancient_relic";
    if (/\b(tech|device|mechanic|circuit)\b/.test(combined)) return "tech_device";
    if (/\b(crystal|gem|shard)\b/.test(combined) && (mat === "gem" || /\bcrystal\b/.test(combined)))
      return "crystal_object";
    if (/\b(organic|leaf|vine|root)\b/.test(combined)) return "organic_material";
    if (/\b(corrupt|dark|cursed)\b/.test(combined)) return "corrupted_item";
    // Default item: expressive generic
    return "creative_item";
  }

  // Block archetypes
  if (isBlock) {
    if (/\b(crystal|gem)\b/.test(combined) && (mat === "gem" || /\bcrystal\b/.test(combined)))
      return "crystal_object";
    if (/\b(industrial|machine|factory|tech)\b/.test(combined)) return "industrial_block";
    if (/\b(mystical|magic|rune|arcane)\b/.test(combined)) return "mystical_block";
    if (/\b(organic|leaf|vine)\b/.test(combined)) return "organic_material";
    if (/\b(corrupt|dark)\b/.test(combined)) return "mystical_block"; // dark block → mystical fallback
    if (mat === "metal" && /\b(block|cube|plate)\b/.test(combined)) return "industrial_block";
    if (mat === "gem") return "crystal_object";
    return "creative_block";
  }

  return isItem ? "creative_item" : "creative_block";
}

// =============================================================================
// Phase D — Absolute Override Rules
// If the user supplies ANY explicit asset, model, color, texture, or behavior hint,
// it ALWAYS overrides canonical fallbacks. No exceptions.
// Canonical logic must check for user-provided data first; only activate when missing.
// =============================================================================

/**
 * Whether the user has supplied an explicit asset/model/color/texture/behavior for this content.
 * When true, canonical fallbacks (archetype, placeholder material) must NOT overwrite user intent.
 * Tier 1: We do not yet have user-provided texture paths in spec; so this returns false.
 * Future: check spec for explicit textureRef, modelRef, color, etc.
 */
export function hasUserProvidedAsset(
  _expanded: unknown,
  _contentId: string,
  _category: "item" | "block"
): boolean {
  // Tier 1: no user asset fields in spec. When spec gains textureRef/modelRef/color, check here.
  return false;
}

// =============================================================================
// Phase E — Behavior Semantics (DOCUMENTED ONLY; no gameplay implementation in Tier 1)
// Semantic intent labels for future tiers. Not vanilla binding.
// Future tiers may map these to custom entities, custom systems, or vanilla mechanics.
// Tier 1 remains registration-only.
// =============================================================================

/**
 * Intent → semantic mechanic class. For labeling only; no implementation here.
 * lightning → energy_strike; fire → burn; healing → restoration; teleport → displacement.
 */
export const BEHAVIOR_SEMANTICS = {
  lightning: "energy_strike",
  fire: "burn",
  healing: "restoration",
  teleport: "displacement",
  damage: "harm",
  buff: "enhancement",
  debuff: "reduction",
  summon: "spawn",
  absorb: "absorption",
} as const;

export type BehaviorSemanticKey = keyof typeof BEHAVIOR_SEMANTICS;
export type BehaviorSemanticLabel = (typeof BEHAVIOR_SEMANTICS)[BehaviorSemanticKey];

/** Legacy export for compatibility; prefer BEHAVIOR_SEMANTICS for new code. */
export const BEHAVIOR_INTENT_TO_VANILLA = {
  lightning: { entity: "LightningBoltEntity", sound: "vanilla thunder", damage: "vanilla lightning damage" },
  fire: { projectile: "fireball or flame", damage: "vanilla fire damage" },
  healing: { mechanic: "vanilla potion" },
  handheld_use: { mechanic: "right-click use", constraint: "durability or cooldown" },
} as const;

export type BehaviorIntentKey = keyof typeof BEHAVIOR_INTENT_TO_VANILLA;
