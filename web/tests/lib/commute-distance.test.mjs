import test from "node:test";
import assert from "node:assert/strict";
import { estimateCommuteMiles } from "../../src/lib/commute-distance.mjs";

test("estimates local commute miles from the configured 07828 origin", () => {
  const miles = estimateCommuteMiles("Lake Hopatcong, NJ", "07828");
  assert.ok(miles >= 5 && miles <= 15);
});

test("does not show a distance for remote or hybrid roles", () => {
  assert.equal(estimateCommuteMiles("Remote", "07828"), null);
  assert.equal(estimateCommuteMiles("Hybrid — Morristown, NJ", "07828"), null);
});

test("unknown places and unsupported origins fail closed", () => {
  assert.equal(estimateCommuteMiles("Somewhere", "07828"), null);
  assert.equal(estimateCommuteMiles("Marlton, NJ", "00000"), null);
});
