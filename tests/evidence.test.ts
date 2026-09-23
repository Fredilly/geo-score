import assert from "node:assert/strict";
import test from "node:test";
import { blockedAiBotsFromRobots, isRedirectStatus, parsePageEvidence, readBoundedBody } from "../lib/evidence.ts";

test("extracts bounded page evidence without scoring it", () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Example Company</title>
        <meta name="description" content="Independent technical review.">
        <link rel="canonical" href="https://example.com/">
        <script type="application/ld+json">{"@type":"Organization"}</script>
      </head>
      <body>
        <h1>Clear answers</h1>
        <h2>What we do</h2>
        <a href="/services">Services</a>
        <a href="https://outside.example/path">Outside</a>
        <script>secretNoise()</script>
        <p>Useful public evidence.</p>
      </body>
    </html>
  `;

  const evidence = parsePageEvidence(
    new URL("https://example.com/"),
    200,
    html,
  );

  assert.equal(evidence.title, "Example Company");
  assert.equal(evidence.description, "Independent technical review.");
  assert.equal(evidence.canonical, "https://example.com/");
  assert.deepEqual(evidence.headings, ["Clear answers", "What we do"]);
  assert.deepEqual(evidence.internalLinks, ["https://example.com/services"]);
  assert.equal(evidence.structuredDataBlocks, 1);
  assert.match(evidence.readableText, /Useful public evidence/);
  assert.doesNotMatch(evidence.readableText, /secretNoise/);
});


test("only actual redirect status codes require a Location header", () => {
  for (const status of [301, 302, 303, 307, 308]) {
    assert.equal(isRedirectStatus(status), true, String(status));
  }

  for (const status of [200, 204, 300, 304, 305, 306, 399, 400]) {
    assert.equal(isRedirectStatus(status), false, String(status));
  }
});


test("detects blanket blocks for common AI crawlers", () => {
  const robots = [
    "User-agent: GPTBot",
    "Disallow: /",
    "User-agent: PerplexityBot",
    "Disallow: /",
    "User-agent: *",
    "Allow: /",
  ].join("\n");

  assert.deepEqual(blockedAiBotsFromRobots(robots), ["GPTBot", "PerplexityBot"]);
});

test("oversized homepage can yield bounded partial evidence", async () => {
  const response = new Response(
    "<html><head><title>Large Site</title></head><body>" + "x".repeat(2000),
  );
  const result = await readBoundedBody(response, 100, true);
  assert.equal(result.truncated, true);
  assert.ok(new TextEncoder().encode(result.body).byteLength <= 100);
  assert.match(result.body, /Large Site/);
});

test("oversized auxiliary resources still fail closed", async () => {
  const response = new Response("x".repeat(2000));
  await assert.rejects(readBoundedBody(response, 100), /response_too_large/);
});

test("ordinary homepage is not marked partial", async () => {
  const result = await readBoundedBody(new Response("<title>Small Site</title>"), 100, true);
  assert.deepEqual(result, { body: "<title>Small Site</title>", truncated: false });
});
