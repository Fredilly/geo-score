# AGENTS.md

## Mission

Build GEO Score as a focused Article6 diagnostic product.

The core experience is:

**Enter URL → analyze → score → explain top issues → convert to GEO Website Upgrade lead.**

Read `PRODUCT.md` before making product, UX, copy, architecture, or visual decisions.

## Non-Negotiables

1. The analyzer is the homepage.
2. One dominant action at a time.
3. Do not turn this into a generic agency website.
4. Do not add features outside the MVP without a clear product reason.
5. Never fabricate a score, finding, business fact, credential, or external visibility claim.
6. Every score and finding must be backed by observable evidence.
7. Unavailable evidence must be marked unavailable, not silently treated as zero.
8. The Article6 diagnostic score must never be presented as an official Google, Bing, OpenAI, ChatGPT, Perplexity, or third-party metric.
9. Do not promise rankings, AI citations, traffic, leads, or revenue.
10. Preserve the distinction between website readiness and external platform outcomes.

## Product Scope

MVP only:

- homepage analyzer
- analysis/loading state
- score/results state
- top findings
- lead capture/contact flow
- basic privacy/legal pages
- analytics
- clear error and partial-analysis states

Do not add by default:

- blog
- CMS
- authentication
- client portal
- dashboard-heavy UI
- resources hub
- unrelated Article6 services
- complex navigation

## UX Direction

Aim for premium technical minimalism.

Prefer:

- near-black / graphite base
- white / near-white typography
- electric blue primary accent
- restrained status colors
- large score presentation
- large URL input
- generous spacing
- subtle motion
- simple language
- progressive disclosure for technical detail

Avoid:

- purple AI gradients
- robot imagery
- stock AI artwork
- generic SaaS cards
- SEO agency aesthetics
- excessive glass effects
- decorative animation that harms speed
- dense technical reports in the primary flow

## Copy Rules

Write for business decision-makers first.

Prefer outcome language:

- Can AI understand your website?
- Your site is visible. It is not easy to understand.
- Important customer questions are buried.
- Your claims are difficult for machines to verify.
- We fix what the score finds.

Keep jargon behind expandable detail where necessary.

## Engineering Principles

- Keep dependencies minimal.
- Prefer simple, inspectable architecture.
- Treat user-supplied URLs as untrusted input.
- Validate URLs server-side.
- Prevent SSRF and private-network access before shipping live crawling.
- Use strict timeouts and bounded fetch sizes.
- Do not execute or trust client website JavaScript by default.
- Build deterministic scoring where possible.
- Separate evidence collection from scoring and presentation.
- Make partial failures explicit.
- Preserve raw evidence needed to explain each awarded or deducted score.
- Keep the homepage fast even if analysis work is slow.
- Use accessible semantic HTML.
- Mobile is first-class.

## Scoring

The public UI uses simplified dimensions:

- Access
- Understanding
- Answers
- Trust
- Authority

The internal scoring foundation remains the Article6 GEO rubric described in `PRODUCT.md`.

Do not change scoring weights casually. Any scoring change must be explicit, documented, and compatible with defensible before/after comparisons.

## Free vs Paid Boundary

The free result should expose enough to create conviction, not enough to replace the paid implementation service.

Default free output:

- overall score
- category scores
- top 3 issues
- short explanation
- number of additional opportunities
- one clear CTA

Do not expose a complete remediation plan by default.

## Quality Bar

Before considering a change complete:

- primary flow works on mobile and desktop
- malformed URLs are handled
- unreachable and blocked sites are handled
- partial analysis is represented honestly
- no fake or placeholder scores can reach production
- score explanations map to evidence
- primary CTA works
- no unnecessary feature or dependency was introduced

## Working Style

Keep changes small and reviewable.

For meaningful work:

1. state the intended outcome
2. implement the smallest coherent change
3. test the affected flow
4. document important product or scoring decisions
5. avoid unrelated refactors

When uncertain, choose the simpler implementation that preserves evidence quality and the product focus.
