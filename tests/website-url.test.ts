import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWebsiteUrl } from "../lib/website-url.ts";

test("adds https when scheme is omitted", () => {
  assert.deepEqual(normalizeWebsiteUrl("example.com"), {
    ok: true,
    url: "https://example.com/",
  });
});

test("preserves valid https URL and strips hash", () => {
  assert.deepEqual(normalizeWebsiteUrl(" https://example.com/path#section "), {
    ok: true,
    url: "https://example.com/path",
  });
});

test("accepts http for sites that do not support https", () => {
  assert.deepEqual(normalizeWebsiteUrl("http://example.com"), {
    ok: true,
    url: "http://example.com/",
  });
});

test("rejects unsupported schemes", () => {
  const result = normalizeWebsiteUrl("ftp://example.com");
  assert.equal(result.ok, false);
});

test("rejects embedded credentials", () => {
  const result = normalizeWebsiteUrl("https://user:pass@example.com");
  assert.equal(result.ok, false);
});

test("rejects empty input", () => {
  assert.deepEqual(normalizeWebsiteUrl("   "), {
    ok: false,
    error: "Enter a website address.",
  });
});
