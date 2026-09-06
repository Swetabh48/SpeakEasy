import { describe, expect, it } from "vitest";
import { evaluateLocalStrict } from "@/lib/evaluation/localScore";
import type { EvaluationRequest } from "@/lib/evaluation/types";

function base(over: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return {
    kind: "speech",
    topic: "Climate policy and urban flooding in India",
    mode: "impromptu",
    examId: null,
    examName: null,
    difficulty: "standard",
    category: "governance",
    transcriptOrEssay: "",
    durationSec: 60,
    targetSec: 120,
    ...over,
  };
}

describe("evaluateLocalStrict", () => {
  it("scores empty speech as zero with insufficient evidence", () => {
    const r = evaluateLocalStrict(base({ transcriptOrEssay: "", durationSec: 3 }));
    expect(r.overallScore).toBe(0);
    expect(r.insufficientEvidence).toBe(true);
    expect(r.source).toBe("local-strict");
    expect(r.scores.every((s) => s.value === 0)).toBe(true);
  });

  it("scores tiny garbage transcript near zero", () => {
    const r = evaluateLocalStrict(
      base({ transcriptOrEssay: "um uh yeah", durationSec: 5 }),
    );
    expect(r.overallScore).toBe(0);
    expect(r.insufficientEvidence).toBe(true);
  });

  it("flags short speech under word threshold as insufficient", () => {
    const r = evaluateLocalStrict(
      base({
        transcriptOrEssay:
          "I think flooding is bad in cities and we need drains maybe.",
        durationSec: 20,
      }),
    );
    expect(r.insufficientEvidence).toBe(true);
    expect(r.overallScore).toBeLessThan(40);
  });

  it("does not give high marks for filler-heavy off-topic speech", () => {
    const r = evaluateLocalStrict(
      base({
        topic: "Satellite internet regulation in Japan",
        transcriptOrEssay:
          "Um like you know basically I mean uh like yeah so like food is tasty and I like cricket basically you know um actually whatever.",
        durationSec: 90,
        targetSec: 120,
      }),
    );
    expect(r.overallScore).toBeLessThan(55);
  });

  it("rewards on-topic structured speech with higher score than empty", () => {
    const r = evaluateLocalStrict(
      base({
        transcriptOrEssay: `
          I believe urban flooding in India is worsened by clogged drains and unplanned concretisation.
          First, municipal bodies must clear stormwater channels before monsoon.
          Second, housing permits should require permeable surfaces.
          However, funding gaps remain in tier-two cities.
          Therefore, a national urban flood mission with clear accountability is needed.
          On the other hand, citizen reporting apps can speed local response.
        `,
        durationSec: 110,
        targetSec: 120,
      }),
    );
    expect(r.insufficientEvidence).toBe(false);
    expect(r.overallScore).toBeGreaterThan(35);
    expect(r.wordCount).toBeGreaterThan(40);
  });

  it("essay requires much more text than speech", () => {
    const short = evaluateLocalStrict(
      base({
        kind: "essay",
        transcriptOrEssay: "Climate change is real and flooding is a problem in cities today.",
        durationSec: 600,
        targetSec: 600,
      }),
    );
    expect(short.insufficientEvidence).toBe(true);

    const longText = Array.from({ length: 40 }, (_, i) =>
      `Paragraph ${i}: urban flooding policy needs drains, wetlands, and accountable municipal budgets in India.`,
    ).join(" ");
    const long = evaluateLocalStrict(
      base({
        kind: "essay",
        transcriptOrEssay: longText,
        durationSec: 600,
        targetSec: 600,
      }),
    );
    expect(long.wordCount).toBeGreaterThan(120);
    expect(long.insufficientEvidence).toBe(false);
  });

  it("ending speech almost immediately cannot earn strong time marks", () => {
    const r = evaluateLocalStrict(
      base({
        transcriptOrEssay:
          "Climate policy matters for flooding. Cities need better drains and planning before monsoon season arrives every year across India.",
        durationSec: 5,
        targetSec: 120,
      }),
    );
    const timeDim = r.scores.find((s) => /time|discipline|pace/i.test(s.label));
    if (timeDim) expect(timeDim.value).toBeLessThan(30);
    expect(r.overallScore).toBeLessThan(70);
  });
});
