import type { WebsiteEvidence } from "./evidence.ts";

export const SCORING_VERSION = "geo-v1.0.0";

export type CriterionStatus = "pass" | "fail" | "unavailable";

export type CriterionResult = {
  id: string;
  category:
    | "crawlability"
    | "technical"
    | "structured_data"
    | "entity_clarity"
    | "answerability"
    | "trust"
    | "content_differentiation";
  label: string;
  weight: number;
  earned: number;
  status: CriterionStatus;
  evidence: string[];
  explanation: string;
};

export type PublicDimension = "Access" | "Understanding" | "Answers" | "Trust" | "Authority";

export type PublicDimensionScore = {
  name: PublicDimension;
  score: number | null;
  coverage: number;
  evidence: string[];
};

export type GeoScoreResult = {
  scoringVersion: string;
  label: "Article6 GEO Diagnostic Score";
  score: number | null;
  earnedPoints: number;
  assessedPoints: number;
  coverage: number;
  state: "scored" | "insufficient_evidence";
  criteria: CriterionResult[];
  dimensions: PublicDimensionScore[];
};

type CriterionInput = Omit<CriterionResult, "earned" | "status"> & {
  measured: boolean;
  passed: boolean;
};

export function scoreWebsiteEvidence(evidence: WebsiteEvidence): GeoScoreResult {
  const homepage = evidence.homepage;
  const pages = [homepage, ...evidence.pages].filter(Boolean);
  const allText = pages.map((page) => page!.readableText).join(" ").toLowerCase();
  const allLinks = pages.flatMap((page) => page!.internalLinks);
  const allHeadings = pages.flatMap((page) => page!.headings);
  const hasHomepage = Boolean(homepage);
  const hasUsableText = Boolean(homepage && homepage.readableText.length >= 200);

  const criteria: CriterionInput[] = [
    {
      id: "crawl.homepage_status",
      category: "crawlability",
      label: "Homepage returns a usable HTTP status",
      weight: 3,
      measured: hasHomepage,
      passed: Boolean(homepage && homepage.status >= 200 && homepage.status < 400),
      evidence: homepage ? [`homepage status: ${homepage.status}`] : [],
      explanation: "Measures whether the collected homepage was reachable without a hard HTTP error.",
    },
    {
      id: "crawl.robots",
      category: "crawlability",
      label: "robots.txt is observable",
      weight: 3,
      measured: evidence.robots.status !== null,
      passed: evidence.robots.present,
      evidence: evidence.robots.status === null ? [] : [`robots.txt status: ${evidence.robots.status}`],
      explanation: "Checks whether robots.txt could be observed and contained content.",
    },
    {
      id: "crawl.sitemap",
      category: "crawlability",
      label: "XML sitemap is observable",
      weight: 3,
      measured: evidence.sitemap.status !== null,
      passed: evidence.sitemap.present,
      evidence: evidence.sitemap.status === null ? [] : [`sitemap status: ${evidence.sitemap.status}`],
      explanation: "Checks whether the conventional sitemap.xml endpoint could be observed.",
    },
    {
      id: "crawl.canonical",
      category: "crawlability",
      label: "Homepage canonical is declared",
      weight: 3,
      measured: hasHomepage,
      passed: Boolean(homepage?.canonical),
      evidence: homepage?.canonical ? [`canonical: ${homepage.canonical}`] : [],
      explanation: "Checks for an explicit homepage canonical URL.",
    },
    {
      id: "crawl.final_url",
      category: "crawlability",
      label: "Final public URL resolved",
      weight: 3,
      measured: true,
      passed: Boolean(evidence.finalUrl),
      evidence: evidence.finalUrl ? [`final URL: ${evidence.finalUrl}`] : [],
      explanation: "Confirms that collection resolved to a final public HTTP(S) URL.",
    },

    {
      id: "technical.readable_html",
      category: "technical",
      label: "Core content is readable as HTML text",
      weight: 4,
      measured: hasHomepage,
      passed: hasUsableText,
      evidence: homepage ? [`readable text characters: ${homepage.readableText.length}`] : [],
      explanation: "Uses collected readable text as evidence that important content is not only graphical or inaccessible.",
    },
    {
      id: "technical.headings",
      category: "technical",
      label: "Page uses extractable headings",
      weight: 3,
      measured: hasHomepage,
      passed: allHeadings.length > 0,
      evidence: [`headings observed: ${allHeadings.length}`],
      explanation: "Checks whether semantic heading content was observable.",
    },
    {
      id: "technical.internal_links",
      category: "technical",
      label: "Internal navigation is observable",
      weight: 3,
      measured: hasHomepage,
      passed: allLinks.length > 0,
      evidence: [`internal links observed: ${allLinks.length}`],
      explanation: "Checks whether the site exposes same-origin links that machines can follow.",
    },
    {
      id: "technical.metadata",
      category: "technical",
      label: "Homepage metadata is present",
      weight: 2,
      measured: hasHomepage,
      passed: Boolean(homepage?.title && homepage?.description),
      evidence: [
        homepage?.title ? `title: ${homepage.title}` : "title missing",
        homepage?.description ? "meta description present" : "meta description missing",
      ],
      explanation: "Checks for both a title and meta description on the homepage.",
    },
    {
      id: "technical.page_collection",
      category: "technical",
      label: "Additional same-site pages were collectable",
      weight: 3,
      measured: hasHomepage && homepage!.internalLinks.length > 0,
      passed: evidence.pages.length > 0,
      evidence: [`additional pages collected: ${evidence.pages.length}`],
      explanation: "Uses bounded same-site collection as a resilience signal, not as a full crawl.",
    },

    {
      id: "schema.presence",
      category: "structured_data",
      label: "Structured data is present",
      weight: 3,
      measured: hasHomepage,
      passed: pages.some((page) => page!.structuredDataBlocks > 0),
      evidence: [`JSON-LD blocks observed: ${pages.reduce((n, page) => n + page!.structuredDataBlocks, 0)}`],
      explanation: "Checks only for observed JSON-LD presence. It does not assume correctness.",
    },
    {
      id: "schema.correct_types",
      category: "structured_data",
      label: "Structured-data entity types are correct",
      weight: 3,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because the collector records presence, not parsed schema types.",
    },
    {
      id: "schema.visible_consistency",
      category: "structured_data",
      label: "Structured data matches visible content",
      weight: 4,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because schema-to-visible-content validation is not yet collected.",
    },

    {
      id: "entity.identity",
      category: "entity_clarity",
      label: "Organization identity is explicit",
      weight: 3,
      measured: hasHomepage,
      passed: Boolean(homepage?.title && homepage.headings.length > 0),
      evidence: [
        homepage?.title ? `title: ${homepage.title}` : "title missing",
        homepage?.headings[0] ? `first heading: ${homepage.headings[0]}` : "heading missing",
      ],
      explanation: "Uses explicit title and heading signals as a conservative identity proxy.",
    },
    {
      id: "entity.services",
      category: "entity_clarity",
      label: "Services or products are explicit",
      weight: 3,
      measured: hasUsableText,
      passed: /(services?|products?|solutions?|what we do|what we offer)/i.test(allText),
      evidence: [hasUsableText ? "homepage readable text assessed" : "insufficient readable text"],
      explanation: "Looks for explicit service/product language in collected visible text.",
    },
    {
      id: "entity.people",
      category: "entity_clarity",
      label: "People or authority signals are explicit",
      weight: 3,
      measured: hasUsableText,
      passed: /(founder|team|leadership|director|author|about us|our team)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for people/authority terms" : "insufficient readable text"],
      explanation: "Checks for explicit people or authority language in visible text.",
    },
    {
      id: "entity.geography",
      category: "entity_clarity",
      label: "Geographic market is clear",
      weight: 3,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because reliable geographic interpretation is not yet collected.",
    },
    {
      id: "entity.consistency",
      category: "entity_clarity",
      label: "Entity facts are consistent across pages",
      weight: 3,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because cross-page entity normalization is not yet implemented.",
    },

    {
      id: "answers.direct",
      category: "answerability",
      label: "Priority questions are answered directly",
      weight: 12,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable until target questions are supplied. The engine will not invent them.",
    },
    {
      id: "answers.extractable_facts",
      category: "answerability",
      label: "Important facts are easy to extract",
      weight: 5,
      measured: hasHomepage,
      passed: Boolean(homepage && homepage.readableText.length >= 500),
      evidence: homepage ? [`homepage readable text characters: ${homepage.readableText.length}`] : [],
      explanation: "Uses readable-text availability as a conservative extractability signal.",
    },
    {
      id: "answers.structure",
      category: "answerability",
      label: "Page structure supports concise answers",
      weight: 4,
      measured: hasHomepage,
      passed: allHeadings.length >= 2,
      evidence: [`headings observed: ${allHeadings.length}`],
      explanation: "Uses visible heading structure as an observable answer-organization signal.",
    },
    {
      id: "answers.topical_links",
      category: "answerability",
      label: "Internal topical relationships are visible",
      weight: 4,
      measured: hasHomepage,
      passed: allLinks.length >= 3,
      evidence: [`internal links observed: ${allLinks.length}`],
      explanation: "Uses same-site links as evidence of navigable topical relationships.",
    },

    {
      id: "trust.credibility",
      category: "trust",
      label: "Company or author credibility is visible",
      weight: 3,
      measured: hasUsableText,
      passed: /(about|team|founder|experience|expert|specialist|certif|member|accredit)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for credibility signals" : "insufficient readable text"],
      explanation: "Checks only for explicit credibility-oriented language in visible text.",
    },
    {
      id: "trust.contact",
      category: "trust",
      label: "Contact or company information is visible",
      weight: 2,
      measured: hasUsableText,
      passed: /(contact|email|phone|address|@)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for contact signals" : "insufficient readable text"],
      explanation: "Checks for explicit contact/company information in visible text.",
    },
    {
      id: "trust.examples",
      category: "trust",
      label: "Case studies, results or examples are visible",
      weight: 3,
      measured: hasUsableText,
      passed: /(case stud|results?|examples?|portfolio|clients?|customers?)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for case-study/example signals" : "insufficient readable text"],
      explanation: "Checks for explicit example or result language without judging truthfulness.",
    },
    {
      id: "trust.sources",
      category: "trust",
      label: "Sources or supporting evidence are visible",
      weight: 3,
      measured: hasUsableText,
      passed: /(sources?|references?|research|evidence|methodology|data)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for source/evidence signals" : "insufficient readable text"],
      explanation: "Checks for explicit source/evidence language in visible text.",
    },
    {
      id: "trust.claim_support",
      category: "trust",
      label: "Claims are specific and supportable",
      weight: 4,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because claim verification requires human or richer evidence review.",
    },

    {
      id: "content.original_expertise",
      category: "content_differentiation",
      label: "Original expertise is demonstrated",
      weight: 2,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because originality cannot be defensibly inferred from this evidence alone.",
    },
    {
      id: "content.specific_examples",
      category: "content_differentiation",
      label: "Specific examples or processes are present",
      weight: 2,
      measured: hasUsableText,
      passed: /(process|method|how we|case stud|example|step 1|step one)/i.test(allText),
      evidence: [hasUsableText ? "visible text assessed for process/example signals" : "insufficient readable text"],
      explanation: "Checks for explicit process or example language in visible text.",
    },
    {
      id: "content.low_generic",
      category: "content_differentiation",
      label: "Content is demonstrably non-generic",
      weight: 1,
      measured: false,
      passed: false,
      evidence: [],
      explanation: "Unavailable in v1 because genericity requires comparative or semantic judgment.",
    },
  ];

  const results: CriterionResult[] = criteria.map((criterion) => ({
    id: criterion.id,
    category: criterion.category,
    label: criterion.label,
    weight: criterion.weight,
    earned: criterion.measured && criterion.passed ? criterion.weight : 0,
    status: criterion.measured ? (criterion.passed ? "pass" : "fail") : "unavailable",
    evidence: criterion.evidence,
    explanation: criterion.explanation,
  }));

  const assessedPoints = results
    .filter((criterion) => criterion.status !== "unavailable")
    .reduce((sum, criterion) => sum + criterion.weight, 0);

  const earnedPoints = results.reduce((sum, criterion) => sum + criterion.earned, 0);
  const coverage = Math.round(assessedPoints);
  const score = assessedPoints >= 60 ? Math.round((earnedPoints / assessedPoints) * 100) : null;

  const dimensions = buildPublicDimensions(results);

  return {
    scoringVersion: SCORING_VERSION,
    label: "Article6 GEO Diagnostic Score",
    score,
    earnedPoints,
    assessedPoints,
    coverage,
    state: score === null ? "insufficient_evidence" : "scored",
    criteria: results,
    dimensions,
  };
}

