import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { analyze } from "../src/analyze.js";
import { AnalysisError } from "../src/errors.js";
import { ClassificationOutput, classifyRequirements, MATCHING_SYSTEM_PROMPT, verifyEvidence } from "../src/matching.js";
import { createFakeLlm } from "./fakes.js";

const RESUME = `Jane Doe
Developed  data tools in
Python. Built reporting pipelines on Postgres.`;

const req = (text, importance = "must-have") => ({ text, importance });
const matched = (index, evidence) => ({ index, status: "matched", evidence });
const gap = (index) => ({ index, status: "gap", evidence: null });

test("every requirement is classified exactly once, in order", async () => {
  const llm = createFakeLlm({
    classifications: [gap(3), matched(1, "Developed data tools in Python"), matched(2, "Built reporting pipelines on Postgres")],
  });
  const result = await classifyRequirements(llm, [req("Python"), req("PostgreSQL"), req("Kubernetes", "nice-to-have")], RESUME);

  assert.deepEqual(result, [
    { text: "Python", importance: "must-have", status: "matched", evidence: "Developed data tools in Python" },
    { text: "PostgreSQL", importance: "must-have", status: "matched", evidence: "Built reporting pipelines on Postgres" },
    { text: "Kubernetes", importance: "nice-to-have", status: "gap", evidence: null },
  ]);
  assert.equal(llm.calls[0].system, MATCHING_SYSTEM_PROMPT);
  assert.match(llm.calls[0].user, /1\. Python\n2\. PostgreSQL\n3\. Kubernetes/);
  assert.match(llm.calls[0].user, /<resume>\nJane Doe/);
});

test("no requirements means no model call", async () => {
  const llm = createFakeLlm();
  assert.deepEqual(await classifyRequirements(llm, [], RESUME), []);
  assert.equal(llm.calls.length, 0);
});

test("a missing, duplicated, or unknown index raises an AnalysisError", async () => {
  const two = [req("Python"), req("SQL")];
  const cases = {
    missing: [gap(1)],
    duplicated: [gap(1), gap(1), gap(2)],
    unknown: [gap(1), gap(2), gap(3)],
    zero: [gap(0), gap(1), gap(2)],
    malformed: [{ index: 1, status: "partial", evidence: null }, gap(2)],
  };
  for (const [name, classifications] of Object.entries(cases)) {
    await assert.rejects(classifyRequirements(createFakeLlm({ classifications }), two, RESUME), AnalysisError, name);
  }
});

test("evidence not found in the resume is reported as a gap", () => {
  assert.deepEqual(verifyEvidence({ status: "matched", evidence: "Led a team of 10 engineers" }, RESUME), {
    status: "gap",
    evidence: null,
  });
});

test("evidence that differs only in case and spacing stays matched", () => {
  assert.deepEqual(verifyEvidence({ status: "matched", evidence: "developed data tools in python" }, RESUME), {
    status: "matched",
    evidence: "developed data tools in python",
  });
});

test("a match without evidence is a gap, and a gap's evidence is dropped", () => {
  assert.deepEqual(verifyEvidence({ status: "matched", evidence: null }, RESUME), { status: "gap", evidence: null });
  assert.deepEqual(verifyEvidence({ status: "matched", evidence: "  " }, RESUME), { status: "gap", evidence: null });
  assert.deepEqual(verifyEvidence({ status: "gap", evidence: "Python" }, RESUME), { status: "gap", evidence: null });
});

test("a downgraded match lowers the score to 50", async () => {
  const llm = createFakeLlm(
    { requirements: [req("Python"), req("Leadership")] },
    { classifications: [matched(1, "Developed data tools in Python"), matched(2, "Led a team of 10 engineers")] },
  );
  const report = await analyze({ llm, resume: RESUME, jobDescription: "jd" });

  assert.equal(report.score, 50);
  assert.deepEqual(
    report.requirements.map((r) => r.status),
    ["matched", "gap"],
  );
});

test("analyze skips classification when nothing was extracted, and the score is null", async () => {
  const llm = createFakeLlm({ requirements: [] });
  const report = await analyze({ llm, resume: RESUME, jobDescription: "Acme is a great place to work." });

  assert.deepEqual(report, { score: null, requirements: [] });
  assert.equal(llm.calls.length, 1);
});

test("the output schema converts to a JSON Schema with enforced enums", () => {
  const schema = z.toJSONSchema(ClassificationOutput);
  assert.deepEqual(schema.properties.classifications.items.properties.status.enum, ["matched", "gap"]);
});
