/**
 * Extract explicit entity lists and hard constraints from prompt.
 * Patterns: "Add N items: A, B, C", "items (A, B, C)", "No blocks", "No recipes".
 * Preserves capitalization for display names; splits on commas and " and ".
 */

export type ExtractedEntity = { displayName: string; type: "item" | "block" };

export interface EntityListExtraction {
  entities: ExtractedEntity[];
  noBlocks: boolean;
  noRecipes: boolean;
}

/** Split list text on commas and " and ", trim; preserve original capitalization for displayName. */
function splitList(listText: string): string[] {
  return listText
    .replace(/\s+and\s+/gi, ",")
    .split(",")
    .map((s) => s.trim().replace(/\.+$/, ""))
    .filter((s) => s.length > 0);
}

/**
 * Extract entity list and constraints. Returns empty entities if no list pattern matches.
 */
export function extractEntityList(prompt: string): EntityListExtraction {
  const lower = prompt.toLowerCase().trim();
  const noBlocks = /\bno\s+blocks?\b/.test(lower);
  const noRecipes = /\bno\s+recipes?\b/.test(lower);

  const entities: ExtractedEntity[] = [];

  // "Add three items: Ruby, Sapphire, Raw Tin" or "Add 3 items: A, B, C"
  const itemsListMatch = prompt.match(/\badd\s+(?:one|two|three|four|five|\d+)\s+items?\s*:\s*([^.]+\.?)/i);
  if (itemsListMatch) {
    const list = splitList(itemsListMatch[1]);
    for (const name of list) {
      if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "item" });
    }
  }

  // "items: Ruby, Sapphire, Raw Tin" (no "Add N")
  if (entities.length === 0) {
    const itemsColonMatch = prompt.match(/\bitems?\s*:\s*([^.]+\.?)/i);
    if (itemsColonMatch) {
      const list = splitList(itemsColonMatch[1]);
      for (const name of list) {
        if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "item" });
      }
    }
  }

  // "Add two blocks: Marble Block, Slate Block"
  const blocksListMatch = prompt.match(/\badd\s+(?:one|two|three|four|five|\d+)\s+blocks?\s*:\s*([^.]+\.?)/i);
  if (blocksListMatch) {
    const list = splitList(blocksListMatch[1]);
    for (const name of list) {
      if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "block" });
    }
  }

  if (entities.length === 0) {
    const blocksColonMatch = prompt.match(/\bblocks?\s*:\s*([^.]+\.?)/i);
    if (blocksColonMatch) {
      const list = splitList(blocksColonMatch[1]);
      for (const name of list) {
        if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "block" });
      }
    }
  }

  // "Add items (Ruby, Sapphire) and block (Marble Block)" — mixed
  if (entities.length === 0) {
    const itemsParenMatch = prompt.match(/\bitems?\s*\(\s*([^)]+)\)/i);
    if (itemsParenMatch) {
      const list = splitList(itemsParenMatch[1]);
      for (const name of list) {
        if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "item" });
      }
    }
    const blocksParenMatch = prompt.match(/\bblocks?\s*\(\s*([^)]+)\)/i);
    if (blocksParenMatch) {
      const list = splitList(blocksParenMatch[1]);
      for (const name of list) {
        if (name && !/^\s*$/.test(name)) entities.push({ displayName: name, type: "block" });
      }
    }
  }

  return { entities, noBlocks, noRecipes };
}
