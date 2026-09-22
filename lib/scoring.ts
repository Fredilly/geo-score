import type { WebsiteEvidence } from "./evidence.ts";

export const SCORING_VERSION = "geo-v1.1.0";
export const MIN_SCORE_COVERAGE = 75;

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

export type PublicFinding = {
  id: string;
  title: string;
  explanation: string;
  evidence: string[];
};

export type PublicCheck = {
  label: string;
  status: "pass" | "fail" | "unavailable";
  detail: string;
};

export type PublicCheckGroup = {
  name: "AI access" | "Site discovery" | "Machine understanding" | "Business clarity" | "Answerability" | "Trust & proof";
  question: string;
  status: "good" | "needs_attention" | "unknown";
  checks: PublicCheck[];
};

export type GeoScoreResult = {
  scoringVersion: string;
  label: "Article6 GEO Diagnostic Score";
  score: number | null;
  earnedPoints: number;
  assessedPoints: number;
  coverage: number;
  state: "scored" | "insufficient_evidence" | "not_applicable";
  criteria: CriterionResult[];
  dimensions: PublicDimensionScore[];
  findings: PublicFinding[];
  opportunityCount: number;
  businessApplicable: boolean;
  checkGroups: PublicCheckGroup[];
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
  const businessSignals = [
    /(services?|solutions?|products?|platform)/i.test(allText),
    /(contact|sales|pricing|quote|book a demo|request a demo)/i.test(allText),
    /(about us|our team|founder|leadership|company)/i.test(allText),
    /(clients?|customers?|case stud|portfolio)/i.test(allText),
  ].filter(Boolean).length;
  const businessApplicable = businessSignals >= 2;

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
  const score =
    businessApplicable && assessedPoints >= MIN_SCORE_COVERAGE
      ? Math.round((earnedPoints / assessedPoints) * 100)
      : null;

  const dimensions = buildPublicDimensions(results);
  const failed = results
    .filter((criterion) => criterion.status === "fail")
    .sort((a, b) => b.weight - a.weight);
  const findings = failed.slice(0, 3).map(toPublicFinding);
  const checkGroups = buildCheckGroups(results, evidence);

  return {
    scoringVersion: SCORING_VERSION,
    label: "Article6 GEO Diagnostic Score",
    score,
    earnedPoints,
    assessedPoints,
    coverage,
    state:
      !businessApplicable && hasUsableText
        ? "not_applicable"
        : assessedPoints < MIN_SCORE_COVERAGE
          ? "insufficient_evidence"
          : score === null
            ? "insufficient_evidence"
            : "scored",
    criteria: results,
    dimensions,
    findings,
    opportunityCount: Math.max(0, failed.length - findings.length),
    businessApplicable,
    checkGroups,
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


function toPublicFinding(criterion: CriterionResult): PublicFinding {
  const copy: Record<string, { title: string; explanation: string }> = {
    "crawl.robots": {
      title: "Crawler instructions are unclear",
      explanation: "We could not confirm a usable robots.txt signal.",
    },
    "crawl.sitemap": {
      title: "Your sitemap is missing or unclear",
      explanation: "Search and AI systems have less help discovering your important pages.",
    },
    "crawl.canonical": {
      title: "The homepage canonical is missing",
      explanation: "Machines have less guidance about the preferred version of your homepage.",
    },
    "technical.readable_html": {
      title: "Important content is hard to extract",
      explanation: "Too little readable page text was available for a strong machine-readable signal.",
    },
    "technical.headings": {
      title: "Page structure is weak",
      explanation: "Clear headings help machines understand what each section is about.",
    },
    "technical.internal_links": {
      title: "Internal navigation is hard to follow",
      explanation: "Machines have fewer visible paths to discover related pages.",
    },
    "technical.metadata": {
      title: "Homepage metadata is incomplete",
      explanation: "The page title or description is missing, weakening basic context.",
    },
    "schema.presence": {
      title: "Structured data is missing",
      explanation: "We found no JSON-LD to help machines interpret the site.",
    },
    "entity.identity": {
      title: "Your business identity is not explicit enough",
      explanation: "The homepage does not clearly connect the site title and primary heading.",
    },
    "entity.services": {
      title: "What you sell is not explicit",
      explanation: "Services or products are not clearly stated in the readable page content.",
    },
    "entity.people": {
      title: "Authority signals are weak",
      explanation: "The site does not clearly surface the people or expertise behind the business.",
    },
    "answers.extractable_facts": {
      title: "Key facts are too thin",
      explanation: "There is not enough readable content for machines to extract important facts confidently.",
    },
    "answers.structure": {
      title: "Answers are not well structured",
      explanation: "Important information is not organized with enough clear headings.",
    },
    "answers.topical_links": {
      title: "Related topics are weakly connected",
      explanation: "Internal links do not clearly connect enough relevant pages.",
    },
    "trust.credibility": {
      title: "Credibility is difficult to verify",
      explanation: "The visible content does not clearly surface expertise, team, or credentials.",
    },
    "trust.contact": {
      title: "Contact information is hard to find",
      explanation: "Machines and customers need a clear way to verify and reach the business.",
    },
    "trust.examples": {
      title: "Proof is thin",
      explanation: "Case studies, examples, clients, or results are not clearly visible.",
    },
    "trust.sources": {
      title: "Claims lack visible support",
      explanation: "Sources, research, methodology, or evidence are not clearly surfaced.",
    },
    "content.specific_examples": {
      title: "The content feels too generic",
      explanation: "Specific processes, examples, or case-study language are not clearly visible.",
    },
  };

  const fallback = {
    title: criterion.label,
    explanation: criterion.explanation,
  };
  const selected = copy[criterion.id] ?? fallback;

  return {
    id: criterion.id,
    title: selected.title,
    explanation: selected.explanation,
    evidence: criterion.evidence.slice(0, 2),
  };
}


function buildCheckGroups(criteria: CriterionResult[], evidence: WebsiteEvidence): PublicCheckGroup[] {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  const plainEnglish: Record<string, Partial<Record<CriterionStatus, string>>> = {
    "crawl.homepage_status": {
      pass: "The homepage loads normally.",
      fail: "The homepage returned an error, so machines may not be able to read it.",
    },
    "crawl.robots": {
      pass: "Crawler instructions are available.",
      fail: "No usable robots.txt was found, so crawler instructions are unclear.",
      unavailable: "We could not verify crawler instructions.",
    },
    "crawl.sitemap": {
      pass: "A sitemap gives machines a clean map of important pages.",
      fail: "No sitemap was found, so machines have less help discovering important pages.",
      unavailable: "We could not verify a sitemap.",
    },
    "crawl.canonical": {
      pass: "Search engines can see which homepage URL is the primary version.",
      fail: "The homepage does not declare a primary URL.",
    },
    "technical.internal_links": {
      pass: "The site exposes internal links that machines can follow.",
      fail: "Too few internal links were visible for machines to follow.",
    },
    "technical.readable_html": {
      pass: "Important page content is available as readable text.",
      fail: "Too little important content was available as readable text.",
    },
    "technical.metadata": {
      pass: "The homepage has a title and description that explain the page.",
      fail: "The homepage title or description is missing.",
    },
    "technical.headings": {
      pass: "Headings give the page a clear machine-readable structure.",
      fail: "The page has too little heading structure.",
    },
    "schema.presence": {
      pass: "Structured data is present to help machines interpret the site.",
      fail: "No structured data was found.",
    },
    "entity.identity": {
      pass: "The business identity is explicit on the homepage.",
      fail: "The homepage does not make the business identity explicit enough.",
    },
    "entity.services": {
      pass: "The site clearly states its services or products.",
      fail: "The site does not clearly state its services or products.",
    },
    "entity.people": {
      pass: "People or authority signals are visible.",
      fail: "The people or expertise behind the business are not clearly surfaced.",
    },
    "answers.extractable_facts": {
      pass: "The page contains enough readable information for machines to extract key facts.",
      fail: "There is too little readable information for confident fact extraction.",
    },
    "answers.structure": {
      pass: "Information is organized into sections that support concise answers.",
      fail: "Important information is not organized clearly enough for concise answers.",
    },
    "answers.topical_links": {
      pass: "Related pages are connected with internal links.",
      fail: "Related topics are not connected strongly enough.",
    },
    "trust.credibility": {
      pass: "Credibility or expertise signals are visible.",
      fail: "Credibility or expertise is difficult to verify from the visible content.",
    },
    "trust.contact": {
      pass: "Contact or company information is easy to find.",
      fail: "Contact or company information is hard to verify.",
    },
    "trust.examples": {
      pass: "Examples, case studies, clients, or results are visible.",
      fail: "The site shows little visible proof through examples, case studies, clients, or results.",
    },
    "trust.sources": {
      pass: "Sources, research, methodology, or evidence are visible.",
      fail: "Claims have little visible supporting evidence.",
    },
  };

  const fromCriterion = (id: string, label: string): PublicCheck => {
    const criterion = byId.get(id);
    if (!criterion) return { label, status: "unavailable", detail: "Not checked." };
    const detail =
      plainEnglish[id]?.[criterion.status] ??
      (criterion.status === "unavailable" ? "This check was not available." : criterion.explanation);
    return { label, status: criterion.status, detail };
  };

  const groups: PublicCheckGroup[] = [
    {
      name: "AI access",
      question: "Can AI crawlers reach and read the site?",
      status: "unknown",
      checks: [
        fromCriterion("crawl.homepage_status", "Website reachable"),
        fromCriterion("crawl.robots", "robots.txt"),
        {
          label: "AI crawler rules",
          status:
            evidence.robots.aiAccess === "allowed"
              ? "pass"
              : evidence.robots.aiAccess === "blocked"
                ? "fail"
                : "unavailable",
          detail:
            evidence.robots.aiAccess === "blocked"
              ? `Blocked: ${evidence.robots.blockedBots.join(", ")}`
              : evidence.robots.aiAccess === "allowed"
                ? "No blanket AI crawler block found."
                : "Could not verify AI crawler rules.",
        },
      ],
    },
    {
      name: "Site discovery",
      question: "Can machines find the important pages?",
      status: "unknown",
      checks: [
        fromCriterion("crawl.sitemap", "Sitemap"),
        fromCriterion("crawl.canonical", "Canonical URL"),
        fromCriterion("technical.internal_links", "Internal links"),
        {
          label: "llms.txt (optional)",
          status: evidence.llms.present ? "pass" : "unavailable",
          detail: evidence.llms.present ? "Present. Optional and not part of the score." : "Not found. Optional and not part of the score.",
        },
      ],
    },
    {
      name: "Machine understanding",
      question: "Can a machine understand what each page is about?",
      status: "unknown",
      checks: [
        fromCriterion("technical.readable_html", "Readable HTML"),
        fromCriterion("technical.metadata", "Title & description"),
        fromCriterion("technical.headings", "Headings"),
        fromCriterion("schema.presence", "Structured data"),
      ],
    },
    {
      name: "Business clarity",
      question: "Is it obvious who you are and what you do?",
      status: "unknown",
      checks: [
        fromCriterion("entity.identity", "Business identity"),
        fromCriterion("entity.services", "Services or products"),
        fromCriterion("entity.people", "People / authority"),
      ],
    },
    {
      name: "Answerability",
      question: "Can AI pull a clean answer from the site?",
      status: "unknown",
      checks: [
        fromCriterion("answers.extractable_facts", "Extractable facts"),
        fromCriterion("answers.structure", "Answer structure"),
        fromCriterion("answers.topical_links", "Related topics"),
      ],
    },
    {
      name: "Trust & proof",
      question: "Can AI verify the important claims?",
      status: "unknown",
      checks: [
        fromCriterion("trust.credibility", "Credibility"),
        fromCriterion("trust.contact", "Contact details"),
        fromCriterion("trust.examples", "Examples / case studies"),
        fromCriterion("trust.sources", "Sources / evidence"),
      ],
    },
  ];

  return groups.map((group) => {
    const measured = group.checks.filter((check) => check.status !== "unavailable");
    const failed = measured.filter((check) => check.status === "fail");
    return {
      ...group,
      status: measured.length === 0 ? "unknown" : failed.length ? "needs_attention" : "good",
    };
  });
}
