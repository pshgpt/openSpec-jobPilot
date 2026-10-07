# Proposal

## Why

When deciding whether to apply for a job, it is hard to see quickly how well a resume covers what the posting asks for. JobPilot's first change delivers that core loop: given a resume and a job description, show which requirements are met, which are gaps, and a match score that can be explained. The project is also a way to learn spec-driven development, so this first change stays deliberately small.

## What Changes

- Add a command-line tool that takes two plain-text files, a resume and a job description, and runs one analysis per invocation. Nothing is stored between runs.
- Extract a list of distinct requirements from the job description, each tagged as must-have or nice-to-have (uses an LLM).
- Classify each requirement against the resume as either **matched**, with a verbatim quote from the resume as evidence, or a **gap** (uses an LLM).
- Check every match in code: a requirement whose evidence does not appear in the resume is reported as a gap, never as a match.
- Compute the match score **in code** from the classifications, never by the LLM: the percentage of requirements that are matched, as a whole number from 0 to 100. In this change, must-have and nice-to-have requirements count equally.
- Output a readable report by default, or JSON with a flag.

**Out of scope for this change:** the tailored application summary (planned as the next change), weighting must-have requirements more heavily, partial matches, PDF or DOCX input, and any UI. Also out of scope, as boundaries for the whole project: RAG, vector databases, MCP, multi-agent setups, job scraping, browser automation, authentication, and databases.

## Capabilities

### New Capabilities
- `requirement-extraction`: Turns a job description into a list of distinct requirements, each tagged must-have or nice-to-have.
- `resume-matching`: Classifies each requirement as matched or a gap against the resume, with matches backed by verifiable evidence from the resume.
- `match-scoring`: Computes the match score from the classifications with a fixed, deterministic formula.
- `analysis-cli`: The command-line interface: accepting inputs, handling errors, and formatting the report as text or JSON.

### Modified Capabilities
<!-- None: no specs exist yet. -->

## Impact

- New Node.js project in this repository: package, command-line entry point, and tests.
- New external dependency: the Google Gemini API. It needs an API key (read from a local `.env` file that is never committed), costs a small amount per run, and the resume and job description text are sent to it.
- No existing code or specs are affected.
