import assert from "node:assert/strict";
import { test } from "node:test";

import { analyze } from "../src/analyze.js";
import { AnalysisError } from "../src/errors.js";
import { VERDICT_SYSTEM_PROMPT } from "../src/summary.js";
import { createFakeLlm } from "./fakes.js";

const RESUME = "Developed data tools in Python.\nRan Docker in production.";

const EXTRACTED = {
  requirements: [
    { text: "Python", importance: "must-have" },
    { text: "Leadership", importance: "must-have" },
    { text: "Kubernetes", importance: "nice-to-have" },
  ],
};
// Leadership is claimed as matched, but its evidence isn't in the resume, so it's downgraded to a gap.
const CLASSIFIED = {
  classifications: [
    { index: 1, status: "matched", evidence: "Developed data tools in Python" },
    { index: 2, status: "matched", evidence: "Led a team of 10 engineers" },
    { index: 3, status: "gap", evidence: null },
  ],
};
const VERDICT = "A partial fit: strong on Python, but leadership experience is not shown.";

test("a full run makes three calls and includes the summary", async () => {
  const llm = createFakeLlm(EXTRACTED, CLASSIFIED, { verdict: VERDICT });
  const report = await analyze({ llm, resume: RESUME, jobDescription: "jd" });

  assert.equal(llm.calls.length, 3);
  assert.equal(llm.calls[2].system, VERDICT_SYSTEM_PROMPT);
  assert.equal(report.score, 33);
  assert.deepEqual(report.summary, {
    verdict: VERDICT,
    missingMustHaves: ["Leadership"],
    missingNiceToHaves: ["Kubernetes"],
  });
});

test("the verdict sees the downgraded match as a gap", async () => {
  const llm = createFakeLlm(EXTRACTED, CLASSIFIED, { verdict: VERDICT });
  await analyze({ llm, resume: RESUME, jobDescription: "jd" });
  assert.match(llm.calls[2].user, /\[must-have\] Leadership: gap/);
  assert.doesNotMatch(llm.calls[2].user, /Led a team/);
});

test("an empty run makes one call and has no summary", async () => {
  const llm = createFakeLlm({ requirements: [] });
  const report = await analyze({ llm, resume: RESUME, jobDescription: "Acme is a great place to work." });
  assert.equal(llm.calls.length, 1);
  assert.equal(report.summary, null);
});

test("a failed verdict is passed to onWarning and the report is still returned", async () => {
  const llm = createFakeLlm(EXTRACTED, CLASSIFIED, new AnalysisError("The Gemini API is unavailable right now (503)."));
  const warnings = [];
  const report = await analyze({ llm, resume: RESUME, jobDescription: "jd", onWarning: (w) => warnings.push(w) });

  assert.equal(report.score, 33);
  assert.equal(report.summary.verdict, null);
  assert.deepEqual(report.summary.missingMustHaves, ["Leadership"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /verdict is unavailable.*503/);
});

test("failures before the summary still fail the run", async () => {
  const llm = createFakeLlm(EXTRACTED, new AnalysisError("classification failed"));
  await assert.rejects(analyze({ llm, resume: RESUME, jobDescription: "jd" }), /classification failed/);
});
