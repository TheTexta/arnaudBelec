import assert from "node:assert/strict";
import { test } from "node:test";
import { canAutomaticallyRenew, renewedVideoSource, restoredVideoPosition } from "./video-recovery";

test("renewal uses only a canonical same-origin authorized native Media path", () => {
  assert.equal(renewedVideoSource("/api/cms/media/file/original%20film.mp4", 1), "/api/cms/media/file/original%20film.mp4?video-retry=1");
  for (const source of ["https://r2.example/film.mp4?signature=private", "//other.example/film.mp4", "/api/cms/media/file/a.mp4?signature=private", "/api/cms/media/file/a/b.mp4", "javascript:alert(1)"]) assert.equal(renewedVideoSource(source, 1), null);
  for (const attempt of [0, -1, Infinity, 1.5]) assert.equal(renewedVideoSource("/api/cms/media/file/a.mp4", attempt), null);
});

test("saved seek positions are finite and bounded without returning the exact end", () => {
  assert.equal(restoredVideoPosition(50, 100), 50);
  assert.equal(restoredVideoPosition(1000, 100), 99.95);
  assert.equal(restoredVideoPosition(NaN, 100), 0);
  assert.equal(restoredVideoPosition(-20, 100), 0);
  assert.equal(restoredVideoPosition(50, Infinity), 50);
});

test("only one online network recovery is automatic; decode/codec errors remain explicit", () => {
  assert.equal(canAutomaticallyRenew(2, true, false), true);
  assert.equal(canAutomaticallyRenew(1, true, false), true);
  for (const code of [undefined, 0, 3, 4]) assert.equal(canAutomaticallyRenew(code, true, false), false);
  assert.equal(canAutomaticallyRenew(2, false, false), false);
  assert.equal(canAutomaticallyRenew(2, true, true), false);
});
