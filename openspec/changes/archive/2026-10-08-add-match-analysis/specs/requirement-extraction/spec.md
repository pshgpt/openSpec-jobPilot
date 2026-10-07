# Spec Delta

## Purpose

Turns free-text job descriptions into a structured list of distinct requirements, so they can be compared one by one against a resume.

## ADDED Requirements

### Requirement: Extract requirements from a job description
The system SHALL extract a list of requirements from the job description text. Each requirement SHALL have a short, human-readable description of a single skill, qualification, or experience.

#### Scenario: Job description lists several skills
- **WHEN** the job description asks for "Python", "SQL", and "3+ years of backend experience"
- **THEN** the extracted list contains a separate requirement for each of the three

#### Scenario: Job description with no requirements
- **WHEN** the job description contains no identifiable requirements (for example, only a company overview)
- **THEN** the extracted list is empty and no error is raised

### Requirement: Requirements are distinct
The system SHALL NOT return two requirements that describe the same skill, qualification, or experience.

#### Scenario: Skill mentioned more than once
- **WHEN** the job description mentions "Python" in both the summary and the qualifications section
- **THEN** the extracted list contains exactly one Python requirement

### Requirement: Requirements are tagged by importance
The system SHALL tag every extracted requirement as either `must-have` or `nice-to-have`. A requirement the job description presents as preferred, a bonus, or optional SHALL be tagged `nice-to-have`; every other requirement SHALL be tagged `must-have`.

#### Scenario: Preferred qualification
- **WHEN** the job description says "Experience with Kubernetes is a plus"
- **THEN** the Kubernetes requirement is tagged `nice-to-have`

#### Scenario: Unqualified requirement
- **WHEN** the job description says "You have strong SQL skills"
- **THEN** the SQL requirement is tagged `must-have`
