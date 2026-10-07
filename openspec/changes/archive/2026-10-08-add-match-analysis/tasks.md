# Tasks

## 1. Project setup

- [x] 1.1 Create `package.json` (ES modules, Node >= 20.12, `bin` entry `jobpilot` → `bin/jobpilot.js`, `test` script `node --test`) and a `bin/jobpilot.js` that prints usage; verify `node bin/jobpilot.js --help` prints usage
- [x] 1.2 Install `@google/genai` and `zod`; verify `npm install` succeeds and `npm test` runs (with no tests yet)

## 2. Domain models and scoring

- [x] 2.1 Define Zod schemas for `Requirement` (text, importance), `Classification` (status, evidence), `ClassifiedRequirement`, and `Report` in `src/models.js`, rejecting a match without evidence and a gap with evidence; verify with unit tests for valid and invalid cases
- [x] 2.2 Implement the pure `score()` function in `src/scoring.js` (round half up with integer arithmetic, `null` for no requirements); verify with tests covering every match-scoring scenario (75, 67, 13, 50, 100, 0, unavailable)

## 3. LLM client abstraction

- [x] 3.1 Implement `createGeminiLlm()` in `src/llm.js`: `parse({ system, user, schema })` calls `models.generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` from `z.toJSONSchema(schema)`, SDK retries for transient errors, model from `JOBPILOT_MODEL` defaulting to `gemini-3.8-flash`, and turns a missing or rejected `GEMINI_API_KEY`, unknown model, API/network errors, blocked prompts, non-`STOP` finishes, and invalid JSON into an `AnalysisError`; verify with unit tests using a stubbed SDK client, including the missing-key and rejected-key messages
- [x] 3.2 Add `createFakeLlm()` in `test/fakes.js` that returns canned parsed outputs in order and records each call; verify by using it in the tests in groups 4 and 5
- [x] 3.3 Load `.env` from the working directory in `bin/jobpilot.js` via `src/env.js` (`process.loadEnvFile`, a missing file is fine, existing environment variables win), add `.env` to `.gitignore`, and add a `.env.example`; verify with unit tests for a present file, a missing file, and an already-set variable, and with `git check-ignore .env`

## 4. Requirement extraction

- [x] 4.1 Implement `extractRequirements(llm, jobDescription)` in `src/extraction.js` with an output schema for distinct requirements tagged must-have/nice-to-have, validating results with the domain schema; verify with fake-client tests for several requirements, an empty result, and an invalid result raising an `AnalysisError`
- [x] 4.2 Write the extraction prompt so it covers the spec rules (deduplication, "preferred/plus/bonus" → nice-to-have); verify by running once against a sample JD with real API credentials and checking the output against the requirement-extraction scenarios

## 5. Resume matching

- [x] 5.1 Implement `classifyRequirements(llm, requirements, resume)` in `src/matching.js`: numbered requirements plus the resume go to the LLM, and results come back by index; verify with fake-client tests that a missing, duplicated, or unknown index raises an `AnalysisError`
- [x] 5.2 Implement evidence verification (lowercase, collapse whitespace, substring check) so unverifiable matches become gaps; verify with tests for an evidence miss, a case/whitespace-only difference, and a downgrade lowering the score to 50
- [x] 5.3 Implement `analyze()` in `src/analyze.js`, skipping the classification call when there are no requirements; verify with a fake-client test asserting no second call is made and the score is `null`

## 6. CLI and report output

- [x] 6.1 Implement `jobpilot analyze <resume> <jd>` in `src/cli.js` with input validation (missing, unreadable, non-UTF-8, empty or whitespace-only) that runs before any LLM call; verify with tests for each invalid case, asserting a non-zero exit, the problem file named in the message, and no LLM calls
- [x] 6.2 Implement the text report in `src/report.js` (score or "unavailable", matches with importance and evidence, gaps with importance); verify with a test for the 2-matches/1-gap scenario
- [x] 6.3 Implement the `--json` output (`score`, `requirements[]` with text/importance/status/evidence) printed alone on stdout; verify with tests that parse the output, including the `{"score": null, "requirements": []}` case
- [x] 6.4 Map analysis failures to a clear error on stderr and a non-zero exit with no partial report; verify with fake-client tests that raise an `AnalysisError` during extraction and during classification
- [x] 6.5 Update `README.md` with setup (`npm install`, `GEMINI_API_KEY` in `.env`), usage examples for both output modes from a real run, and a note that inputs are sent to the Google Gemini API; verify the documented commands run as written

## 7. End-to-end check

- [x] 7.1 Add a sample resume and job description under `examples/` and run `node bin/jobpilot.js analyze` with real API credentials in both text and `--json` modes; verify the output matches the analysis-cli spec and that the score equals matched/total from the printed requirements

## Workflow follow-up

- Run `openspec validate add-match-analysis --strict` before archiving.
- Archive the change with `/opsx:archive` once implemented and reviewed, then start the next change (`add-tailored-summary`).
