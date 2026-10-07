import { z } from "zod";

export const Importance = z.enum(["must-have", "nice-to-have"]);
export const Status = z.enum(["matched", "gap"]);

/** A single requirement extracted from a job description. */
export const Requirement = z.object({
  text: z.string().trim().min(1),
  importance: Importance,
});

const classificationFields = {
  status: Status,
  evidence: z.string().nullable().default(null),
};

/** A matched requirement needs evidence; a gap must not have any. */
function checkEvidence(value, ctx) {
  if (value.status === "matched" && !value.evidence?.trim()) {
    ctx.addIssue({ code: "custom", message: "a matched requirement must have evidence" });
  }
  if (value.status === "gap" && value.evidence !== null) {
    ctx.addIssue({ code: "custom", message: "a gap requirement must not have evidence" });
  }
}

/** Whether the resume shows a requirement, with evidence for a match. */
export const Classification = z.object(classificationFields).superRefine(checkEvidence);

/** A requirement together with its final classification. */
export const ClassifiedRequirement = Requirement.extend(classificationFields).superRefine(checkEvidence);

/** The longest verdict allowed, in characters. */
export const MAX_VERDICT_LENGTH = 600;

/** A summary of the analysis: an LLM-written verdict plus code-built lists of what's missing. */
export const Summary = z.object({
  verdict: z.string().trim().min(1).max(MAX_VERDICT_LENGTH).nullable(),
  missingMustHaves: z.array(z.string()),
  missingNiceToHaves: z.array(z.string()),
});

/** The result of one analysis run. `summary` is null when there are no requirements. */
export const Report = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  requirements: z.array(ClassifiedRequirement),
  summary: Summary.nullable(),
});
