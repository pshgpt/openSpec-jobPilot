# Spec Delta

## Purpose

Computes a match score from requirement classifications with a fixed, deterministic formula, so the score is reproducible and explainable rather than produced by the LLM.

## ADDED Requirements

### Requirement: Score is the percentage of matched requirements
The system SHALL compute the match score as the number of `matched` requirements divided by the total number of classified requirements, multiplied by 100 and rounded to the nearest whole number, with halves rounded up. In this version, `must-have` and `nice-to-have` requirements SHALL count equally.

#### Scenario: Partial match
- **WHEN** 3 of 4 requirements are `matched`
- **THEN** the score is 75

#### Scenario: Rounding
- **WHEN** 2 of 3 requirements are `matched`
- **THEN** the score is 67

#### Scenario: Rounding a half up
- **WHEN** 1 of 8 requirements is `matched`
- **THEN** the score is 13

#### Scenario: Importance does not affect the score
- **WHEN** 1 `must-have` requirement is a `gap` and 1 `nice-to-have` requirement is `matched`
- **THEN** the score is 50

#### Scenario: Full match
- **WHEN** all requirements are `matched`
- **THEN** the score is 100

#### Scenario: No match
- **WHEN** no requirements are `matched`
- **THEN** the score is 0

### Requirement: Score is deterministic
The system SHALL compute the score only from the final classifications, after unverifiable matches have been reported as gaps. The same classifications SHALL always produce the same score.

#### Scenario: Downgraded match lowers the score
- **WHEN** 2 requirements come back from classification as matched, and one of them is reported as a gap because its evidence is not in the resume
- **THEN** the score is 50

### Requirement: No score without requirements
The system SHALL NOT report a numeric score when there are no classified requirements, and SHALL instead indicate that no score could be computed.

#### Scenario: Empty requirement list
- **WHEN** zero requirements were extracted
- **THEN** the score is reported as unavailable, not as 0 or 100
