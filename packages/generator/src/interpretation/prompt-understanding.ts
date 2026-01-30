/**
 * ChatGPT-style prompt understanding: spelling tolerance, nonsense detection, contradiction detection.
 * Clarification improves quality — it never reduces power. Only ask when genuinely unclear.
 */

export type PromptAnalysis = {
  normalizedPrompt: string;
  confidence: "high" | "medium" | "low";
  detectedIntent?: {
    kind?: "item" | "block" | "system";
    concepts: string[];
  };
  issues: PromptIssue[];
};

export type PromptIssue =
  | { type: "nonsense"; reason: string }
  | { type: "contradiction"; details: string[] }
  | { type: "underspecified"; suggestions: string[] };

/** Known typos / fuzzy corrections (spelling MUST NOT lower confidence if recoverable). */
const SPELLING_CORRECTIONS: Record<string, string> = {
  creem: "cream",
  cheeze: "cheese",
  chese: "cheese",
  radiactive: "radioactive",
  radioactiv: "radioactive",
  magickal: "magical",
  magikal: "magical",
  crystle: "crystal",
  crystel: "crystal",
  glowwing: "glowing",
  glowin: "glowing",
  frezen: "frozen",
  froozen: "frozen",
  brik: "brick",
  blok: "block",
  blck: "block",
  spon: "spoon",
  spooon: "spoon",
  sweerd: "sword",
  swrod: "sword",
  dreem: "dream",
  drem: "dream",
  curced: "cursed",
  cursd: "cursed",
  golen: "golden",
  golden: "golden",
  glden: "golden",
  icecream: "ice cream",
  icecreem: "ice cream",
};

/** Words that count as semantic concepts (nouns, materials, adjectives, fantasy). */
const CONCEPT_WORDS = new Set([
  "ice", "cream", "cheese", "food", "block", "brick", "stone", "magic", "magical", "glow", "glowing",
  "radioactive", "dangerous", "cold", "hot", "frozen", "fire", "dream", "crystal", "golden", "gold",
  "spoon", "sword", "tool", "weapon", "cute", "soft", "blue", "red", "green", "strange", "mysterious",
  "organic", "metal", "wood", "slime", "energy", "wet", "dry", "ancient", "cursed", "sweet", "edible",
  "feeling", "thing", "something", "magic", "arcane", "fantasy", "mystic", "enchanted", "liquid",
  "solid", "intangible", "tiny", "world", "armor", "wearable", "machine", "cold", "hot", "frozen",
  "warm", "frost", "veins", "sparkle", "pulse", "drip", "wave", "fluffy", "plush", "pastel", "sickly",
  "lava", "snow", "fire", "flame",
]);

/** Abstract / metaphorical phrases that mean we should NOT treat as nonsense. */
const ABSTRACT_PATTERNS = [
  /\b(feeling|something|thing that feels|a bit like|kind of|sort of)\b/i,
  /\b(strange|mysterious|magical|weird|odd|curious)\b/i,
  /\b(abstract|metaphor|concept)\b/i,
  /\b(turned into|become|like a)\b/i,
];

/** Contradiction pairs: (tag or concept A, tag or concept B) → ask. */
const CONTRADICTION_PAIRS: [string[], string[]][] = [
  [["hot", "fire", "flame", "lava", "burn"], ["frozen", "cold", "ice", "snow", "frost"]],
  [["liquid", "water", "flow"], ["solid", "stone", "brick", "block"]],
  [["edible", "food", "eat"], ["intangible", "machine", "ghost"]],
  [["tiny", "small"], ["world", "world-sized", "planet"]],
  [["block", "brick", "placeable"], ["wearable", "armor", "equip"]],
];

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Normalize word: apply known corrections, then fuzzy match to concept list if close. */
function normalizeWord(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!lower) return word;
  const corrected = SPELLING_CORRECTIONS[lower] ?? lower;
  if (CONCEPT_WORDS.has(corrected)) return corrected;
  // Fuzzy: if edit distance 1–2 to a concept, use it (spelling tolerance)
  let best = corrected;
  let bestDist = 3;
  for (const c of CONCEPT_WORDS) {
    if (c.length < 3) continue;
    const d = editDistance(corrected, c);
    if (d < bestDist && d <= 2) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= 2 ? best : corrected;
}

/** Normalize full prompt: correct spelling, collapse repeated spaces. */
function normalizePrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/).map(normalizeWord);
  return words.join(" ").replace(/\s+/g, " ").trim();
}

