"use client";

import { useEffect, useMemo, useState } from "react";
import LeadForm from "@/components/LeadForm";

type AnalysisResponse = {
  evidence?: {
    state?: "complete" | "partial";
    warnings?: string[];
  };
  score?: {
    state?: "scored" | "insufficient_evidence";
    score?: number | null;
    scoringVersion?: string;
    dimensions?: Array<{ name: string; score: number | null; coverage: number }>;
    findings?: Array<{ id: string; title: string; explanation: string; evidence: string[] }>;
    opportunityCount?: number;
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
            <div className="scan-result">
              <span>Article6 GEO Diagnostic Score</span>
              <strong>{score === null ? "Not issued" : `${score}/100`}</strong>
            </div>

            <div className="dimension-grid" aria-label="Score dimensions">
              {dimensions?.map((dimension) => (
                <div key={dimension.name} className="dimension-card">
                  <span>{dimension.name}</span>
                  <strong>{dimension.score === null ? "—" : dimension.score}</strong>
                  <small>{dimension.coverage}% measured</small>
                </div>
              ))}
            </div>

            {findings && findings.length > 0 && (
              <section className="findings">
                <div className="findings-heading">
                  <div>
                    <p className="eyebrow">Top findings</p>
                    <h2>What is holding the site back</h2>
                  </div>
                  {opportunityCount > 0 && <span>{opportunityCount} more opportunities</span>}
                </div>

                <div className="finding-list">
                  {findings.map((finding, index) => (
                    <article key={finding.id} className="finding">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{finding.title}</h3>
                        <p>{finding.explanation}</p>
                        {finding.evidence[0] && <small>{finding.evidence[0]}</small>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {showLeadForm ? (
              <LeadForm websiteUrl={website} onCancel={() => setShowLeadForm(false)} />
            ) : (
              <button
                type="button"
                className="primary-result-cta"
                onClick={() => setShowLeadForm(true)}
              >
                Improve my score →
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
