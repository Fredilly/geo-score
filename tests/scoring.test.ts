import assert from "node:assert/strict";
import test from "node:test";
import type { WebsiteEvidence } from "../lib/evidence.ts";
import { MAX_MEASURABLE_POINTS, MIN_SCORE_COVERAGE, SCORING_VERSION, scoreWebsiteEvidence } from "../lib/scoring.ts";

function fixture(): WebsiteEvidence {
  return {
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    state: "complete",
    warnings: [],
    homepage: {
      url: "https://example.com/",
      status: 200,
      title: "Example Company",
      description: "Independent technical services for teams.",
      canonical: "https://example.com/",
      headings: ["Independent technical services", "What we do", "Our process"],
      internalLinks: [
        "https://example.com/services",
        "https://example.com/about",
        "https://example.com/contact",
      ],
      readableText:
        "Example Company provides technical services. What we do. Our team has specialist experience. Contact us by email. Our process includes research, evidence, examples and case studies for clients. " +
        "We explain our methodology and results clearly. ".repeat(8),
      structuredDataBlocks: 1,
    },
    pages: [
      {
        url: "https://example.com/services",
        status: 200,
        title: "Services",
        description: "Services",
        canonical: "https://example.com/services",
        headings: ["Services"],
        internalLinks: ["https://example.com/contact"],
        readableText: "Services and solutions with a clear process and examples.",
        structuredDataBlocks: 0,
      },
    ],
    robots: { url: "https://example.com/robots.txt", status: 200, present: true, aiAccess: "allowed", blockedBots: [] },
    sitemap: { url: "https://example.com/sitemap.xml", status: 200, present: true },
    llms: { url: "https://example.com/llms.txt", status: 404, present: false },
  };
}

test("same evidence and scoring version produce the same score", () => {
  const evidence = fixture();
  const first = scoreWebsiteEvidence(evidence);
  const second = scoreWebsiteEvidence(evidence);

  assert.equal(first.scoringVersion, SCORING_VERSION);
  assert.deepEqual(first, second);
});

test("unavailable criteria are explicit and do not count as assessed failures", () => {
  const result = scoreWebsiteEvidence(fixture());
  const targetQuestions = result.criteria.find((criterion) => criterion.id === "answers.direct");
  const schemaTypes = result.criteria.find((criterion) => criterion.id === "schema.correct_types");

  assert.equal(targetQuestions?.status, "unavailable");
  assert.equal(schemaTypes?.status, "unavailable");
  assert.ok(result.assessedPoints < 100);
  assert.equal(result.coverage, Math.round((result.assessedPoints / MAX_MEASURABLE_POINTS) * 100));
});

test("every assessed criterion exposes evidence or an observable explanation", () => {
  const result = scoreWebsiteEvidence(fixture());

  for (const criterion of result.criteria.filter((item) => item.status !== "unavailable")) {
    assert.ok(criterion.explanation.length > 0);
    assert.ok(criterion.evidence.length > 0, criterion.id);
  }
});

test("low evidence coverage withholds the overall score", () => {
  const sparse: WebsiteEvidence = {
    ...fixture(),
    homepage: {
      ...fixture().homepage!,
      title: null,
      description: null,
      canonical: null,
      headings: [],
      internalLinks: [],
      readableText: "",
      structuredDataBlocks: 0,
    },
    pages: [],
    robots: { url: "https://example.com/robots.txt", status: null, present: false, aiAccess: "unknown", blockedBots: [] },
    sitemap: { url: "https://example.com/sitemap.xml", status: null, present: false },
    llms: { url: "https://example.com/llms.txt", status: null, present: false },
  };

  const result = scoreWebsiteEvidence(sparse);
  assert.equal(result.score, null);
  assert.equal(result.state, "insufficient_evidence");
});

test("public dimensions are derived from assessed rubric criteria", () => {
  const result = scoreWebsiteEvidence(fixture());
  assert.deepEqual(
    result.dimensions.map((dimension) => dimension.name),
    ["Access", "Understanding", "Answers", "Trust", "Authority"],
  );
  assert.ok(result.dimensions.every((dimension) => dimension.coverage >= 0 && dimension.coverage <= 100));
});


test("free result exposes at most three failed findings and counts the rest", () => {
  const result = scoreWebsiteEvidence(fixture());
  const failed = result.criteria.filter((criterion) => criterion.status === "fail");

  assert.ok(result.findings.length <= 3);
  assert.equal(result.opportunityCount, Math.max(0, failed.length - result.findings.length));
  assert.ok(result.findings.every((finding) => finding.title && finding.explanation));
});


test("utility-style sites do not receive a misleading business GEO score", () => {
  const utility: WebsiteEvidence = {
    ...fixture(),
    homepage: {
      ...fixture().homepage!,
      title: "Search",
      description: "Search the web.",
      headings: ["Search"],
      readableText: "Search Images Maps News Sign in Settings Help Privacy Terms ".repeat(20),
    },
    pages: [],
  };

  const result = scoreWebsiteEvidence(utility);
  assert.equal(result.businessApplicable, false);
  assert.equal(result.score, null);
  assert.equal(result.state, "not_applicable");
});

test("practical GEO check groups are always exposed", () => {
  const result = scoreWebsiteEvidence(fixture());
  assert.deepEqual(
    result.checkGroups.map((group) => group.name),
    ["AI access", "Site discovery", "Machine understanding", "Business clarity", "Answerability", "Trust & proof"],
  );
});


test("full v1 evidence can now pass the 75% measurable coverage gate", () => {
  const result = scoreWebsiteEvidence(fixture());

  assert.ok(result.coverage >= MIN_SCORE_COVERAGE);
  assert.equal(result.state, "scored");
  assert.equal(typeof result.score, "number");
});

test("truncated business pages retain eligibility when clear business signals exist", () => {
  const result = scoreWebsiteEvidence({
    ...fixture(),
    state: "partial",
    homepageTruncated: true,
    warnings: ["Homepage exceeds the collection limit."],
  });
  assert.equal(result.businessApplicable, true);
  assert.equal(result.state, "scored");
});

test("truncated unknown site is never classified as a nonbusiness or given a made-up score", () => {
  const base = fixture();
  const result = scoreWebsiteEvidence({
    ...base,
    state: "partial",
    homepageTruncated: true,
    warnings: ["Homepage exceeds the collection limit."],
    homepage: {
      ...base.homepage!,
      title: "Site",
      description: "Explore",
      headings: ["Welcome"],
      readableText: "Welcome ".repeat(100),
    },
    pages: [],
  });
  assert.equal(result.businessApplicable, true);
  assert.equal(result.score, null);
  assert.equal(result.state, "insufficient_evidence");
});

test("public checks explain technical signals in plain English", () => {
  const evidence = fixture();
  evidence.robots = { ...evidence.robots, status: 404, present: false, aiAccess: "unknown" };
  evidence.sitemap = { ...evidence.sitemap, status: 404, present: false };

  const result = scoreWebsiteEvidence(evidence);
  const access = result.checkGroups.find((group) => group.name === "AI access");
  const discovery = result.checkGroups.find((group) => group.name === "Site discovery");
  const robots = access?.checks.find((check) => check.label === "robots.txt");
  const sitemap = discovery?.checks.find((check) => check.label === "Sitemap");
  const llms = discovery?.checks.find((check) => check.label === "llms.txt (optional)");

  assert.match(robots?.detail ?? "", /crawler instructions are unclear/i);
  assert.match(sitemap?.detail ?? "", /less help discovering important pages/i);
  assert.match(llms?.detail ?? "", /not part of the score/i);
});
