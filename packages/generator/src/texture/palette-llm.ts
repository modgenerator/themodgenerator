/**
 * Palette and motif generation (LLM-like). NEVER throws. NEVER returns grayscale-only palettes.
 * MUST ALWAYS return ≥ 3 colors. Nonsense → evocative fantasy palettes.
 * When LLM unavailable, deterministic heuristics. Motifs describe visual intent.
 */

import type { SemanticTag } from "../item-block-primitives.js";
import type { AestheticProfile } from "../item-block-primitives.js";

/** True if hex is grayscale (R ≈ G ≈ B within tolerance). */
function isGrayHex(hex: string, tolerance = 25): boolean {
  const m = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!m) return true;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= tolerance;
}

/** MUST NEVER return grayscale-only: at least one color must have distinct hue. */
function ensureNotGrayscaleOnly(colors: string[], seed: string): string[] {
  if (colors.length === 0) return FANTASY_PALETTES[0].slice(0, 5);
  const allGray = colors.every((c) => isGrayHex(c));
  if (!allGray) return colors;
  const pal = FANTASY_PALETTES[pick(seed + "nogray", FANTASY_PALETTES.length)];
  return pal.slice(0, Math.max(3, colors.length));
}

export type GeneratedPalette = {
  colors: string[]; // 3–6 hex values
  primaryMotif: string;
  secondaryMotifs: string[];
  contrastLevel: "low" | "medium" | "high";
};

export type PaletteLLMInput = {
  prompt: string;
  semanticTags: SemanticTag[];
  aesthetic: AestheticProfile;
  seed: string;
};

/** Deterministic hash from string. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick index in [0, len) from seed. */
function pick(seed: string, len: number): number {
  return hash(seed) % Math.max(1, len);
}

const FANTASY_PALETTES: string[][] = [
  ["#9370DB", "#8A2BE2", "#DA70D6", "#4B0082", "#9932CC"],
  ["#4169E1", "#1E90FF", "#00BFFF", "#87CEEB", "#4682B4"],
  ["#2E8B57", "#3CB371", "#20B2AA", "#48D1CC", "#00FA9A"],
  ["#DEB887", "#D2691E", "#CD853F", "#F4A460", "#BC8F8F"],
];

const PASTEL_PALETTES: string[][] = [
  ["#FFF5EE", "#FFE4E1", "#DEB887", "#F5DEB3", "#FFEFD5"],
  ["#E0FFFF", "#B0E0E6", "#AFEEEE", "#87CEEB", "#ADD8E6"],
  ["#FFB6C1", "#FFC0CB", "#FFE4E1", "#FFF0F5", "#FFDAB9"],
];

const SICKLY_PALETTES: string[][] = [
  ["#9ACD32", "#ADFF2F", "#7CFC00", "#556B2F", "#6B8E23"],
  ["#808000", "#BDB76B", "#9ACD32", "#ADFF2F", "#7FFF00"],
];

const MOTIFS = {
  fantasy: ["arcane crystals", "ethereal glow", "magical veins", "enchanted swirls"],
  pastel: ["creamy swirl", "soft gradient", "smooth blend", "gentle waves"],
  sickly: ["glowing veins", "radioactive speckles", "toxic cracks", "hazard stripes"],
  cute: ["soft dots", "rounded shapes", "gentle curves", "fluffy texture"],
  default: ["organic variation", "natural noise", "subtle detail", "layered depth"],
};

/**
 * Generate palette and motifs from prompt + semantic + aesthetic. NEVER fails.
 * Uses deterministic heuristic (no LLM call); output replaces hard-coded colorPalette when present.
 */
