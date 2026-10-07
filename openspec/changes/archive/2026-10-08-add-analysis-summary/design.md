# Design

## Context

The pipeline in `src/analyze.js` runs extract → classify → verify → score and returns a `Report` (`{ score, requirements }`) validated by Zod. `src/cli.js` renders it with `src/report.js` and turns any `AnalysisError` into an error message and exit code 1. LLM access goes through the `Llm` interface (`parse({ system, user, schema })`), backed by Gemini in `src/llm.js`. Tests replace it with `createFakeLlm()`. See proposal.md for motivation and the two specs for required behavior.

## Goals / Non-Goals

**Goals:**
- Add the summary as one more pipeline step after scoring, so it only ever sees verified results.
- Keep the facts (missing-requirement lists) exact and testable by having code produce them.
- Keep the verdict's failure from affecting anything else in the run.

**Non-Goals:**
- Rewording or reordering existing report sections.
- Changing the default model, prompts for extraction or matching, or retry behavior.
- Giving the verdict access to the raw resume or job description.

## Decisions

### A summary step at the end of `analyze()`
```
extract --> classify/verify --> score --> summarize --> Report { score, requirements, summary }
                                              |
                                              +-- facts:   code (filter gaps by importance)
                                              +-- verdict: LLM call 3 (may fail -> null + warning)
```
A new `src/summary.js` exports `summarize(llm, classified, { onWarning })`:
1. With no requirements, it returns `null` without calling the LLM.
2. It builds `missingMustHaves` and `missingNiceToHaves` by filtering the final classifications. This can't fail.
3. It asks the LLM for a verdict. On an `AnalysisError`, or on a verdict that breaks a rule, it calls `onWarning(reason)` and sets `verdict: null`.

*Alternative:* run the verdict inside `classifyRequirements`. Rejected, because the verdict must see the result after evidence verification, and keeping it separate keeps `matching.js` unchanged.

### Only the verified report goes to the LLM
The verdict prompt receives a numbered list of the final requirements, each with its importance, status and evidence quote. It doesn't receive the score, the resume or the job description. That way the model can't contradict the evidence check, and it has no number to restate. The system prompt asks for 2–3 plain sentences on overall fit, says to mention the most important gaps honestly, and forbids percentages and describing gaps as strengths.

### Verdict rules are enforced in code where they can be
- **Output schema:** `{ verdict: string }`. The 600-character limit is checked in code after parsing, not put in the schema sent to Gemini, because Gemini's JSON-schema support doesn't include string length limits (`maxLength`).
- **No `%` character:** checked after parsing. A verdict containing `%` is discarded with a warning.
- "Doesn't present gaps as strengths" can't be checked mechanically. It is handled through the prompt and the input format, in which every gap is explicitly labelled `gap`, and verified by reviewing real runs.

A rule violation leads to the same outcome as a failed call: the verdict is `null` and a warning is reported. There's no retry; the SDK already retries transient HTTP errors.

### Warnings travel through a callback, not the return value
`analyze({ llm, resume, jobDescription, onWarning })` passes `onWarning` to `summarize`. `cli.js` supplies a function that writes `Warning: <message>` to standard error. This keeps the `Report` purely about results (the JSON output never contains warnings), and the exit code stays 0. Only `AnalysisError` is caught in the summary step; any other error is a bug and still surfaces.

*Alternative:* return `{ report, warnings }`. Rejected because every caller and test of `analyze()` would need to change shape for something only the CLI displays.

### Report model and rendering
- `models.js`: add `Summary = { verdict: string | null, missingMustHaves: string[], missingNiceToHaves: string[] }`, with `Report.summary` being `Summary | null`.
- `report.js` text mode adds a block under the score line:
  ```
  Match score: 60% (6 of 10 requirements matched)

  Summary
    <verdict, or "Verdict unavailable (see warning above).">
    Missing must-haves: 4+ years of professional backend development experience
    Missing nice-to-haves: Experience with Kubernetes, Experience with Go
  ```
  An empty list prints as `none`. When the summary is `null`, nothing is added: the existing "score unavailable" line stays as it is.
- `report.js` JSON mode adds `summary` after `requirements`, with the field order `verdict`, `missingMustHaves`, `missingNiceToHaves`.

## Risks / Trade-offs

- [One more LLM call per run means more cost, time and exposure to 503s] → The verdict is the only call allowed to fail, and a failure costs only the verdict.
- [The verdict might still misdescribe a gap in different words] → It sees gaps labelled explicitly, the facts are printed beside it by code, and real runs are reviewed. Stricter checks (for example, matching gap names in the text) would reject correct verdicts that mention gaps honestly.
- [The `%` rule rejects a harmless verdict, for example one quoting "100% remote" from a requirement] → Rare. The cost is only an unavailable verdict with a warning, and the rule keeps the score unambiguous.
- [The JSON shape changes for existing consumers] → Additive except for the empty case. Called out as BREAKING in the proposal.

## Open Questions

- The exact verdict prompt wording. It will be refined against real runs without changing the specs.
