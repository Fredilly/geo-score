import Link from "next/link";
import { normalizeWebsiteUrl } from "@/lib/website-url";

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url: rawUrl } = await searchParams;
  const result = normalizeWebsiteUrl(rawUrl ?? "");

  if (!result.ok) {
    return (
      <main className="state-page">
        <div>
          <p className="eyebrow">Website required</p>
          <h1>We need a valid URL.</h1>
          <p className="lede">{result.error}</p>
          <Link className="secondary-button" href="/">Try another website</Link>
        </div>
      </main>
    );
  }

  const hostname = new URL(result.url).hostname.replace(/^www\./, "");

  return (
    <main className="state-page analyze-handoff">
      <div>
        <p className="eyebrow">Website accepted</p>
        <h1>{hostname}</h1>
        <p className="lede">
          Signal has normalized your website address. Live evidence collection is
          the next stage of the build, so no score is being invented here.
        </p>
        <dl className="handoff-details">
          <div>
            <dt>Normalized URL</dt>
            <dd>{result.url}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Ready for evidence collection</dd>
          </div>
        </dl>
        <Link className="secondary-button" href="/">Analyze another website</Link>
      </div>
    </main>
  );
}