export function generatePaletteAndMotifs(input: PaletteLLMInput): GeneratedPalette {
  const { prompt, semanticTags, aesthetic, seed } = input;
  const text = (prompt || "").toLowerCase().trim();
  const tags = semanticTags.map((t) => (typeof t === "string" ? t.toLowerCase() : ""));

  let colors: string[];
  let primaryMotif: string;
  let secondaryMotifs: string[];
  let contrastLevel: GeneratedPalette["contrastLevel"] = "medium";

  // ice cream → pastel, creamy, swirled
  if (/\b(ice\s*cream|ice cream)\b/.test(text) || (tags.includes("food") && tags.includes("cold"))) {
    const pal = PASTEL_PALETTES[pick(seed + "ice", PASTEL_PALETTES.length)];
    colors = (aesthetic.colorPalette?.length ? aesthetic.colorPalette : pal).slice(0, 6);
    if (colors.length < 3) colors = [...colors, ...pal].slice(0, 6);
    primaryMotif = "creamy swirled";
    secondaryMotifs = ["soft gradient", "gentle waves"];
    contrastLevel = "low";
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  // radioactive cheese / dangerous + food → sickly green/yellow, glowing veins
  if (
    /\b(radioactive|poison|toxic)\b/.test(text) ||
    (tags.includes("radioactive") || (tags.includes("dangerous") && tags.includes("food")))
  ) {
    const pal = SICKLY_PALETTES[pick(seed + "rad", SICKLY_PALETTES.length)];
    colors = (aesthetic.colorPalette?.length ? aesthetic.colorPalette : pal).slice(0, 6);
    if (colors.length < 3) colors = [...colors, ...pal].slice(0, 6);
    primaryMotif = MOTIFS.sickly[pick(seed + "m1", MOTIFS.sickly.length)];
    secondaryMotifs = ["radioactive speckles", "glowing veins"];
    contrastLevel = "high";
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  // magical / dream / cute
  if (
    tags.includes("magical") ||
    tags.includes("strange") ||
    /\b(magic|dream|arcane)\b/.test(text)
  ) {
    const pal = FANTASY_PALETTES[pick(seed + "mag", FANTASY_PALETTES.length)];
    colors = (aesthetic.colorPalette?.length ? aesthetic.colorPalette : pal).slice(0, 6);
    if (colors.length < 3) colors = [...colors, ...pal].slice(0, 6);
    primaryMotif = MOTIFS.fantasy[pick(seed + "m2", MOTIFS.fantasy.length)];
    secondaryMotifs = ["ethereal glow", "enchanted swirls"];
    contrastLevel = "medium";
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  if (tags.includes("cute") || /\b(cute|soft|fluffy)\b/.test(text)) {
    const pal = PASTEL_PALETTES[pick(seed + "cute", PASTEL_PALETTES.length)];
    colors = (aesthetic.colorPalette?.length ? aesthetic.colorPalette : pal).slice(0, 6);
    if (colors.length < 3) colors = [...colors, ...pal].slice(0, 6);
    primaryMotif = MOTIFS.cute[pick(seed + "m3", MOTIFS.cute.length)];
    secondaryMotifs = ["gentle curves", "soft dots"];
    contrastLevel = "low";
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  // dangerous / dark
  if (tags.includes("dangerous")) {
    const pal = ["#2F4F4F", "#1C1C1C", "#4A3728", "#556B2F", "#6B8E23"];
    colors = (aesthetic.colorPalette?.length ? aesthetic.colorPalette : pal).slice(0, 6);
    if (colors.length < 3) colors = [...colors, ...pal].slice(0, 6);
    primaryMotif = "dark veins";
    secondaryMotifs = ["crackle", "shadow"];
    contrastLevel = "high";
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  // Use aesthetic palette when present and sufficient (never grayscale-only)
  if (aesthetic.colorPalette?.length >= 3) {
    colors = aesthetic.colorPalette.slice(0, 6);
    colors = ensureNotGrayscaleOnly(colors, seed);
    primaryMotif = MOTIFS.default[pick(seed, MOTIFS.default.length)];
    secondaryMotifs = ["natural noise", "subtle detail"];
    return { colors, primaryMotif, secondaryMotifs, contrastLevel };
  }

  // Evocative fallback: fantasy, never grayscale (e.g. xyzzysnorf)
  const pal = FANTASY_PALETTES[pick(seed + "fallback", FANTASY_PALETTES.length)];
  colors = pal.slice(0, 5);
  primaryMotif = "arcane crystal fantasy";
  secondaryMotifs = ["ethereal glow", "magical veins"];
  contrastLevel = "medium";
  return { colors, primaryMotif, secondaryMotifs, contrastLevel };
}
