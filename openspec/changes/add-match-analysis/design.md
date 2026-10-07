# Design

## Context

This is a new project: the repository contains only a README and the OpenSpec scaffold. The development machine has Node.js 24 and npm. The LLM is Google Gemini, called through the Gemini API (not Vertex AI) with an API key. See proposal.md for motivation and scope, and the four specs for the required behavior.

## Goals / Non-Goals

**Goals:**
- Split the work between the LLM and code: the LLM does the steps that need judgment (extraction, classification); code does everything that can be checked exactly (evidence verification, scoring, input validation, output).
- Make every rule in the specs testable without network access, by injecting a fake LLM client.
- Keep the package small enough to read in one sitting, with as few dependencies as possible.
- Keep the API key out of the code and out of git.

**Non-Goals:**
- Tuning prompt quality against a benchmark set.
- Caching, hand-written retry logic, streaming, or concurrent requests.
- Supporting more than one LLM provider at a time.
- A TypeScript build step.

## Decisions

### Two LLM calls, one per judgment step
```
resume.txt, jd.txt
   |
   v
[validate inputs]  (code)  -- error --> exit != 0
   |
   v
[extract]   LLM call 1: JD -> requirements[{text, importance}]
   |
   v
[classify]  LLM call 2: numbered requirements + resume -> [{index, status, evidence}]
   |
   v
[verify]    (code) evidence missing or not in resume -> gap
   |
   v
[score]     (code) round_half_up(matched / total * 100) or null
   |
   v
[render]    (code) text report | JSON
```
If extraction returns no requirements, skip call 2 entirely.

*Alternative:* a single call that both extracts and classifies. It is cheaper, but each spec could no longer be tested on its own, and failures would be harder to pin to one step. With two calls, each spec maps to one stage.

### Gemini through the `@google/genai` SDK
Calls go through `ai.models.generateContent()` from Google's official `@google/genai` SDK, using the Gemini API with an API key. Vertex AI is not used: it needs Google Cloud credentials, not an API key.

The default model is `gemini-3.8-flash`, the newest stable Flash model available to the key. Flash models are fast and cheap, and extraction and classification don't need a larger model. `JOBPILOT_MODEL` overrides the default.

*Alternatives:* `gemini-flash-latest` changes model without notice, which would make results drift between runs. Preview models (`*-preview`) can change or disappear.

### Structured output through `responseJsonSchema`
Each call sets `responseMimeType: "application/json"` and `responseJsonSchema` to a JSON Schema generated from a Zod schema with `z.toJSONSchema()`. Gemini constrains its output to that schema, which includes enforcing the `must-have`/`nice-to-have` and `matched`/`gap` values. The wrapper parses `response.text` as JSON and validates it with the same Zod schema; the stricter domain rules are checked afterwards in code.

*Alternatives:* `responseSchema` takes Google's OpenAPI subset, which Zod can't generate directly. Asking for JSON in the prompt and parsing free text breaks easily and gives no guarantee about the schema.

### The API key comes from a `.env` file
`bin/jobpilot.js` loads `.env` from the current working directory with Node's built-in `process.loadEnvFile()` (Node 20.12 or later), so there's no `dotenv` dependency. A missing `.env` file is not an error: a `GEMINI_API_KEY` already set in the environment also works, and takes precedence over `.env`. The `.env` file is listed in `.gitignore`. A committed `.env.example` documents the variables. The key is passed to the SDK explicitly, never logged, and never written to output.

### Transient errors are retried by the SDK; everything else fails
The Gemini API often returns 503 ("high demand") and sometimes 429. The SDK's built-in retry (`httpOptions.retryOptions`, 4 attempts with exponential backoff) handles these, so there's no retry code of our own.

