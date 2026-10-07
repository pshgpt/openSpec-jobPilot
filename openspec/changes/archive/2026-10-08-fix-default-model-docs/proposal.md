# Proposal

## Why

The default Gemini model was changed in code to `gemini-3.1-flash-lite` (commit `952bf4b`) after `gemini-3.8-flash` kept returning 503 errors on full analyses. The test suite, README and `.env.example` still name `gemini-3.8-flash`. As a result, one test fails (86 of 87 pass), and the setup docs tell users the wrong default.

## What Changes

- `test/llm.test.js`: the default-model test expects `gemini-3.1-flash-lite`.
- `README.md`: the Setup section names `gemini-3.1-flash-lite` as the default and gives a different model as the override example.
- `.env.example`: the comment and the commented-out example name `gemini-3.1-flash-lite`.
- No code behavior changes: `src/llm.js` already uses `gemini-3.1-flash-lite`, and it stays the default. It worked reliably in the real runs for both previous changes.

**Out of scope:** the archived `design.md` of `add-match-analysis`, which still says `gemini-3.8-flash`. It records the plan as it was at the time and is left unchanged. Also out of scope: re-recording the README example output after the recent edit to `examples/resume.txt`.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
<!-- None: no spec mentions a model, so no requirement changes. The change declares `skip_specs: true`. -->

## Impact

- Files: `test/llm.test.js`, `README.md`, `.env.example`.
- After the change, the full test suite passes (87 of 87).
- No impact on the CLI, its output or the specs.
