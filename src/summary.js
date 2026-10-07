import { z } from "zod";

import { AnalysisError } from "./errors.js";
import { MAX_VERDICT_LENGTH } from "./models.js";

/**
 * What the model returns. The length and "%" rules are checked in code, because
 * Gemini's JSON-schema support doesn't include string length limits.
 */
export const VerdictOutput = z.object({
  verdict: z.string().describe("Two or three plain sentences on how well the resume fits the job."),
});

export const VERDICT_SYSTEM_PROMPT = `You write a short verdict on how well a candidate's resume fits a job, for the candidate to read.

You receive the job's requirements, each marked as "matched" (the resume shows it, with a quote as evidence) or "gap" (the resume doesn't show it), and tagged "must-have" or "nice-to-have". These results are final; don't second-guess them.

Write two or three plain sentences:
- Say how strong the overall fit is, giving more weight to must-have requirements than nice-to-have ones.
- Name the most important gaps honestly, especially must-have gaps.
- Never describe a gap as something the candidate has.
- Don't state percentages, scores, or counts of requirements; those are shown separately.
- No headings, lists, or markdown.`;

/**
 * Summarize a finished analysis. Returns null when there are no requirements,
 * without calling the LLM. A verdict that can't be generated becomes null and
 * is reported through onWarning; the missing-requirement lists never fail.
 *
 * @param {import("./llm.js").Llm} llm
 * @param {Array<{text: string, importance: string, status: string, evidence: string | null}>} classified
 * @param {{onWarning?: (message: string) => void}} [options]
 */
export async function summarize(llm, classified, { onWarning = () => {} } = {}) {
  if (classified.length === 0) return null;

  const missing = (importance) => classified.filter((r) => r.status === "gap" && r.importance === importance).map((r) => r.text);

  let verdict;
  try {
    verdict = await generateVerdict(llm, classified);
  } catch (error) {
    if (!(error instanceof AnalysisError)) throw error;
    onWarning(`The summary verdict is unavailable: ${error.message}`);
    verdict = null;
  }

  return { verdict, missingMustHaves: missing("must-have"), missingNiceToHaves: missing("nice-to-have") };
}

async function generateVerdict(llm, classified) {
  const lines = classified.map((r, i) => {
    const result = r.status === "matched" ? `matched (evidence: "${r.evidence}")` : "gap";
    return `${i + 1}. [${r.importance}] ${r.text}: ${result}`;
  });
  const output = await llm.parse({
    system: VERDICT_SYSTEM_PROMPT,
    user: `<requirements>\n${lines.join("\n")}\n</requirements>`,
    schema: VerdictOutput,
  });

  const parsed = VerdictOutput.safeParse(output);
  const verdict = parsed.success ? parsed.data.verdict.trim() : "";
  if (!verdict) {
    throw new AnalysisError("the model returned no verdict.");
  }
  if (verdict.length > MAX_VERDICT_LENGTH) {
    throw new AnalysisError(`the verdict was longer than ${MAX_VERDICT_LENGTH} characters.`);
  }
  if (verdict.includes("%")) {
    throw new AnalysisError("the verdict contained a percentage, which could contradict the computed score.");
  }
  return verdict;
}
