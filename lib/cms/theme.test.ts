import assert from "node:assert/strict";
import { test } from "node:test";
import { adminThemePreference } from "./theme";

test("admin defaults to native Auto while retaining saved Light/Dark overrides", () => {
  assert.equal(adminThemePreference(""), "auto");
  assert.equal(adminThemePreference("payload-theme=light"), "light");
  assert.equal(adminThemePreference("other=value; payload-theme=dark; another=value"), "dark");
});

test("unknown theme preferences fall back to Auto without matching other cookies", () => {
  assert.equal(adminThemePreference("payload-theme=auto"), "auto");
  assert.equal(adminThemePreference("payload-theme=unknown"), "auto");
  assert.equal(adminThemePreference("not-payload-theme=dark"), "auto");
});
