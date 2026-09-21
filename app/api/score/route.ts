import { NextRequest, NextResponse } from "next/server";
import { collectWebsiteEvidence } from "@/lib/evidence";
import { scoreWebsiteEvidence } from "@/lib/scoring";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const website = request.nextUrl.searchParams.get("url") ?? "";

  try {
    const evidence = await collectWebsiteEvidence(website);
    const score = scoreWebsiteEvidence(evidence);

    return NextResponse.json(
      { evidence, score },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not analyze that website.";

    return NextResponse.json(
      { error: message, state: "unavailable" },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
