"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeWebsiteUrl } from "@/lib/website-url";

export default function AnalyzerForm() {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = normalizeWebsiteUrl(website);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSubmitting(true);
    router.push(`/analyze?url=${encodeURIComponent(result.url)}`);
  }

  return (
    <form className="analyzer" onSubmit={handleSubmit} noValidate aria-label="Website analysis">
      <label className="sr-only" htmlFor="website">
        Website URL
      </label>

      <div className={`input-frame${error ? " input-frame-error" : ""}`}>
        <span className="protocol" aria-hidden="true">↗</span>
        <input
          id="website"
          name="website"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="url"
          spellCheck={false}
          placeholder="yourwebsite.com"
          value={website}
          onChange={(event) => {
            setWebsite(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "analyzer-error" : "analyzer-note"}
          disabled={submitting}
        />

        <button type="submit" disabled={submitting || !website.trim()}>
          <span className="button-mobile">{submitting ? "Opening…" : "Analyze"}</span>
          <span className="button-desktop">{submitting ? "Opening…" : "Run analysis"}</span>
          {!submitting && <span aria-hidden="true">→</span>}
        </button>
      </div>

      {error ? (
        <p id="analyzer-error" className="note note-error" role="alert">
          {error}
        </p>
      ) : (
        <p id="analyzer-note" className="note">
          We only analyze public website URLs. No fake or estimated score.
        </p>
      )}
    </form>
  );
}
