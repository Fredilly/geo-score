"use client";

import { FormEvent, useState } from "react";

const GOALS = [
  "Improve AI visibility",
  "Improve search discoverability",
  "Understand website weaknesses",
  "Website upgrade",
] as const;

export default function LeadForm({
  websiteUrl,
  onCancel,
}: {
  websiteUrl: string;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    websiteUrl,
    mainGoal: GOALS[0],
    notes: "",
  });
  const [state, setState] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState("");

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("submitting");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setState("idle");
        setError(payload.error || "We could not submit your request. Please try again.");
        return;
      }

      setState("success");
    } catch {
      setState("idle");
      setError("We could not submit your request. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <section className="lead-form lead-success" aria-live="polite">
        <p className="eyebrow">Request received</p>
        <h2>We’ll take it from here.</h2>
        <p>
          Article6 has your website and request. We’ll review the available evidence and follow up with you.
        </p>
      </section>
    );
  }

  return (
    <section className="lead-form" aria-labelledby="lead-form-title">
      <div className="lead-form-heading">
        <div>
          <p className="eyebrow">Done-for-you GEO</p>
          <h2 id="lead-form-title">Have Article6 improve it.</h2>
        </div>
        <button type="button" className="lead-close" onClick={onCancel} aria-label="Close form">
          ×
        </button>
      </div>

      <p className="lead-form-copy">
        Send us the diagnostic. We’ll review the site and contact you about the work.
      </p>

      <form onSubmit={submit}>
        <div className="lead-field-grid">
          <label>
            <span>Name</span>
            <input
              required
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </label>

          <label>
            <span>Email</span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </label>

          <label>
            <span>Company</span>
            <input
              required
              name="company"
              autoComplete="organization"
              value={form.company}
              onChange={(event) => setField("company", event.target.value)}
            />
          </label>

          <label>
            <span>Website</span>
            <input
              required
              name="websiteUrl"
              inputMode="url"
              value={form.websiteUrl}
              onChange={(event) => setField("websiteUrl", event.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Main goal</span>
          <select
            name="mainGoal"
            value={form.mainGoal}
            onChange={(event) => setField("mainGoal", event.target.value)}
          >
            {GOALS.map((goal) => <option key={goal}>{goal}</option>)}
          </select>
        </label>

        <label>
          <span>Anything we should know? <small>Optional</small></span>
          <textarea
            name="notes"
            rows={4}
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
          />
        </label>

        {error && <p className="lead-error" role="alert">{error}</p>}

        <button className="primary-result-cta" type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "Sending…" : "Ask Article6 to improve it →"}
        </button>
      </form>
    </section>
  );
}