/** Extract concepts from text (after normalization). */
function extractConcepts(text: string): string[] {
  const lower = text.toLowerCase();
  const concepts: string[] = [];
  const tokens = lower.split(/\s+/).map((t) => t.replace(/[^a-z]/g, ""));
  for (const token of tokens) {
    if (token.length < 2) continue;
    const normalized = normalizeWord(token);
    if (CONCEPT_WORDS.has(normalized)) concepts.push(normalized);
  }
  // Bigrams that are concepts
  for (const phrase of ["ice cream", "radioactive cheese", "dream brick", "cursed golden spoon", "golden spoon"]) {
    if (lower.includes(phrase)) {
      for (const w of phrase.split(" ")) {
        if (CONCEPT_WORDS.has(w)) concepts.push(w);
      }
    }
  }
  return [...new Set(concepts)];
}

/** True if text looks like abstract/metaphorical English (do NOT treat as nonsense). */
function isAbstractOrMetaphorical(text: string): boolean {
  return ABSTRACT_PATTERNS.some((re) => re.test(text));
}

/** Nonsense ONLY if: no concepts AND fuzzy didn't recover AND not abstract. */
function isNonsense(normalized: string, concepts: string[]): boolean {
  if (concepts.length > 0) return false;
  if (isAbstractOrMetaphorical(normalized)) return false;
  // Keyboard smash: many short tokens, no known word
  const tokens = normalized.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const anyKnown = tokens.some((t) => CONCEPT_WORDS.has(normalizeWord(t)));
  if (anyKnown) return false;
  if (tokens.length >= 3) return true; // e.g. "aesho faesf asdofh"
  if (normalized.length >= 10 && concepts.length === 0) return true;
  return false;
}

/** Detect contradiction pairs in concepts. */
function detectContradictions(concepts: string[]): string[] {
  const set = new Set(concepts.map((c) => c.toLowerCase()));
  const details: string[] = [];
  for (const [groupA, groupB] of CONTRADICTION_PAIRS) {
    const hasA = groupA.some((a) => set.has(a));
    const hasB = groupB.some((b) => set.has(b));
    if (hasA && hasB) {
      const a = groupA.find((x) => set.has(x));
      const b = groupB.find((x) => set.has(x));
      if (a && b) details.push(`${a} and ${b}`);
    }
  }
  return details;
}

/** Infer kind from concepts. */
function inferKind(concepts: string[]): "item" | "block" | "system" {
  if (concepts.some((c) => ["block", "brick", "stone", "wall", "slab", "stairs"].includes(c))) return "block";
  return "item";
}

/**
 * Analyze prompt intent: normalize spelling, extract concepts, detect nonsense/contradiction.
 * Spelling mistakes MUST NOT lower confidence if intent is recoverable.
 */
export function analyzePromptIntent(prompt: string): PromptAnalysis {
  const raw = (prompt ?? "").trim() || "";
  const normalizedPrompt = raw ? normalizePrompt(raw) : "";
  const concepts = extractConcepts(normalizedPrompt);
  const issues: PromptIssue[] = [];

  const nonsense = isNonsense(normalizedPrompt, concepts);
  if (nonsense) {
    issues.push({
      type: "nonsense",
      reason: "No recognizable item or block ideas could be found, and the text doesn't look like a metaphor or abstract description.",
    });
  }

  const contradictionDetails = detectContradictions(concepts);
  if (contradictionDetails.length > 0) {
    issues.push({ type: "contradiction", details: contradictionDetails });
  }

  const underspecified = concepts.length <= 1 && !nonsense && contradictionDetails.length === 0;
  if (underspecified && concepts.length === 0 && normalizedPrompt.length > 0) {
    issues.push({
      type: "underspecified",
      suggestions: ["a glowing crystal", "a strange magical food", "a mysterious block"],
    });
  }

  let confidence: PromptAnalysis["confidence"] = "high";
  if (nonsense || issues.some((i) => i.type === "nonsense")) confidence = "low";
  else if (contradictionDetails.length > 0) confidence = "medium";
  else if (underspecified && concepts.length === 0) confidence = "medium";
  else if (concepts.length > 0) confidence = "high";

  return {
    normalizedPrompt: normalizedPrompt || raw,
    confidence,
    detectedIntent:
      concepts.length > 0 || normalizedPrompt.length > 0
        ? { kind: inferKind(concepts), concepts }
        : undefined,
    issues,
  };
}
