import AnalysisScan from "@/components/AnalysisScan";
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
          <a className="secondary-button" href="/">Try another website</a>
        </div>
      </main>
    );
  }

  const hostname = new URL(result.url).hostname.replace(/^www\./, "");

  return <AnalysisScan website={result.url} hostname={hostname} />;
}