The wrapper turns every remaining way a call can fail into a single `AnalysisError` with a readable message:
- no `GEMINI_API_KEY` set (checked before any request);
- a rejected key (HTTP 400 with an invalid-key message, or 401/403);
- a model that doesn't exist (404);
- a call that still fails after retrying (429/5xx);
- a network error;
- a blocked prompt (`promptFeedback.blockReason`);
- an output that stopped for any reason other than `STOP` (for example `MAX_TOKENS` or `SAFETY`);
- an output that isn't valid JSON or doesn't match the schema.

The CLI prints the message and exits with a non-zero status, so no partial report is ever printed.

### Classification is returned by index, then checked against the requirement list
Call 2 receives the requirements numbered and returns one entry per index. Code then checks that every index appears exactly once and no unknown index appears; otherwise it is an `AnalysisError`. This enforces the "classified exactly once" requirement in code rather than trusting the model.

### Evidence check: normalized substring match
Both the evidence and the resume are lowercased and every run of whitespace is collapsed to a single space; the evidence must then be a substring of the resume. A `matched` result whose evidence is missing or fails this check is reported as a `gap` with no evidence. Evidence the model sent for a `gap` is dropped. This is deliberately strict: a quote the model paraphrased is reported as a gap. Under-claiming is safer than claiming a skill the resume does not show.

### Scoring as a pure function
`score(classifications) -> number | null`, with no I/O. Halves round up using exact integer arithmetic, `Math.floor((200 * matched + total) / (2 * total))`, so the result never depends on floating-point rounding.

### Stack
- Node.js 20.12 or later (the machine has 24), plain JavaScript as ES modules (`"type": "module"`), and a `jobpilot` command through the `bin` field in `package.json`.
- Dependencies: `@google/genai` (Google's official SDK) and `zod`. Argument parsing uses Node's built-in `util.parseArgs`, and `.env` loading uses `process.loadEnvFile()`.
- Tests: Node's built-in test runner (`node --test`), so there's no test dependency.
- Configuration: `GEMINI_API_KEY` (required, usually from `.env`) and `JOBPILOT_MODEL` (optional, default `gemini-3.8-flash`).

### Module layout
```
bin/jobpilot.js     executable entry: loads .env, calls main(), sets the exit code
src/
  cli.js            argument parsing, input validation, output, exit codes
  analyze.js        the pipeline: extract -> classify -> verify -> score
  models.js         Zod schemas: Requirement, Classification, ClassifiedRequirement, Report
  errors.js         InputError, AnalysisError
  env.js            loadEnv(): read .env if present
  llm.js            LLM client interface + Gemini implementation
  extraction.js     call 1: prompt + output schema
  matching.js       call 2: prompt + output schema + index checks + evidence verification
  scoring.js        pure score function
  report.js         text and JSON rendering
test/
  fakes.js          createFakeLlm(): returns canned parsed outputs, records calls
  *.test.js         one file per module
```
`extraction.js` and `matching.js` depend only on an object with a `parse({ system, user, schema })` method, not on the SDK, so tests can pass in the fake, and the provider was changed without touching them. `cli.js` takes its LLM client, output streams and file reader as parameters, so the CLI can be tested without real I/O or network access.

## Risks / Trade-offs

- [The LLM quotes evidence loosely, so real matches get reported as gaps] → The prompt tells the model to copy an exact phrase from the resume; whether to loosen the check can be decided after trying it on real inputs.
- [Extraction varies between runs, so the score changes for the same inputs] → Accept it. The score is deterministic given the classifications, which is what the spec promises.
- [Gemini capacity errors (503) make runs fail] → The SDK retries with backoff; if it still fails, the user gets a clear "try again" error and no partial report.
- [The API key leaks] → It lives only in a git-ignored `.env` file and is never printed. A key that was ever shared elsewhere should be rotated.
- [Resume text is sent to a third-party API] → Acceptable for a personal tool; noted in the README.
- [Very long inputs exceed context or cost] → Not handled in the MVP; typical resumes and job descriptions are well within limits.
- [No type checking in plain JavaScript] → Zod validates data at every boundary (LLM output, report), and tests cover each module.

## Open Questions

- The exact prompt wording for extraction and classification. It will be refined during implementation without changing the specs.
