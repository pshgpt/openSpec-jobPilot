import { z } from "zod";

import { AnalysisError } from "./errors.js";
import { Importance, Requirement } from "./models.js";

/** What the model returns. Kept simple; stricter rules are checked with the domain schema. */
export const ExtractionOutput = z.object({
  requirements: z.array(
    z.object({
      text: z.string().describe("A short description of one skill, qualification, or experience."),
      importance: Importance,
    }),
  ),
});

export const EXTRACTION_SYSTEM_PROMPT = `You extract the requirements from a job description so they can be checked one by one against a candidate's resume.

A requirement is a single skill, technology, qualification, or kind of experience that the employer asks the candidate to have. For each one, write a short description (for example "Python", "SQL", "3+ years of backend development", "Bachelor's degree in Computer Science").

Rules:
- One requirement per skill or qualification. If the posting lists several in one sentence, split them.
- Never list the same requirement twice, even if the posting mentions it in several places or with different wording. Merge such mentions into one.
- Tag a requirement "nice-to-have" when the posting presents it as preferred, a plus, a bonus, desirable, or optional. Tag every other requirement "must-have".
- Only include what the employer asks of the candidate. Skip descriptions of the company, the team, benefits, and the job's duties unless they state a required skill.
- If the posting states no requirements at all, return an empty list.`;

/**
 * @param {import("./llm.js").Llm} llm
 * @param {string} jobDescription
 * @returns {Promise<Array<{text: string, importance: "must-have" | "nice-to-have"}>>}
 */
export async function extractRequirements(llm, jobDescription) {
  const output = await llm.parse({
    system: EXTRACTION_SYSTEM_PROMPT,
    user: `<job_description>\n${jobDescription}\n</job_description>`,
    schema: ExtractionOutput,
  });

  const result = z.array(Requirement).safeParse(output?.requirements);
  if (!result.success) {
    throw new AnalysisError(`The extracted requirements were not valid: ${z.prettifyError(result.error)}`);
  }
  return dropDuplicates(result.data);
}

/** A safety net for the "requirements are distinct" rule: drop exact repeats (ignoring case and spacing). */
function dropDuplicates(requirements) {
  const seen = new Set();
  return requirements.filter((req) => {
    const key = req.text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
