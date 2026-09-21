export default function HomePage() {
  return (
    <main className="shell">
      <div className="signal-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="/" aria-label="Article6 Signal home">
          <span className="brand-mark" aria-hidden="true" />
          <span>Article6 Signal</span>
        </a>
        <span className="status">Website intelligence</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow">
          <span className="live-dot" aria-hidden="true" />
          AI visibility diagnostic
        </div>

        <h1 id="hero-title">Can AI understand your website?</h1>

        <p className="lede">
          Enter your website. We&apos;ll measure how clearly search and AI systems
          can access, understand, and trust it.
        </p>

        <form className="analyzer" action="#" aria-label="Website analysis">
          <label className="sr-only" htmlFor="website">
            Website URL
          </label>
          <div className="input-frame">
            <span className="protocol" aria-hidden="true">↗</span>
            <input
              id="website"
              name="website"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourwebsite.com"
              aria-describedby="analyzer-note"
            />
            <button type="submit" disabled aria-describedby="analyzer-note">
              <span className="button-mobile">Analyze</span>
              <span className="button-desktop">Run analysis</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <p id="analyzer-note" className="note">
            Live analysis arrives in the next build. No demo score will be shown.
          </p>
        </form>

        <div className="metrics" aria-label="What Signal measures">
          <div><span>01</span><strong>Access</strong></div>
          <div><span>02</span><strong>Understanding</strong></div>
          <div><span>03</span><strong>Answers</strong></div>
          <div><span>04</span><strong>Trust</strong></div>
          <div><span>05</span><strong>Authority</strong></div>
        </div>
      </section>

      <footer>
        <span>Article6</span>
        <span>Evidence, not guesswork.</span>
      </footer>
    </main>
  );
}
