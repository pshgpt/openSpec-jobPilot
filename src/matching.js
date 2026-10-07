import { z } from "zod";

import { AnalysisError } from "./errors.js";
import { Status } from "./models.js";

/** What the model returns: one entry per numbered requirement. */
export const ClassificationOutput = z.object({
  classifications: z.array(
    z.object({
      index: z.number().int().describe("The number of the requirement being classified."),
      status: Status,
      evidence: z
        .string()
        .nullable()
        .describe("For a match: a phrase copied word for word from the resume. For a gap: null."),
    }),
  ),
});

export const MATCHING_SYSTEM_PROMPT = `You compare a candidate's resume against a numbered list of job requirements.

For every requirement, decide whether the resume shows that the candidate has it:
- "matched": the resume shows the skill, qualification, or experience. Different wording counts, such as a synonym, an abbreviation, or an equivalent technology name (for example "Postgres" for "PostgreSQL").
- "gap": the resume does not show it.

For each "matched" requirement, give as evidence a phrase copied exactly, word for word, from the resume. Do not paraphrase, shorten, or combine phrases; the evidence is checked against the resume text and a match whose evidence cannot be found is counted as a gap. For each "gap", set evidence to null.

Classify every requirement exactly once, using its number as the index. Do not skip any and do not add any.`;

/**
 * @param {import("./llm.js").Llm} llm
 * @param {Array<{text: string, importance: string}>} requirements
 * @param {string} resume
 * @returns {Promise<Array<{text: string, importance: string, status: "matched" | "gap", evidence: string | null}>>}
 */
export async function classifyRequirements(llm, requirements, resume) {
  if (requirements.length === 0) return [];

  const numbered = requirements.map((req, i) => `${i + 1}. ${req.text}`).join("\n");
  const output = await llm.parse({
    system: MATCHING_SYSTEM_PROMPT,
    user: `<requirements>\n${numbered}\n</requirements>\n\n<resume>\n${resume}\n</resume>`,
    schema: ClassificationOutput,
  });

  const byIndex = indexClassifications(output, requirements.length);
  return requirements.map((req, i) => ({ ...req, ...verifyEvidence(byIndex.get(i + 1), resume) }));
}

/** Check that every requirement number 1..count appears exactly once, and nothing else. */
function indexClassifications(output, count) {
  const parsed = ClassificationOutput.safeParse(output);
  if (!parsed.success) {
    throw new AnalysisError(`The classifications were not valid: ${z.prettifyError(parsed.error)}`);
  }

  const byIndex = new Map();
  for (const item of parsed.data.classifications) {
    if (item.index < 1 || item.index > count) {
      throw new AnalysisError(`The model classified requirement ${item.index}, but there are only ${count}.`);
    }
    if (byIndex.has(item.index)) {
      throw new AnalysisError(`The model classified requirement ${item.index} more than once.`);
    }
    byIndex.set(item.index, item);
  }
  for (let index = 1; index <= count; index++) {
    if (!byIndex.has(index)) {
      throw new AnalysisError(`The model did not classify requirement ${index}.`);
    }
  }
  return byIndex;
}

/** Lowercase and collapse every run of whitespace to one space. */
export function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Keep a match only if its evidence appears in the resume (ignoring case and spacing).
 * Anything else is reported as a gap with no evidence.
 */
export function verifyEvidence({ status, evidence }, resume) {
  if (status === "matched" && evidence?.trim() && normalize(resume).includes(normalize(evidence))) {
    return { status: "matched", evidence: evidence.trim() };
  }
  return { status: "gap", evidence: null };
}
