/** An input file is missing, unreadable, not UTF-8, or empty. Raised before any LLM call. */
export class InputError extends Error {
  name = "InputError";
}

/** The analysis could not be completed (LLM failure, unusable response, ...). */
export class AnalysisError extends Error {
  name = "AnalysisError";
}
