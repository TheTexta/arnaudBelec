import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as list, POST as create } from "../../app/api/admin/posts/route";
import { GET as read, PUT as save } from "../../app/api/admin/posts/[id]/route";
import { POST as publish, DELETE as unpublish } from "../../app/api/admin/posts/[id]/publish/route";
import { POST as media } from "../../app/api/admin/posts/[id]/media/route";
import { GET as revisions } from "../../app/api/admin/posts/[id]/revisions/route";
import { GET as publicMedia } from "../../app/blog/media/[id]/route";

test("retired legacy routes never read, write, recover or sign journal content, even with CMS disabled", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("Retired routes must perform no network access");
  try {
    for (const endpoint of [list, create, read, save, publish, unpublish, media, revisions]) {
      const response = endpoint();
      assert.equal(response.status, 410);
      assert.equal((await response.json()).code, "journal_retired");
      assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
    }
    assert.equal(publicMedia().status, 404);
  } finally { globalThis.fetch = original; }
});
