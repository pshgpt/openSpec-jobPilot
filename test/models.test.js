import assert from "node:assert/strict";
import { test } from "node:test";

import { Classification, ClassifiedRequirement, Report, Requirement } from "../src/models.js";

test("requirement accepts a known importance", () => {
  assert.equal(Requirement.parse({ text: "Python", importance: "must-have" }).importance, "must-have");
});

test("requirement rejects an unknown importance or empty text", () => {
  assert.equal(Requirement.safeParse({ text: "Python", importance: "required" }).success, false);
  assert.equal(Requirement.safeParse({ text: "  ", importance: "must-have" }).success, false);
});

test("matched with evidence is valid", () => {
  const c = Classification.parse({ status: "matched", evidence: "Developed data tools in Python" });
  assert.equal(c.evidence, "Developed data tools in Python");
});

test("gap without evidence is valid and evidence defaults to null", () => {
  assert.equal(Classification.parse({ status: "gap" }).evidence, null);
});

test("matched without evidence is rejected", () => {
  for (const evidence of [null, "", "   ", undefined]) {
    assert.equal(Classification.safeParse({ status: "matched", evidence }).success, false, String(evidence));
  }
});

test("gap with evidence is rejected", () => {
  assert.equal(Classification.safeParse({ status: "gap", evidence: "Used Kubernetes" }).success, false);
});

test("unknown status is rejected", () => {
  assert.equal(Classification.safeParse({ status: "partial", evidence: "x" }).success, false);
});

test("classified requirement applies both sets of rules", () => {
  assert.deepEqual(ClassifiedRequirement.parse({ text: "SQL", importance: "nice-to-have", status: "gap" }), {
    text: "SQL",
    importance: "nice-to-have",
    status: "gap",
    evidence: null,
  });
  assert.equal(ClassifiedRequirement.safeParse({ text: "SQL", importance: "nice-to-have", status: "matched" }).success, false);
  assert.equal(ClassifiedRequirement.safeParse({ text: "SQL", importance: "bonus", status: "gap" }).success, false);
});

test("report allows a null score and rejects out-of-range scores", () => {
  assert.equal(Report.safeParse({ score: null, requirements: [] }).success, true);
  assert.equal(Report.safeParse({ score: 101, requirements: [] }).success, false);
  assert.equal(Report.safeParse({ score: 12.5, requirements: [] }).success, false);
});
