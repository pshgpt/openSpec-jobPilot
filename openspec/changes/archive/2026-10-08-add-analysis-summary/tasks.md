# Tasks

## 1. Summary model

- [x] 1.1 Add the `Summary` schema (`verdict` string or null, at most 600 characters; `missingMustHaves`, `missingNiceToHaves` string arrays) to `src/models.js` and make `Report.summary` `Summary | null`; verify with unit tests for a valid summary, a null verdict, a verdict over 600 characters, and a null summary

## 2. Summary step

- [x] 2.1 Implement the missing-requirement lists in `src/summary.js` from the final classifications, in report order; verify with tests for gaps of both kinds, no gaps, and a downgraded match appearing as missing
- [x] 2.2 Implement the verdict call: the verdict prompt, the `{ verdict }` output schema, and an input listing each final requirement with importance, status and evidence, but no score, resume or job description; verify with fake-client tests that check the request contents (gaps labelled as gaps, no score) and that a returned verdict is used
- [x] 2.3 Handle verdict failures: an `AnalysisError` from the call, an invalid result, or a verdict containing `%` gives `verdict: null` and calls `onWarning` with the reason, while other errors still propagate; verify with fake-client tests for each case
- [x] 2.4 Return `null` with no LLM call when there are no requirements; verify with a fake-client test asserting no verdict call is made

## 3. Pipeline and CLI

- [x] 3.1 Call `summarize` from `analyze()` after scoring, passing `onWarning` through, and include `summary` in the returned `Report`; verify with fake-client tests for a full run (three calls, summary present) and an empty run (one call, summary `null`)
- [x] 3.2 Pass an `onWarning` from `src/cli.js` that writes `Warning: <message>` to standard error; verify with CLI tests that a failed verdict still prints the full report, writes the warning to stderr only, and exits 0, in both text and `--json` modes

## 4. Report rendering

- [x] 4.1 Add the "Summary" section to the text report under the score line (verdict or "unavailable" note, missing must-haves, missing nice-to-haves, `none` for empty lists, no section when the summary is `null`); verify with tests for a full summary, an unavailable verdict, and empty lists
- [x] 4.2 Add `summary` to the JSON output after `requirements` with fields in the order `verdict`, `missingMustHaves`, `missingNiceToHaves`; verify with tests that check the field order, a `null` verdict, and that the empty case is exactly `{"score": null, "requirements": [], "summary": null}`

## 5. Documentation and end-to-end check

- [x] 5.1 Update `README.md` to describe the summary and its fallback, with example text and JSON output from a real run; verify the documented commands run as written
- [x] 5.2 Run `node bin/jobpilot.js analyze examples/resume.txt examples/job-description.txt` with real credentials in text and `--json` modes; verify the summary lists match the gaps in the report, the verdict has no `%` and does not present any gap as a strength, and record the review in the change

## Workflow follow-up

- Run `openspec validate add-analysis-summary --strict` before archiving.
- Archive with `/opsx:archive` once implemented and reviewed. This applies the MODIFIED `analysis-cli` requirements to the main spec.

## Verification notes (task 5.2)

Real runs on `examples/` with the default model `gemini-3.1-flash-lite`, 2026-10-08:

- Text mode: score 60% (6 of 10). Missing must-haves: the 4+ years requirement. Missing nice-to-haves: Kubernetes, Kafka, Go. Both lists matched the Gaps section exactly. The verdict was 3 sentences (about 430 characters) with no `%`; it described the years as lacking and Kubernetes/Go as areas to develop. No gap was presented as a strength. No warnings, exit 0.
- JSON mode: score 70%; this time the years requirement was matched, with evidence "Senior Software Engineer, Brightline Analytics (2021 - present)". `summary` field order was `verdict`, `missingMustHaves`, `missingNiceToHaves`. Both lists were equal to the report's gaps (no must-have gaps, 3 nice-to-have gaps), and the score equalled matched/total. The verdict was 317 characters with no `%`, and it called the missing skills supplementary, which matches their nice-to-have tags. Stderr was empty, exit 0.
- Between the two runs, classification of the years requirement changed and each verdict followed its own verified report. This is the behavior the "based on the final report" rule asks for.
- The fallback when the verdict fails was verified with fake-client tests (`test/cli.test.js`, `test/analyze.test.js`), because a real verdict failure can't be triggered on demand.
