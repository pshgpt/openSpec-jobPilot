import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { AnalysisError } from "../src/errors.js";
import { summarize, VERDICT_SYSTEM_PROMPT, VerdictOutput } from "../src/summary.js";
import { createFakeLlm } from "./fakes.js";

const match = (text, importance, evidence) => ({ text, importance, status: "matched", evidence });
const gap = (text, importance) => ({ text, importance, status: "gap", evidence: null });

const CLASSIFIED = [
  match("Strong Python skills", "must-have", "Developed data tools in Python"),
  gap("4+ years of backend experience", "must-have"),
  gap("Kubernetes", "nice-to-have"),
  match("Docker", "must-have", "Docker"),
  gap("Go", "nice-to-have"),
];

const VERDICT = "A good fit for the core backend work. The main concern is the required years of backend experience.";

/** Run summarize with a fake LLM, collecting warnings. */
async function run(classified, ...outputs) {
  const llm = createFakeLlm(...outputs);
  const warnings = [];
  const summary = await summarize(llm, classified, { onWarning: (w) => warnings.push(w) });
  return { summary, warnings, llm };
}

// 2.1 Missing-requirement lists

test("gaps of both kinds are listed separately, in report order", async () => {
  const { summary } = await run(CLASSIFIED, { verdict: VERDICT });
  assert.deepEqual(summary.missingMustHaves, ["4+ years of backend experience"]);
  assert.deepEqual(summary.missingNiceToHaves, ["Kubernetes", "Go"]);
});

test("no gaps gives empty lists", async () => {
  const { summary } = await run([match("Python", "must-have", "Python")], { verdict: VERDICT });
  assert.deepEqual(summary.missingMustHaves, []);
  assert.deepEqual(summary.missingNiceToHaves, []);
});

test("a downgraded match is listed as missing", async () => {
  // classifyRequirements reports an unverifiable match as a gap; the summary sees only that final status.
  const { summary } = await run([gap("Leadership", "must-have")], { verdict: VERDICT });
  assert.deepEqual(summary.missingMustHaves, ["Leadership"]);
});

// 2.2 Verdict call

test("the verdict is used, and the LLM sees only the final report", async () => {
  const { summary, warnings, llm } = await run(CLASSIFIED, { verdict: `  ${VERDICT}  ` });

  assert.equal(summary.verdict, VERDICT);
  assert.deepEqual(warnings, []);
  assert.equal(llm.calls.length, 1);

  const [call] = llm.calls;
  assert.equal(call.system, VERDICT_SYSTEM_PROMPT);
  assert.equal(call.schema, VerdictOutput);
  assert.match(call.user, /1\. \[must-have\] Strong Python skills: matched \(evidence: "Developed data tools in Python"\)/);
  assert.match(call.user, /2\. \[must-have\] 4\+ years of backend experience: gap/);
  assert.match(call.user, /5\. \[nice-to-have\] Go: gap/);
  assert.doesNotMatch(call.user, /score|%/i, "no score is given to the model");
});

test("the verdict output schema is a plain object with a string", () => {
  const schema = z.toJSONSchema(VerdictOutput);
  assert.deepEqual(schema.required, ["verdict"]);
  assert.equal(schema.properties.verdict.type, "string");
  assert.equal(schema.properties.verdict.maxLength, undefined, "Gemini doesn't support maxLength");
});

// 2.3 Verdict failures

for (const [name, output, reason] of [
  ["the call fails", new AnalysisError("The Gemini API is unavailable right now (503)."), /unavailable right now \(503\)/],
  ["the result is invalid", { something: "else" }, /no verdict/],
  ["the verdict is empty", { verdict: "   " }, /no verdict/],
  ["the verdict is too long", { verdict: "x".repeat(601) }, /longer than 600/],
  ["the verdict states a percentage", { verdict: "You match about 70% of the requirements." }, /percentage/],
]) {
  test(`verdict is null with a warning when ${name}, and the lists are kept`, async () => {
    const { summary, warnings } = await run(CLASSIFIED, output);
    assert.equal(summary.verdict, null);
    assert.deepEqual(summary.missingMustHaves, ["4+ years of backend experience"]);
    assert.deepEqual(summary.missingNiceToHaves, ["Kubernetes", "Go"]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^The summary verdict is unavailable: /);
    assert.match(warnings[0], reason);
  });
}

test("a verdict of exactly 600 characters is accepted", async () => {
  const { summary } = await run(CLASSIFIED, { verdict: "x".repeat(600) });
  assert.equal(summary.verdict.length, 600);
});

test("errors that aren't AnalysisErrors still propagate", async () => {
  await assert.rejects(run(CLASSIFIED, new TypeError("bug")), TypeError);
});

test("onWarning is optional", async () => {
  const summary = await summarize(createFakeLlm(new AnalysisError("down")), CLASSIFIED);
  assert.equal(summary.verdict, null);
});

// 2.4 No requirements

test("no requirements gives no summary and no LLM call", async () => {
  const { summary, llm, warnings } = await run([]);
  assert.equal(summary, null);
  assert.equal(llm.calls.length, 0);
  assert.deepEqual(warnings, []);
});
