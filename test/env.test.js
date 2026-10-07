import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { loadEnv } from "../src/env.js";

const dir = mkdtempSync(join(tmpdir(), "jobpilot-env-"));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Run fn with the given variables unset, restoring them afterwards. */
function withUnset(names, fn) {
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  for (const n of names) delete process.env[n];
  try {
    fn();
  } finally {
    for (const [n, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
  }
}

test("loads variables from a .env file", () => {
  const path = join(dir, "present.env");
  writeFileSync(path, "JOBPILOT_TEST_A=from-file\n# a comment\nJOBPILOT_TEST_B=\"quoted value\"\n");
  withUnset(["JOBPILOT_TEST_A", "JOBPILOT_TEST_B"], () => {
    assert.equal(loadEnv(path), true);
    assert.equal(process.env.JOBPILOT_TEST_A, "from-file");
    assert.equal(process.env.JOBPILOT_TEST_B, "quoted value");
  });
});

test("a missing .env file is not an error", () => {
  assert.equal(loadEnv(join(dir, "does-not-exist.env")), false);
});

test("variables already in the environment win over the file", () => {
  const path = join(dir, "override.env");
  writeFileSync(path, "JOBPILOT_TEST_C=from-file\n");
  withUnset(["JOBPILOT_TEST_C"], () => {
    process.env.JOBPILOT_TEST_C = "from-environment";
    loadEnv(path);
    assert.equal(process.env.JOBPILOT_TEST_C, "from-environment");
  });
});
