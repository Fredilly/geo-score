"use client";

import { useEffect, useMemo, useState } from "react";
import LeadForm from "@/components/LeadForm";

type AnalysisResponse = {
  evidence?: {
    state?: "complete" | "partial";
    warnings?: string[];
  };
  score?: {
    state?: "scored" | "insufficient_evidence" | "not_applicable";
    score?: number | null;
    scoringVersion?: string;
    dimensions?: Array<{ name: string; score: number | null; coverage: number }>;
    findings?: Array<{ id: string; title: string; explanation: string; evidence: string[] }>;
    opportunityCount?: number;
    businessApplicable?: boolean;
    checkGroups?: Array<{
      name: string;
      question: string;
      status: "good" | "needs_attention" | "unknown";
      checks: Array<{
        label: string;
        status: "pass" | "fail" | "unavailable";
        detail: string;
      }>;
    }>;
  };
  error?: string;
  state?: "unavailable";
};

const STAGES = [
  "Reading site",
  "Checking access",
  "Understanding the business",
  "Testing answerability",
  "Measuring trust",
  "Calculating score",
] as const;

type ScanState = "loading" | "complete" | "partial" | "error";

export default function AnalysisScan({ website, hostname }: { website: string; hostname: string }) {
  const [state, setState] = useState<ScanState>("loading");
  const [message, setMessage] = useState("Collecting public website evidence.");
  const [score, setScore] = useState<number | null>(null);
  const [dimensions, setDimensions] =
    useState<NonNullable<AnalysisResponse["score"]>["dimensions"]>([]);
  const [findings, setFindings] =
    useState<NonNullable<AnalysisResponse["score"]>["findings"]>([]);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [businessApplicable, setBusinessApplicable] = useState(true);
  const [checkGroups, setCheckGroups] =
    useState<NonNullable<AnalysisResponse["score"]>["checkGroups"]>([]);
  const [showLeadForm, setShowLeadForm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        const response = await fetch(`/api/score?url=${encodeURIComponent(website)}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const payload = (await response.json()) as AnalysisResponse;

        if (!response.ok) {
          setState("error");
          setMessage(payload.error || "We could not analyze this website.");
          return;
        }

        setScore(payload.score?.score ?? null);
        setDimensions(payload.score?.dimensions ?? []);
        setFindings(payload.score?.findings ?? []);
        setOpportunityCount(payload.score?.opportunityCount ?? 0);
        setBusinessApplicable(payload.score?.businessApplicable ?? true);
        setCheckGroups(payload.score?.checkGroups ?? []);

        if (payload.score?.state === "not_applicable") {
          setState("complete");
          setMessage("Technical GEO checks complete. A business GEO score was not issued for this type of site.");
          return;
        }

        if (payload.evidence?.state === "partial" || payload.score?.state === "insufficient_evidence") {
          setState("partial");
          setMessage(
            payload.score?.state === "insufficient_evidence"
              ? "Analysis finished, but there is not enough evidence for a defensible overall score."
              : "Analysis finished with some unavailable checks.",
          );
          return;
        }

        setState("complete");
        setMessage("Analysis complete.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
        setMessage("The analysis request failed. Try again.");
      }
    }

    run();
    return () => controller.abort();
  }, [website]);

  const completed = state === "complete" || state === "partial";
  const activeIndex = state === "loading" ? 0 : completed ? STAGES.length : -1;

  const statusText = useMemo(() => {
    if (state === "loading") return "Analyzing";
    if (state === "complete") return "Complete";
    if (state === "partial") return "Partial analysis";
    return "Analysis unavailable";
  }, [state]);

  return (
    <main className="scan-page">
      <div className="scan-glow" aria-hidden="true" />
      <section className="scan-card" aria-live="polite">
        <div className="scan-header">
          <div>
            <p className="eyebrow">{statusText}</p>
            <h1>{hostname}</h1>
          </div>
          <div className={`scan-orb scan-orb-${state}`} aria-hidden="true" />
        </div>

        <p className="scan-message">{message}</p>

        {state === "loading" && (
          <div className="scan-progress" role="progressbar" aria-label="Website analysis in progress">
            <div className="scan-progress-track">
              <div className="scan-progress-bar" />
            </div>
            <span>Scanning live website signals</span>
          </div>
        )}

        <ol className="scan-stages" aria-label="Analysis progress">
          {STAGES.map((stage, index) => {
            const stageState =
              state === "error"
                ? index === 0
                  ? "error"
                  : "pending"
                : completed
                  ? "done"
                  : index === activeIndex
                    ? "active"
                    : "pending";

            return (
              <li key={stage} className={`scan-stage scan-stage-${stageState}`}>
                <span className="scan-stage-icon" aria-hidden="true">
                  {stageState === "done" ? "✓" : stageState === "error" ? "!" : index + 1}
                </span>
                <span>{stage}</span>
                <small>
                  {stageState === "done"
                    ? "Complete"
                    : stageState === "active"
                      ? "In progress"
                      : stageState === "error"
                        ? "Stopped"
                        : "Waiting"}
                </small>
              </li>
            );
          })}
        </ol>

        {completed && (
          <div className="results-panel">
            {businessApplicable && (
              <div className="scan-result">
                <span>Article6 GEO Diagnostic Score</span>
                <strong>{score === null ? "Not issued" : `${score}/100`}</strong>
              </div>
            )}

            {!businessApplicable && (
              <div className="score-note">
                <strong>No business score issued</strong>
                <span>This looks more like a utility or platform than a normal business website.</span>
              </div>
            )}

            <section className="geo-checks" aria-label="GEO checks">
              {checkGroups?.map((group) => (
                <details key={group.name} className="geo-check" open={group.status === "needs_attention"}>
                  <summary>
                    <div>
                      <strong>{group.name}</strong>
                      <span>{group.question}</span>
                    </div>
                    <b className={`geo-status geo-status-${group.status}`}>
                      {group.status === "good" ? "Good" : group.status === "needs_attention" ? "Needs attention" : "Unknown"}
                    </b>
                  </summary>

                  <div className="geo-check-list">
                    {group.checks.map((check) => (
                      <div key={check.label} className="geo-check-row">
                        <span className={`check-dot check-dot-${check.status}`} aria-hidden="true">
                          {check.status === "pass" ? "✓" : check.status === "fail" ? "!" : "?"}
                        </span>
                        <div>
                          <strong>{check.label}</strong>
                          <small>{check.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </section>

            {businessApplicable && findings && findings.length > 0 && (
              <section className="findings">
                <div className="findings-heading">
                  <div>
                    <p className="eyebrow">Top findings</p>
                    <h2>What is holding the site back</h2>
                  </div>
                  {opportunityCount > 0 && <span>{opportunityCount} more</span>}
                </div>

                <div className="finding-list">
                  {findings.map((finding, index) => (
                    <article key={finding.id} className="finding">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{finding.title}</h3>
                        <p>{finding.explanation}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(
              showLeadForm ? (
                <LeadForm websiteUrl={website} onCancel={() => setShowLeadForm(false)} />
              ) : (
                <button
                  type="button"
                  className="primary-result-cta"
                  onClick={() => setShowLeadForm(true)}
                >
                  {score === null ? "Ask Article6 to review this site →" : "Have Article6 fix this →"}
                </button>
              )
            )}
          </div>
        )}

        {state === "error" && (
          <div className="results-panel">
            <p className="score-note">We could not complete the automated checks. Article6 can review this site manually.</p>
            {showLeadForm ? (
              <LeadForm websiteUrl={website} onCancel={() => setShowLeadForm(false)} />
            ) : (
              <button
                type="button"
                className="primary-result-cta"
                onClick={() => setShowLeadForm(true)}
              >
                Ask Article6 to review this site →
              </button>
            )}
          </div>
        )}

        {state !== "loading" && (
          <a className="secondary-button" href="/">
            Analyze another website
          </a>
        )}
      </section>
    </main>
  );
}
