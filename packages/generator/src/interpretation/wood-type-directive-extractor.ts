/**
 * Extract wood-type directives from prompt so interpreter can set spec.woodTypes
 * instead of a standalone item. Recognizes: "wood type called X", "new wood type X",
 * "add a wood type named X", "add a new wood called X", "wood types: X, Y".
 */

export interface ExtractedWoodType {
  id: string;
  displayName: string;
}

export interface WoodTypeExtraction {
  woodTypes: ExtractedWoodType[];
  matched: boolean;
}

const MAX_ID_LEN = 32;

function slugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_ID_LEN) || "wood";
  return /^[a-z]/.test(slug) ? slug : "wood_" + slug;
}

function toTitleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .slice(0, 48) || "Wood";
}

function splitList(listText: string): string[] {
  return listText
    .replace(/\s+and\s+/gi, ",")
    .split(",")
    .map((s) => s.trim().replace(/\.+$/, ""))
    .filter((s) => s.length > 0);
}

/**
 * Extract wood type(s) from prompt. If matched, interpreter must set spec.woodTypes
 * and must NOT add a standalone item with that id/name.
 */
export function extractWoodTypes(prompt: string): WoodTypeExtraction {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  const woodTypes: ExtractedWoodType[] = [];

  // "wood types: Maple, Cherry" or "wood types: Maple and Cherry"
  const woodTypesColon = lower.match(/\bwood\s+types?\s*:\s*([^.]+\.?)/i);
  if (woodTypesColon) {
    const list = splitList(woodTypesColon[1]);
    for (const name of list) {
      if (name) {
        woodTypes.push({
          id: slugFromName(name),
          displayName: toTitleCase(name),
        });
      }
    }
    if (woodTypes.length > 0) return { woodTypes, matched: true };
  }

  // "wood type called Maple" / "new wood type called Maple"
  const calledMatch = trimmed.match(/\b(?:new\s+)?wood\s+types?\s+called\s+([a-zA-Z][a-zA-Z0-9\s]*?)(?=\s*[.,]|\s+and\s|$)/i);
  if (calledMatch) {
    const name = calledMatch[1].trim().replace(/\s+/g, " ").slice(0, 48);
    if (name) {
      woodTypes.push({ id: slugFromName(name), displayName: toTitleCase(name) });
      return { woodTypes, matched: true };
    }
  }

  // "new wood type Maple" / "add a wood type Maple"
  const typeNameMatch = trimmed.match(/\b(?:add\s+(?:a\s+)?(?:new\s+)?)?wood\s+types?\s+(?:named\s+)?([a-zA-Z][a-zA-Z0-9\s]*?)(?=\s*[.,]|\s+and\s|$)/i);
  if (typeNameMatch) {
    const name = typeNameMatch[1].trim().replace(/\s+/g, " ").slice(0, 48);
    if (name) {
      woodTypes.push({ id: slugFromName(name), displayName: toTitleCase(name) });
      return { woodTypes, matched: true };
    }
  }

  // "add a new wood called Maple" / "new wood called Maple"
  const woodCalledMatch = trimmed.match(/\b(?:add\s+(?:a\s+)?(?:new\s+)?)?wood\s+called\s+([a-zA-Z][a-zA-Z0-9\s]*?)(?=\s*[.,]|\s+and\s|$)/i);
  if (woodCalledMatch) {
    const name = woodCalledMatch[1].trim().replace(/\s+/g, " ").slice(0, 48);
    if (name) {
      woodTypes.push({ id: slugFromName(name), displayName: toTitleCase(name) });
      return { woodTypes, matched: true };
    }
  }

  return { woodTypes: [], matched: false };
}
