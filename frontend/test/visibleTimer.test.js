import { test } from "node:test";
import assert from "node:assert/strict";
import { createVisibleTimer } from "../src/activity/visibleTimer.js";

test("visible time pauses in the background and resumes on return", () => {
  const timer = createVisibleTimer(1000, true);
  assert.equal(timer.seconds(2000), 1);

  timer.setVisible(false, 2500);
  assert.equal(timer.seconds(12000), 1);

  timer.setVisible(true, 12000);
  assert.equal(timer.seconds(12500), 2);
  assert.equal(timer.seconds(13000), 2);
});

test("initially hidden tabs do not count time until visible", () => {
  const timer = createVisibleTimer(1000, false);
  assert.equal(timer.seconds(5000), 0);

  timer.setVisible(true, 5000);
  assert.equal(timer.seconds(6000), 1);
});
