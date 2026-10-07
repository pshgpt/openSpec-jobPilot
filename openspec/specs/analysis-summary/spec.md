# analysis-summary Specification

## Purpose

Summarizes a finished analysis for the candidate: which requirements are missing, plus a short verdict on the overall fit, kept consistent with the verified match report.

## Requirements

### Requirement: Summary lists missing requirements
For an analysis with at least one requirement, the system SHALL produce a summary containing the text of every `gap` requirement tagged `must-have` and, separately, of every `gap` requirement tagged `nice-to-have`, in report order. These lists SHALL be built from the final classifications, not by the LLM.

#### Scenario: Gaps of both kinds
- **WHEN** the report has the gaps "4+ years of backend experience" (must-have), "Kubernetes" (nice-to-have) and "Go" (nice-to-have)
- **THEN** the summary's missing must-haves are ["4+ years of backend experience"] and its missing nice-to-haves are ["Kubernetes", "Go"]

#### Scenario: No gaps
- **WHEN** every requirement is `matched`
- **THEN** both lists are empty

#### Scenario: Downgraded match is listed as missing
- **WHEN** a requirement came back from classification as matched but was reported as a `gap` because its evidence is not in the resume
- **THEN** it appears in the matching missing-requirements list

### Requirement: Summary includes a verdict on the overall fit
For an analysis with at least one requirement, the system SHALL include a verdict: a short plain-text assessment of how well the resume fits the job, of at most 600 characters, written by the LLM from the final report only.

#### Scenario: Verdict is generated
- **WHEN** an analysis finds 6 matched requirements and 4 gaps
- **THEN** the summary includes a verdict of at most 600 characters

#### Scenario: Verdict is based on the final report
- **WHEN** a requirement was reported as a `gap` because its evidence was not in the resume
- **THEN** the information given to the LLM for the verdict shows that requirement as a gap

### Requirement: Verdict does not state a score
The verdict SHALL NOT contain a percentage sign, so it can never state a match percentage that differs from the computed score. A verdict that does is treated as unavailable.

#### Scenario: Verdict with a percentage
- **WHEN** the LLM returns the verdict "You match about 70% of the requirements."
- **THEN** the verdict is reported as unavailable

### Requirement: Verdict does not present gaps as strengths
The verdict SHALL NOT describe a `gap` requirement as something the candidate has.

#### Scenario: Missing skill in the verdict
- **WHEN** "Kubernetes" is a `gap`
- **THEN** the verdict does not claim the candidate has Kubernetes experience, which is checked by reviewing verdicts from real runs

### Requirement: A failed verdict does not fail the analysis
If the verdict cannot be generated (the LLM call fails, or its result is invalid or breaks a verdict rule), the system SHALL still produce the summary with the missing-requirement lists, mark the verdict as unavailable, and report a warning that explains why.

#### Scenario: Verdict call fails
- **WHEN** the verdict LLM call fails with a service-unavailable error
- **THEN** the summary has both missing-requirement lists, its verdict is unavailable, and a warning is reported

### Requirement: No summary without requirements
When no requirements were extracted, the system SHALL NOT produce a summary and SHALL NOT make the verdict LLM call.

#### Scenario: Empty requirement list
- **WHEN** zero requirements were extracted
- **THEN** there is no summary and only the extraction LLM call was made
