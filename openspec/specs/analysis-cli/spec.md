# analysis-cli Specification

## Purpose

The command-line entry point to JobPilot: accepts a resume and a job description as files, runs one analysis, and presents the results as readable text or JSON.

## Requirements

### Requirement: Analyze command accepts two text files
The system SHALL provide an `analyze` command that takes a resume file path and a job description file path, both UTF-8 plain text. Each run SHALL analyze only those two inputs and SHALL NOT keep anything between runs.

#### Scenario: Valid inputs
- **WHEN** the user runs `jobpilot analyze resume.txt jd.txt` with two non-empty text files
- **THEN** the system prints a match report and exits with status 0

### Requirement: Invalid inputs are rejected before analysis
The system SHALL exit with a non-zero status and a message naming the problem file, without calling the LLM, when an input file is missing, unreadable, not valid UTF-8, or empty (including whitespace only).

#### Scenario: Missing file
- **WHEN** the resume path does not exist
- **THEN** the system prints an error naming the resume path and exits with a non-zero status

#### Scenario: Empty job description
- **WHEN** the job description file contains only whitespace
- **THEN** the system prints an error saying the job description is empty and exits with a non-zero status

### Requirement: Analysis failures produce no partial report
If the analysis cannot be completed (for example, a missing API key, an LLM request failure, or an LLM response that cannot be parsed), the system SHALL print a clear error, exit with a non-zero status, and SHALL NOT print a partial report. A failed summary verdict is the one exception: the system SHALL print the full report with the verdict marked unavailable, print a warning to standard error, and exit with status 0.

#### Scenario: Missing API key
- **WHEN** the API key is not configured
- **THEN** the system prints an error explaining how to configure it and exits with a non-zero status

#### Scenario: Verdict fails but the analysis succeeds
- **WHEN** extraction and classification succeed but the verdict LLM call fails
- **THEN** the system prints the full report with the verdict marked unavailable, prints a warning to standard error, and exits with status 0

### Requirement: Text report by default
By default, the system SHALL print a readable report that contains the score (or that it is unavailable), a summary section when there is a summary (the verdict, or a note that it is unavailable, and the missing must-have and nice-to-have requirements), the matched requirements with their importance and evidence, and the gap requirements with their importance.

#### Scenario: Default output
- **WHEN** the analysis finds 2 matched requirements and 1 gap
- **THEN** the output shows the score, the summary, lists the 2 matches each with its evidence, and lists the 1 gap

#### Scenario: Verdict unavailable in text output
- **WHEN** the verdict could not be generated
- **THEN** the summary section says the verdict is unavailable and still lists the missing requirements

### Requirement: JSON output on request
When the `--json` flag is given, the system SHALL print only a single JSON object to standard output containing `score` (an integer, or `null`), `requirements` (each with `text`, `importance`, `status` and `evidence`, a string for matches and `null` for gaps), and `summary`: `null` when there are no requirements, otherwise an object with `verdict` (a string, or `null` when unavailable), `missingMustHaves` and `missingNiceToHaves` (arrays of requirement texts).

#### Scenario: JSON output
- **WHEN** the user runs `jobpilot analyze resume.txt jd.txt --json`
- **THEN** standard output contains one valid JSON object with the fields above and nothing else

#### Scenario: JSON with no requirements
- **WHEN** `--json` is given and no requirements were extracted
- **THEN** the output is `{"score": null, "requirements": [], "summary": null}`

#### Scenario: JSON with an unavailable verdict
- **WHEN** `--json` is given and the verdict could not be generated
- **THEN** standard output contains only the JSON object, its `summary.verdict` is `null`, and the warning goes to standard error