const DIMENSION_MAP: Record<PublicDimension, CriterionResult["category"][]> = {
  Access: ["crawlability", "technical"],
  Understanding: ["structured_data", "entity_clarity"],
  Answers: ["answerability"],
  Trust: ["trust"],
  Authority: ["content_differentiation"],
};

function buildPublicDimensions(criteria: CriterionResult[]): PublicDimensionScore[] {
  return (Object.keys(DIMENSION_MAP) as PublicDimension[]).map((name) => {
    const relevant = criteria.filter((criterion) => DIMENSION_MAP[name].includes(criterion.category));
    const assessed = relevant.filter((criterion) => criterion.status !== "unavailable");
    const assessedWeight = assessed.reduce((sum, criterion) => sum + criterion.weight, 0);
    const totalWeight = relevant.reduce((sum, criterion) => sum + criterion.weight, 0);
    const earned = assessed.reduce((sum, criterion) => sum + criterion.earned, 0);

    return {
      name,
      score: assessedWeight > 0 ? Math.round((earned / assessedWeight) * 100) : null,
      coverage: totalWeight > 0 ? Math.round((assessedWeight / totalWeight) * 100) : 0,
      evidence: assessed.flatMap((criterion) => criterion.evidence).slice(0, 6),
    };
  });
}
