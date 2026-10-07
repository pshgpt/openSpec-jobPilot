# JobPilot

An AI-assisted job application analyzer built to learn
spec-driven development using OpenSpec and Claude Code.

Give it a resume and a job description. It lists the job's requirements,
shows which ones the resume covers (quoting the resume as evidence) and which
are gaps, calculates a match score, and sums it up: a short verdict on the
overall fit plus the missing must-have and nice-to-have requirements. It uses
Google Gemini as the LLM.

## Setup

Requires Node.js 20.12 or later.

```sh
npm install
cp .env.example .env
```

Then open `.env` and set your Gemini API key (from Google AI Studio):

```
GEMINI_API_KEY=your-key-here
```

`.env` is git-ignored, so the key never gets committed. JobPilot reads `.env`
from the directory you run it in. A `GEMINI_API_KEY` that's already set in
your environment takes precedence over the file.

The default model is `gemini-3.8-flash`. To use a different one, set
`JOBPILOT_MODEL` in `.env` (for example `JOBPILOT_MODEL=gemini-3.1-flash-lite`).

## Usage

Both inputs are UTF-8 plain-text files.

```sh
node bin/jobpilot.js analyze examples/resume.txt examples/job-description.txt
```

Example output (a real run on the files in `examples/`; results vary a little
between runs and models):

```
Match score: 60% (6 of 10 requirements matched)

Summary
  Your profile demonstrates a strong foundation in essential backend technologies and aligns well with the core technical requirements for the role. However, your candidacy is impacted by a lack of the required years of professional backend development experience. Further development in areas like Kubernetes and Go would also strengthen your qualifications for this position.
  Missing must-haves: 4+ years of professional backend development experience
  Missing nice-to-haves: Experience with Kubernetes, Familiarity with Apache Kafka or other streaming systems, Experience with Go

Matched (6)
  [must-have] Strong Python skills
      Evidence: "Python"
  [must-have] Experience with PostgreSQL or another relational database
      Evidence: "PostgreSQL"
  [must-have] Experience designing REST APIs
      Evidence: "Designed and maintained REST APIs"
  [must-have] Familiarity with Docker
      Evidence: "Docker"
  [must-have] Familiarity with CI/CD pipelines
      Evidence: "CI/CD with GitHub Actions"
  [must-have] Bachelor's degree in Computer Science or a related field
      Evidence: "B.Sc. in Computer Science"

Gaps (4)
  [must-have] 4+ years of professional backend development experience
  [nice-to-have] Experience with Kubernetes
  [nice-to-have] Familiarity with Apache Kafka or other streaming systems
  [nice-to-have] Experience with Go
```

Add `--json` for machine-readable output:

```sh
node bin/jobpilot.js analyze examples/resume.txt examples/job-description.txt --json
```

```json
{
  "score": 70,
  "requirements": [
    {
      "text": "Strong Python skills",
      "importance": "must-have",
      "status": "matched",
      "evidence": "Python"
    },
    {
      "text": "Experience with Kubernetes",
      "importance": "nice-to-have",
      "status": "gap",
      "evidence": null
    }
  ],
  "summary": {
    "verdict": "You are a very strong candidate for this position, as you demonstrate clear proficiency in all of the essential technical requirements. While you lack experience with Kubernetes, Kafka, and Go, these are only supplementary skills and do not detract from your solid foundation in backend development and core toolsets.",
    "missingMustHaves": [],
    "missingNiceToHaves": [
      "Experience with Kubernetes",
      "Familiarity with Apache Kafka or other streaming systems",
      "Experience with Go"
    ]
  }
}
```

(The JSON above is from a separate run and is shortened to two of the ten
requirements. In that run the "4+ years" requirement was matched, so there are
no missing must-haves and the score is 70.)

When no requirements are found, there's no summary: the JSON output is
`{"score": null, "requirements": [], "summary": null}`.

To use the `jobpilot` command directly, run `npm link` once.

If Gemini is overloaded (HTTP 503) or rate-limited (429), JobPilot retries a few
times with backoff. If the requirement extraction or matching still fails, it
exits with an error and prints no report. If only the summary verdict fails,
it still prints the full report, shows "Verdict unavailable" in place of the
verdict, writes a warning to standard error, and exits normally. Try again
later or pick another model with `JOBPILOT_MODEL`.

### How the summary works

The missing must-haves and nice-to-haves are taken directly from the report by
code, so they always match the Gaps list. The verdict is written by Gemini from
the final report only. It never sees the score, so it can't state a different
one, and a verdict containing a percentage is discarded.

### How the score works

The score is the percentage of requirements marked as matched, rounded to the
nearest whole number (halves round up). It's computed in code, not by the
model. A requirement only counts as matched if its evidence quote actually
appears in the resume; otherwise it's reported as a gap. If no requirements
are found, the score is "unavailable".

## Privacy

The resume and job description are sent to the Google Gemini API for each
run. Nothing is stored locally between runs.

## Development

```sh
npm test
```

The tests use a fake LLM client and make no network calls. Behavior is
specified in `openspec/` (see the `add-match-analysis` change).
