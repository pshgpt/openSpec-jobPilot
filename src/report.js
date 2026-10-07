/**
 * Render a report as readable text.
 *
 * @param {{score: number | null, requirements: Array<{text: string, importance: string, status: string, evidence: string | null}>}} report
 * @returns {string}
 */
export function renderText(report) {
  const matches = report.requirements.filter((r) => r.status === "matched");
  const gaps = report.requirements.filter((r) => r.status === "gap");

  if (report.score === null) {
    return "Match score: unavailable (no requirements were found in the job description)\n";
  }

  const lines = [
    `Match score: ${report.score}% (${matches.length} of ${report.requirements.length} requirements matched)`,
    "",
    `Matched (${matches.length})`,
    ...(matches.length ? matches.flatMap((r) => [`  [${r.importance}] ${r.text}`, `      Evidence: "${r.evidence}"`]) : ["  (none)"]),
    "",
    `Gaps (${gaps.length})`,
    ...(gaps.length ? gaps.map((r) => `  [${r.importance}] ${r.text}`) : ["  (none)"]),
  ];
  return lines.join("\n") + "\n";
}

/**
 * Render a report as a single JSON object with a fixed field order.
 *
 * @param {{score: number | null, requirements: Array<{text: string, importance: string, status: string, evidence: string | null}>}} report
 * @returns {string}
 */
export function renderJson(report) {
  const json = {
    score: report.score,
    requirements: report.requirements.map(({ text, importance, status, evidence }) => ({ text, importance, status, evidence })),
  };
  return JSON.stringify(json, null, 2) + "\n";
}
