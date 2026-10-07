import assert from "node:assert/strict";
import { test } from "node:test";

import { renderJson, renderText } from "../src/report.js";

const SUMMARY = {
  verdict: "A good fit for the data work. Kubernetes is the only gap, and it's a nice-to-have.",
  missingMustHaves: [],
  missingNiceToHaves: ["Kubernetes"],
};

const REPORT = {
  score: 67,
  requirements: [
    { text: "Python", importance: "must-have", status: "matched", evidence: "Developed data tools in Python" },
    { text: "Kubernetes", importance: "nice-to-have", status: "gap", evidence: null },
    { text: "SQL", importance: "must-have", status: "matched", evidence: "Wrote SQL reports" },
  ],
  summary: SUMMARY,
};

test("text report shows the score, the summary, each match with its evidence, and each gap", () => {
  assert.equal(
    renderText(REPORT),
    `Match score: 67% (2 of 3 requirements matched)

Summary
  A good fit for the data work. Kubernetes is the only gap, and it's a nice-to-have.
  Missing must-haves: none
  Missing nice-to-haves: Kubernetes

Matched (2)
  [must-have] Python
      Evidence: "Developed data tools in Python"
  [must-have] SQL
      Evidence: "Wrote SQL reports"

Gaps (1)
  [nice-to-have] Kubernetes
`,
  );
});

test("text summary lists several missing requirements, comma-separated", () => {
  const text = renderText({
    ...REPORT,
    summary: { verdict: "A weak fit.", missingMustHaves: ["Go", "Rust"], missingNiceToHaves: [] },
  });
  assert.match(text, /\n {2}Missing must-haves: Go, Rust\n {2}Missing nice-to-haves: none\n/);
});

test("text summary says when the verdict is unavailable and still lists what's missing", () => {
  const text = renderText({ ...REPORT, summary: { ...SUMMARY, verdict: null } });
  assert.match(text, /Summary\n {2}Verdict unavailable \(see the warning above\)\.\n {2}Missing must-haves: none\n {2}Missing nice-to-haves: Kubernetes\n/);
});

test("text report has no summary section when there is no summary", () => {
  assert.doesNotMatch(renderText({ ...REPORT, summary: null }), /Summary/);
  assert.equal(
    renderText({ score: null, requirements: [], summary: null }),
    "Match score: unavailable (no requirements were found in the job description)\n",
  );
});

test("text report says when a section is empty", () => {
  const text = renderText({ score: 0, requirements: [REPORT.requirements[1]], summary: null });
  assert.match(text, /Matched \(0\)\n {2}\(none\)/);
});

test("JSON report has exactly the documented fields, in order", () => {
  const json = JSON.parse(renderJson(REPORT));
  assert.deepEqual(Object.keys(json), ["score", "requirements", "summary"]);
  assert.equal(json.score, 67);
  for (const item of json.requirements) {
    assert.deepEqual(Object.keys(item), ["text", "importance", "status", "evidence"]);
  }
  assert.equal(json.requirements[1].evidence, null);
  assert.deepEqual(Object.keys(json.summary), ["verdict", "missingMustHaves", "missingNiceToHaves"]);
  assert.deepEqual(json.summary, SUMMARY);
});

test("JSON summary with an unavailable verdict", () => {
  const json = JSON.parse(renderJson({ ...REPORT, summary: { ...SUMMARY, verdict: null } }));
  assert.equal(json.summary.verdict, null);
  assert.deepEqual(json.summary.missingNiceToHaves, ["Kubernetes"]);
});

test("JSON report with no requirements", () => {
  const output = renderJson({ score: null, requirements: [], summary: null });
  assert.deepEqual(JSON.parse(output), { score: null, requirements: [], summary: null });
  assert.equal(JSON.stringify(JSON.parse(output)), '{"score":null,"requirements":[],"summary":null}');
});
