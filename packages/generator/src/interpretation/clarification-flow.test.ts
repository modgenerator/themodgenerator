/**
 * PART 8 — Clarification flow tests. Logic-only: structure and decisions.
 * No snapshot tests. Assert: clarification requested vs proceed, normalized prompt, interpretation.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzePromptIntent } from "./prompt-understanding.js";
import { clarificationGate, interpretWithClarification } from "./index.js";
import { interpretItemOrBlock } from "../interpretation.js";

describe("analyzePromptIntent", () => {
  it('"ice creem" normalizes to ice cream and has recoverable intent', () => {
    const analysis = analyzePromptIntent("ice creem");
    assert.ok(analysis.normalizedPrompt.toLowerCase().includes("cream"));
    assert.ok(analysis.confidence === "high" || analysis.confidence === "medium");
    assert.ok(
      analysis.detectedIntent?.concepts?.includes("cream") || analysis.detectedIntent?.concepts?.includes("ice"),
      "concepts should include cream or ice"
    );
    assert.ok(!analysis.issues.some((i) => i.type === "nonsense"));
  });

  it('"radioactive cheeze" normalizes and has concepts', () => {
    const analysis = analyzePromptIntent("radioactive cheeze");
    assert.ok(analysis.normalizedPrompt.toLowerCase().includes("cheese"));
    assert.ok(
      analysis.detectedIntent?.concepts?.includes("radioactive") || analysis.detectedIntent?.concepts?.includes("cheese")
    );
    assert.ok(!analysis.issues.some((i) => i.type === "nonsense"));
  });

  it('"aesho faesf asdofh" is nonsense (no semantic recovery)', () => {
    const analysis = analyzePromptIntent("aesho faesf asdofh");
    assert.ok(analysis.issues.some((i) => i.type === "nonsense"));
    assert.strictEqual(analysis.confidence, "low");
  });

  it('"hot frozen cheese" has contradiction (hot + frozen)', () => {
    const analysis = analyzePromptIntent("hot frozen cheese");
    assert.ok(analysis.issues.some((i) => i.type === "contradiction"));
    assert.ok(analysis.confidence === "medium" || analysis.confidence === "low");
  });

  it('"a strange magical feeling" has concepts and is not nonsense', () => {
    const analysis = analyzePromptIntent("a strange magical feeling");
    assert.ok(!analysis.issues.some((i) => i.type === "nonsense"));
    const conceptCount = analysis.detectedIntent?.concepts?.length ?? 0;
    assert.ok(
      conceptCount > 0 || analysis.confidence !== "low",
      "should have concepts or not be low confidence"
    );
  });
});

describe("clarificationGate", () => {
  it('"aesho faesf asdofh" → request_clarification', () => {
    const analysis = analyzePromptIntent("aesho faesf asdofh");
    const response = clarificationGate(analysis);
    assert.strictEqual(response.type, "request_clarification");
    assert.ok(response.message.length > 0);
    assert.ok(!response.message.toLowerCase().includes("error"));
    assert.ok(!response.message.toLowerCase().includes("invalid"));
    assert.ok(!response.message.toLowerCase().includes("unsupported"));
  });

  it('"ice creem" → proceed with normalized prompt', () => {
    const analysis = analyzePromptIntent("ice creem");
    const response = clarificationGate(analysis);
    assert.strictEqual(response.type, "proceed");
    assert.ok(response.prompt.length > 0);
    assert.ok(response.prompt.toLowerCase().includes("cream"));
  });

  it('"hot frozen cheese" → request_clarification (contradiction)', () => {
    const analysis = analyzePromptIntent("hot frozen cheese");
    const response = clarificationGate(analysis);
    assert.strictEqual(response.type, "request_clarification");
    assert.ok(response.message.length > 0);
  });

  it('"a strange magical feeling" → proceed', () => {
    const analysis = analyzePromptIntent("a strange magical feeling");
    const response = clarificationGate(analysis);
    assert.strictEqual(response.type, "proceed");
    assert.ok(response.prompt.length > 0);
  });

  it('"radioactive cheeze" → proceed', () => {
    const analysis = analyzePromptIntent("radioactive cheeze");
    const response = clarificationGate(analysis);
    assert.strictEqual(response.type, "proceed");
    assert.ok(response.prompt.length > 0);
  });

  it('"hot frozen cheese block" with blockOnly → proceed (cosmetic gating; no second ask)', () => {
    const analysis = analyzePromptIntent("hot frozen cheese block");
    assert.ok(analysis.issues.some((i) => i.type === "contradiction"));
    const responseWithoutBlockOnly = clarificationGate(analysis);
    assert.strictEqual(responseWithoutBlockOnly.type, "request_clarification");
    const responseWithBlockOnly = clarificationGate(analysis, { blockOnly: true });
    assert.strictEqual(responseWithBlockOnly.type, "proceed", "block-only + cosmetic contradiction must proceed without asking");
  });
});

describe("interpretWithClarification invariants", () => {
  it("never throws on user input and always returns request_clarification or proceed", () => {
    const inputs = ["", "   ", "magic wand", "aesho faesf", "ice cream", null as unknown as string, undefined as unknown as string];
    for (const input of inputs) {
      let response;
      assert.doesNotThrow(() => {
        response = interpretWithClarification(input);
      }, `interpretWithClarification must not throw for: ${JSON.stringify(input)}`);
      assert.ok(response!.type === "request_clarification" || response!.type === "proceed");
    }
  });
});

describe("interpretWithClarification + interpretItemOrBlock (integration)", () => {
  it('"aesho faesf asdofh" → clarification; no generation', () => {
    const response = interpretWithClarification("aesho faesf asdofh");
    assert.strictEqual(response.type, "request_clarification");
  });

  it('"ice creem" → proceed → interpretItemOrBlock yields ice cream item', () => {
    const response = interpretWithClarification("ice creem");
    assert.strictEqual(response.type, "proceed");
    const interpreted = interpretItemOrBlock(response.prompt);
    assert.ok(interpreted != null);
    assert.ok(interpreted.semanticTags.includes("food") || interpreted.semanticTags.includes("cold"));
    assert.ok(interpreted.item != null || interpreted.block != null);
  });

  it('"hot frozen cheese" → clarification; no generation', () => {
    const response = interpretWithClarification("hot frozen cheese");
    assert.strictEqual(response.type, "request_clarification");
  });

  it('"a strange magical feeling" → proceed → evocative fantasy item', () => {
    const response = interpretWithClarification("a strange magical feeling");
    assert.strictEqual(response.type, "proceed");
    const interpreted = interpretItemOrBlock(response.prompt);
    assert.ok(interpreted != null);
    assert.ok(interpreted.semanticTags.length > 0);
    assert.ok(interpreted.aesthetic.colorPalette.length > 0);
  });

  it('"radioactive cheeze" → proceed → radioactive cheese item', () => {
    const response = interpretWithClarification("radioactive cheeze");
    assert.strictEqual(response.type, "proceed");
    const interpreted = interpretItemOrBlock(response.prompt);
    assert.ok(interpreted != null);
    assert.ok(
      interpreted.semanticTags.includes("dangerous") ||
        interpreted.semanticTags.includes("radioactive") ||
        interpreted.semanticTags.includes("food")
    );
  });
});
