import assert from "node:assert/strict";
import { test } from "node:test";

import { score } from "../src/scoring.js";

const MATCH = { status: "matched", evidence: "quoted from resume" };
const GAP = { status: "gap", evidence: null };

const of = (matched, total) => [...Array(matched).fill(MATCH), ...Array(total - matched).fill(GAP)];

for (const [name, matched, total, expected] of [
  ["partial match", 3, 4, 75],
  ["rounding", 2, 3, 67],
  ["rounding a half up", 1, 8, 13],
  ["full match", 4, 4, 100],
  ["no match", 0, 4, 0],
]) {
  test(`${name}: ${matched} of ${total} -> ${expected}`, () => {
    assert.equal(score(of(matched, total)), expected);
  });
}

test("importance does not affect the score", () => {
  const items = [
    { text: "SQL", importance: "must-have", status: "gap", evidence: null },
    { text: "Kubernetes", importance: "nice-to-have", status: "matched", evidence: "Ran Kubernetes" },
  ];
  assert.equal(score(items), 50);
});

test("no requirements gives no score", () => {
  assert.equal(score([]), null);
});

test("score is within half a point of the exact percentage, halves rounding up", () => {
  // With exact value 100m/n, a correct score s satisfies -1/2 < s - 100m/n <= 1/2.
  // Multiplying by 2n keeps it in integers: -n < 2ns - 200m <= n.
  for (let total = 1; total < 60; total++) {
    for (let matched = 0; matched <= total; matched++) {
      const twice = 2 * total * score(of(matched, total)) - 200 * matched;
      assert.ok(-total < twice && twice <= total, `${matched}/${total}`);
    }
  }
});
