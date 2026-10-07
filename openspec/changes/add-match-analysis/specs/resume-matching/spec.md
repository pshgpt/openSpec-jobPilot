# Spec Delta

## Purpose

Decides, for each job requirement, whether the resume shows it, and backs every claimed match with evidence quoted from the resume that can be checked.

## ADDED Requirements

### Requirement: Every requirement is classified exactly once
The system SHALL classify every extracted requirement as exactly one of `matched` or `gap`. No requirement SHALL be omitted, duplicated, or given any other status.

#### Scenario: Mixed coverage
- **WHEN** the extracted requirements are "Python", "SQL", and "Kubernetes", and the resume shows Python and SQL but not Kubernetes
- **THEN** "Python" and "SQL" are `matched`, "Kubernetes" is a `gap`, and the report has exactly three classified requirements

#### Scenario: No requirements to classify
- **WHEN** the extracted requirement list is empty
- **THEN** the classification result is empty and no error is raised

### Requirement: Matching tolerates equivalent wording
The system SHALL treat a requirement as matched when the resume shows the same skill or experience in different wording, such as a common synonym, abbreviation, or closely equivalent technology name.

#### Scenario: Name variant
- **WHEN** the requirement is "PostgreSQL" and the resume says "Built reporting pipelines on Postgres"
- **THEN** the requirement is `matched`

### Requirement: Matches cite resume evidence
The system SHALL attach to every `matched` requirement an evidence quote taken word for word from the resume. A `gap` requirement SHALL have no evidence.

#### Scenario: Matched requirement includes evidence
- **WHEN** the requirement "Python" is matched
- **THEN** the result includes an evidence quote such as "Developed data tools in Python" that appears in the resume

### Requirement: Unverifiable matches are reported as gaps
The system SHALL check every evidence quote against the resume text, ignoring differences in letter case and whitespace. If the quote does not appear in the resume, the system SHALL report the requirement as a `gap`.

#### Scenario: Evidence not found in resume
- **WHEN** a requirement comes back from classification as matched with the evidence "Led a team of 10 engineers" and that text does not appear in the resume
- **THEN** the requirement is reported as a `gap`

#### Scenario: Evidence differs only in case and spacing
- **WHEN** the evidence is "developed data tools in python" and the resume contains "Developed  data tools in\nPython"
- **THEN** the requirement remains `matched`
