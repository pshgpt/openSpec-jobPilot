import assert from "node:assert/strict";
import { test } from "node:test";

import { renderJson, renderText } from "../src/report.js";

const REPORT = {
  score: 67,
  requirements: [
    { text: "Python", importance: "must-have", status: "matched", evidence: "Developed data tools in Python" },
    { text: "Kubernetes", importance: "nice-to-have", status: "gap", evidence: null },
    { text: "SQL", importance: "must-have", status: "matched", evidence: "Wrote SQL reports" },
  ],
};

test("text report shows the score, each match with its evidence, and each gap", () => {
  assert.equal(
    renderText(REPORT),
    `Match score: 67% (2 of 3 requirements matched)

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

test("text report says when a section is empty", () => {
  const text = renderText({ score: 0, requirements: [REPORT.requirements[1]] });
  assert.match(text, /Matched \(0\)\n {2}\(none\)/);
});

test("text report says when the score is unavailable", () => {
  assert.match(renderText({ score: null, requirements: [] }), /^Match score: unavailable/);
});

test("JSON report has exactly the documented fields, in order", () => {
  const json = JSON.parse(renderJson(REPORT));
  assert.deepEqual(Object.keys(json), ["score", "requirements"]);
  assert.equal(json.score, 67);
  for (const item of json.requirements) {
    assert.deepEqual(Object.keys(item), ["text", "importance", "status", "evidence"]);
  }
  assert.equal(json.requirements[1].evidence, null);
});

test("JSON report with no requirements", () => {
  assert.deepEqual(JSON.parse(renderJson({ score: null, requirements: [] })), { score: null, requirements: [] });
});
