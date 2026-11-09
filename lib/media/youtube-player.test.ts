import assert from "node:assert/strict";
import test from "node:test";
import { canonicalYoutubeUrl, youtubeVideoId } from "./youtube";

test("player inputs only resolve known HTTPS YouTube hosts or exact IDs", () => {
  for (const value of ["abcdefghijk", "https://youtu.be/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube-nocookie.com/embed/abcdefghijk"]) {
    assert.equal(youtubeVideoId(value), "abcdefghijk");
    assert.equal(canonicalYoutubeUrl(value), "https://www.youtube.com/watch?v=abcdefghijk");
  }
  for (const value of ["bad", "<iframe src='evil'>", "javascript:abcdefghijk", "https://youtube.com.evil.test/watch?v=abcdefghijk", "https://www.youtube.com@evil.test/watch?v=abcdefghijk", "http://youtube.com/watch?v=abcdefghijk", "https://youtube.com/watch?v=abcdefghijk&v=lmnopqrstuv", "https://youtube.com/embed/abcdefghijk/extra", "https://youtu.be/abcdefghijk%0a", null, {}]) {
    assert.equal(youtubeVideoId(value), null);
  }
});
