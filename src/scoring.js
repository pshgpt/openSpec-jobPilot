/**
 * Return the percentage of matched requirements, or null if there are none.
 * Deterministic: no I/O and no LLM involvement.
 *
 * Halves round up (1 of 8 -> 12.5 -> 13). Integer arithmetic keeps this exact:
 * floor(100 * m / n + 1/2) === floor((200 * m + n) / (2 * n)).
 *
 * @param {Array<{status: "matched" | "gap"}>} classifications
 * @returns {number | null}
 */
export function score(classifications) {
  const total = classifications.length;
  if (total === 0) return null;
  const matched = classifications.filter((c) => c.status === "matched").length;
  return Math.floor((200 * matched + total) / (2 * total));
}
