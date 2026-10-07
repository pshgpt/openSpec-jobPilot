import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "@google/genai";
import { z } from "zod";

import { AnalysisError } from "../src/errors.js";
import { createGeminiLlm, DEFAULT_MODEL } from "../src/llm.js";

const Schema = z.object({ answer: z.string(), kind: z.enum(["a", "b"]) });

/** A stand-in for the SDK client whose generateContent returns or throws what it's given. */
function stubClient(result) {
  const requests = [];
  return {
    requests,
    models: {
      async generateContent(request) {
        requests.push(request);
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}

const ok = (data) => ({ text: JSON.stringify(data), candidates: [{ finishReason: "STOP" }] });
const apiError = (status, message) => new ApiError({ status, message: JSON.stringify({ error: { code: status, message } }) });

test("returns the validated output and sends a JSON-schema request", async () => {
  const client = stubClient(ok({ answer: "42", kind: "a" }));
  const llm = createGeminiLlm({ client, model: "test-model" });

  assert.deepEqual(await llm.parse({ system: "sys", user: "question", schema: Schema }), { answer: "42", kind: "a" });

  const [request] = client.requests;
  assert.equal(request.model, "test-model");
  assert.equal(request.contents, "question");
  assert.equal(request.config.systemInstruction, "sys");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.deepEqual(request.config.responseJsonSchema.properties.kind.enum, ["a", "b"]);
});

test("model defaults to gemini-3.1-flash-lite and can be overridden with JOBPILOT_MODEL", async () => {
  const saved = process.env.JOBPILOT_MODEL;
  try {
    delete process.env.JOBPILOT_MODEL;
    let client = stubClient(ok({ answer: "x", kind: "a" }));
    await createGeminiLlm({ client }).parse({ system: "", user: "", schema: Schema });
    assert.equal(client.requests[0].model, DEFAULT_MODEL);
    assert.equal(DEFAULT_MODEL, "gemini-3.1-flash-lite");

    process.env.JOBPILOT_MODEL = "gemini-3.5-flash";
    client = stubClient(ok({ answer: "x", kind: "a" }));
    await createGeminiLlm({ client }).parse({ system: "", user: "", schema: Schema });
    assert.equal(client.requests[0].model, "gemini-3.5-flash");
  } finally {
    if (saved === undefined) delete process.env.JOBPILOT_MODEL;
    else process.env.JOBPILOT_MODEL = saved;
  }
});

test("a missing API key explains how to configure it, before any request", () => {
  for (const apiKey of [undefined, "", "   "]) {
    assert.throws(() => createGeminiLlm({ apiKey }), (error) => {
      assert.ok(error instanceof AnalysisError);
      assert.match(error.message, /No Gemini API key.*GEMINI_API_KEY.*\.env/s);
      return true;
    });
  }
});

test("a real client is created when a key is given", () => {
  assert.equal(typeof createGeminiLlm({ apiKey: "test-key" }).parse, "function");
});

async function failureMessage(result) {
  const llm = createGeminiLlm({ client: stubClient(result), model: "m" });
  const error = await llm.parse({ system: "", user: "", schema: Schema }).then(
    () => assert.fail("expected an AnalysisError"),
    (e) => e,
  );
  assert.ok(error instanceof AnalysisError, `got ${error?.constructor?.name}`);
  return error.message;
}

test("unusable responses become AnalysisErrors", async () => {
  assert.match(await failureMessage({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] }), /blocked the request \(SAFETY\)/);
  assert.match(await failureMessage({ text: "{", candidates: [{ finishReason: "MAX_TOKENS" }] }), /cut off/);
  assert.match(await failureMessage({ text: "", candidates: [{ finishReason: "SAFETY" }] }), /without finishing.*SAFETY/);
  assert.match(await failureMessage({ candidates: [] }), /without finishing.*no response/);
  assert.match(await failureMessage({ text: "not json", candidates: [{ finishReason: "STOP" }] }), /not valid JSON/);
  assert.match(await failureMessage(ok({ answer: "x", kind: "c" })), /did not match the expected format/);
});

test("a rejected API key explains how to configure it", async () => {
  const invalid = apiError(400, "API key not valid. Please pass a valid API key.");
  assert.match(await failureMessage(invalid), /rejected the API key: API key not valid.*GEMINI_API_KEY/s);
  assert.match(await failureMessage(apiError(403, "Permission denied")), /rejected the API key/);
});

test("other API errors become readable AnalysisErrors", async () => {
  assert.match(await failureMessage(apiError(404, "models/m is not found")), /could not find model "m".*JOBPILOT_MODEL/);
  assert.match(await failureMessage(apiError(429, "Quota exceeded")), /rate limit or quota.*Quota exceeded/);
  assert.match(await failureMessage(apiError(503, "high demand")), /unavailable right now \(503\).*Try again/);
  assert.match(await failureMessage(apiError(400, "Invalid schema")), /returned an error \(400\): Invalid schema/);
  assert.match(await failureMessage(new TypeError("fetch failed")), /Could not reach the Gemini API: fetch failed/);
});
