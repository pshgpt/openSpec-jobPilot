import { extractRequirements } from "./extraction.js";
import { classifyRequirements } from "./matching.js";
import { Report } from "./models.js";
import { score } from "./scoring.js";

/**
 * Run one analysis: extract -> classify -> verify -> score.
 * Classification (and its evidence check) is skipped when nothing was extracted.
 *
 * @param {{llm: import("./llm.js").Llm, resume: string, jobDescription: string}} input
 */
export async function analyze({ llm, resume, jobDescription }) {
  const requirements = await extractRequirements(llm, jobDescription);
  const classified = await classifyRequirements(llm, requirements, resume);
  return Report.parse({ score: score(classified), requirements: classified });
}
