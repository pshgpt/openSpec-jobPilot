import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { AnalysisError } from "../src/errors.js";
import { EXTRACTION_SYSTEM_PROMPT, ExtractionOutput, extractRequirements } from "../src/extraction.js";
import { createFakeLlm } from "./fakes.js";

test("returns each requirement and sends the job description to the model", async () => {
  const llm = createFakeLlm({
    requirements: [
      { text: "Python", importance: "must-have" },
      { text: "SQL", importance: "must-have" },
      { text: "3+ years of backend experience", importance: "must-have" },
    ],
  });

  const requirements = await extractRequirements(llm, "We need Python, SQL and 3+ years of backend experience.");

  assert.deepEqual(
    requirements.map((r) => r.text),
    ["Python", "SQL", "3+ years of backend experience"],
  );
  assert.equal(llm.calls.length, 1);
  assert.equal(llm.calls[0].system, EXTRACTION_SYSTEM_PROMPT);
  assert.match(llm.calls[0].user, /We need Python, SQL/);
  assert.equal(llm.calls[0].schema, ExtractionOutput);
});

test("a job description with no requirements gives an empty list", async () => {
  const llm = createFakeLlm({ requirements: [] });
  assert.deepEqual(await extractRequirements(llm, "Acme is a great place to work."), []);
});

test("importance tags are kept", async () => {
  const llm = createFakeLlm({
    requirements: [
      { text: "SQL", importance: "must-have" },
      { text: "Kubernetes", importance: "nice-to-have" },
    ],
  });
  const requirements = await extractRequirements(llm, "Strong SQL skills. Kubernetes is a plus.");
  assert.deepEqual(
    requirements.map((r) => r.importance),
    ["must-have", "nice-to-have"],
  );
});

test("repeated requirements are reported once", async () => {
  const llm = createFakeLlm({
    requirements: [
      { text: "Python", importance: "must-have" },
      { text: " python ", importance: "must-have" },
    ],
  });
  assert.deepEqual(await extractRequirements(llm, "Python. Also Python."), [{ text: "Python", importance: "must-have" }]);
});

test("an invalid result raises an AnalysisError", async () => {
  for (const output of [
    { requirements: [{ text: "", importance: "must-have" }] },
    { requirements: [{ text: "Go", importance: "critical" }] },
    { something: "else" },
  ]) {
    await assert.rejects(extractRequirements(createFakeLlm(output), "jd"), AnalysisError, JSON.stringify(output));
  }
});

test("the output schema converts to a JSON Schema with enforced enums", () => {
  const schema = z.toJSONSchema(ExtractionOutput);
  assert.deepEqual(schema.properties.requirements.items.properties.importance.enum, ["must-have", "nice-to-have"]);
});
