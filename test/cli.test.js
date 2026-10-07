import assert from "node:assert/strict";
import { test } from "node:test";

import { main, USAGE } from "../src/cli.js";
import { AnalysisError } from "../src/errors.js";
import { createFakeLlm } from "./fakes.js";

const RESUME = "Developed data tools in Python.\nBuilt reporting pipelines on Postgres.";
const JD = "We need Python and PostgreSQL. Kubernetes is a plus.";

const EXTRACTED = {
  requirements: [
    { text: "Python", importance: "must-have" },
    { text: "PostgreSQL", importance: "must-have" },
    { text: "Kubernetes", importance: "nice-to-have" },
  ],
};
const CLASSIFIED = {
  classifications: [
    { index: 1, status: "matched", evidence: "Developed data tools in Python" },
    { index: 2, status: "matched", evidence: "Built reporting pipelines on Postgres" },
    { index: 3, status: "gap", evidence: null },
  ],
};

function capture() {
  let text = "";
  return { write: (chunk) => (text += chunk), get text() { return text; } };
}

/** A fake readFile over an in-memory map of path -> string | Buffer | Error. */
function files(entries) {
  return async (path) => {
    if (!(path in entries)) throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: "ENOENT" });
    const value = entries[path];
    if (value instanceof Error) throw value;
    return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  };
}

async function run(argv, { readFile = files({ "resume.txt": RESUME, "jd.txt": JD }), outputs = [EXTRACTED, CLASSIFIED] } = {}) {
  const stdout = capture();
  const stderr = capture();
  const llm = createFakeLlm(...outputs);
  let llmCreated = false;
  const createLlm = () => {
    llmCreated = true;
    return llm;
  };
  const code = await main(argv, { stdout, stderr, readFile, createLlm });
  return { code, stdout: stdout.text, stderr: stderr.text, llm, llmCreated };
}

test("valid inputs print a text report and exit 0", async () => {
  const { code, stdout, stderr } = await run(["analyze", "resume.txt", "jd.txt"]);
  assert.equal(code, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /^Match score: 67% \(2 of 3 requirements matched\)/);
  assert.match(stdout, /\[nice-to-have\] Kubernetes/);
});

test("--json prints one JSON object and nothing else", async () => {
  const { code, stdout } = await run(["analyze", "resume.txt", "jd.txt", "--json"]);
  assert.equal(code, 0);
  const json = JSON.parse(stdout);
  assert.equal(json.score, 67);
  assert.equal(json.requirements.length, 3);
});

test("--json with no requirements", async () => {
  const { stdout, llm } = await run(["analyze", "resume.txt", "jd.txt", "--json"], { outputs: [{ requirements: [] }] });
  assert.deepEqual(JSON.parse(stdout), { score: null, requirements: [] });
  assert.equal(llm.calls.length, 1);
});

test("--help prints usage", async () => {
  const { code, stdout } = await run(["--help"]);
  assert.equal(code, 0);
  assert.equal(stdout, USAGE);
});

test("wrong arguments print usage and exit non-zero", async () => {
  for (const argv of [[], ["analyze"], ["analyze", "resume.txt"], ["compare", "a", "b"], ["analyze", "a", "b", "c"], ["analyze", "a", "b", "--nope"]]) {
    const { code, stderr, llmCreated } = await run(argv);
    assert.notEqual(code, 0, argv.join(" "));
    assert.match(stderr, /Usage: jobpilot analyze/);
    assert.equal(llmCreated, false);
  }
});

const INVALID_INPUTS = {
  "missing resume": [{ "jd.txt": JD }, /resume file not found: resume\.txt/],
  "missing job description": [{ "resume.txt": RESUME }, /job description file not found: jd\.txt/],
  "unreadable resume": [
    { "resume.txt": Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }), "jd.txt": JD },
    /could not read resume file resume\.txt/,
  ],
  "resume not UTF-8": [{ "resume.txt": Buffer.from([0x50, 0xff, 0xfe, 0x00]), "jd.txt": JD }, /resume file resume\.txt is not valid UTF-8/],
  "empty resume": [{ "resume.txt": "", "jd.txt": JD }, /resume file resume\.txt is empty/],
  "whitespace-only job description": [{ "resume.txt": RESUME, "jd.txt": " \n\t\n " }, /job description file jd\.txt is empty/],
};

for (const [name, [entries, message]] of Object.entries(INVALID_INPUTS)) {
  test(`${name}: names the file, exits non-zero, and makes no LLM call`, async () => {
    const { code, stdout, stderr, llmCreated } = await run(["analyze", "resume.txt", "jd.txt"], { readFile: files(entries) });
    assert.notEqual(code, 0);
    assert.match(stderr, message);
    assert.equal(stdout, "");
    assert.equal(llmCreated, false);
  });
}

test("a failure during extraction prints an error and no report", async () => {
  const { code, stdout, stderr } = await run(["analyze", "resume.txt", "jd.txt"], {
    outputs: [new AnalysisError("No Gemini API key was found. Add GEMINI_API_KEY=<your key> to a .env file.")],
  });
  assert.notEqual(code, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /^Error: No Gemini API key was found/);
});

test("a failure during classification prints an error and no report", async () => {
  for (const json of [false, true]) {
    const argv = ["analyze", "resume.txt", "jd.txt", ...(json ? ["--json"] : [])];
    const { code, stdout, stderr } = await run(argv, {
      outputs: [EXTRACTED, new AnalysisError("The model declined to analyze this input.")],
    });
    assert.notEqual(code, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /declined/);
  }
});
