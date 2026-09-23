import { NextRequest, NextResponse } from "next/server";
import { collectWebsiteEvidence } from "@/lib/evidence";
import { scoreWebsiteEvidence } from "@/lib/scoring";
import { normalizeAndValidatePublicUrl } from "@/lib/network-safety";

export const runtime = "edge";

const GOALS = new Set([
  "Improve AI visibility",
  "Improve search discoverability",
  "Understand website weaknesses",
  "Website upgrade",
]);

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const secret = process.env.GEO_SCORE_INTAKE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Lead intake is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 180);
  const websiteUrl = clean(body.websiteUrl, 1000);
  const mainGoal = clean(body.mainGoal, 80);
  const notes = clean(body.notes, 3000);

  if (!name || !email || !company || !websiteUrl || !mainGoal) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!GOALS.has(mainGoal)) {
    return NextResponse.json({ error: "Choose a valid main goal." }, { status: 400 });
  }

  // A failed automated diagnostic must not block a customer from requesting a manual review.
  // Validate the URL even when no evidence can be collected.
  const validated = normalizeAndValidatePublicUrl(websiteUrl);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  let score: ReturnType<typeof scoreWebsiteEvidence> | null = null;
  try {
    score = scoreWebsiteEvidence(await collectWebsiteEvidence(validated.url.toString()));
  } catch {
    // Do not fabricate diagnostic evidence; the Article6 intake accepts a null score.
  }

  try {
    const categoryScores = score
      ? Object.fromEntries(score.dimensions.map((dimension) => [dimension.name, dimension.score]))
      : undefined;

    const response = await fetch("https://www.article6.org/api/geo-score-intake", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        company,
        websiteUrl,
        mainGoal,
        notes: notes || undefined,
        overallScore: score?.score ?? null,
        categoryScores,
        topFindings: score?.findings.map((finding) => ({
          title: finding.title,
          explanation: finding.explanation,
        })),
        analyzedAt: new Date().toISOString(),
        scoringVersion: score?.scoringVersion ?? "manual-review",
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error || "We could not submit your request. Please try again." },
        { status: response.status >= 500 ? 502 : 400, headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "We could not submit your request. Please try again." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
