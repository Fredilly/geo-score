import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/lead/route.ts", "utf8");
const form = fs.readFileSync("components/LeadForm.tsx", "utf8");
const scan = fs.readFileSync("components/AnalysisScan.tsx", "utf8");

test("lead submission stays server-side and uses the Article6 intake secret", () => {
  assert.match(route, /GEO_SCORE_INTAKE_SECRET/);
  assert.match(route, /https:\/\/www\.article6\.org\/api\/geo-score-intake/);
  assert.match(route, /authorization:/);
});

test("lead route derives trusted diagnostic metadata when collection succeeds and accepts manual review otherwise", () => {
  assert.match(route, /scoreWebsiteEvidence\(await collectWebsiteEvidence\(validated\.url\.toString\(\)\)\)/);
  assert.match(route, /overallScore: score\?\.score \?\? null/);
  assert.match(route, /scoringVersion: score\?\.scoringVersion \?\? "manual-review"/);
  assert.match(route, /topFindings: score\?\.findings/);
  assert.match(route, /https:\/\/www\.article6\.org\/api\/geo-score-intake/);
});

test("done-for-you form contains the required qualification fields", () => {
  for (const field of ["name", "email", "company", "websiteUrl", "mainGoal"]) {
    assert.match(form, new RegExp(`name="${field}"`));
  }
  assert.match(form, /Ask Article6 to improve it/);
});

test("results page exposes diagnosis before the service enquiry CTA", () => {
  assert.match(scan, /geo-checks/);
  assert.match(scan, /Top findings/);
  assert.match(scan, /Have Article6 fix this/);
  assert.match(scan, /LeadForm/);
});
