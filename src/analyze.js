import { extractRequirements } from "./extraction.js";
import { classifyRequirements } from "./matching.js";
import { Report } from "./models.js";
import { score } from "./scoring.js";
import { summarize } from "./summary.js";

/**
 * Run one analysis: extract -> classify -> verify -> score -> summarize.
 * Classification and the summary are skipped when nothing was extracted.
 * A failed summary verdict is reported through onWarning instead of failing the run.
 *
 * @param {{llm: import("./llm.js").Llm, resume: string, jobDescription: string, onWarning?: (message: string) => void}} input
 */
export async function analyze({ llm, resume, jobDescription, onWarning }) {
  const requirements = await extractRequirements(llm, jobDescription);
  const classified = await classifyRequirements(llm, requirements, resume);
  const summary = await summarize(llm, classified, { onWarning });
  return Report.parse({ score: score(classified), requirements: classified, summary });
}
