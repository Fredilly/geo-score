# GEO Score

A premium Article6 website diagnostic product.

## Product

Enter a website URL → analyze it → return a defensible score → explain the highest-value problems → convert qualified visitors into the Article6 GEO Website Upgrade.

The analyzer is the homepage.

Public product: **Article6 Signal**  
Production URL: **https://signal.article6.org**

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run build
```

## Cloudflare

Deploy as a **Cloudflare Workers** application, not a static Pages export.

Cloudflare's current recommended path for new Next.js applications is its automatic Next.js configuration using vinext. When importing this repository into Workers Builds, keep the Worker/application name as `geo-score` and attach `signal.article6.org` as the production custom domain.

Do not convert the project to a static export: later issues require server-side website analysis and secure CRM submission.

## Docs

- `PRODUCT.md` — product brief, UX, positioning, scoring presentation, and guardrails
- `AGENTS.md` — instructions for coding agents working in this repository

## Core rule

Never return a fake score. Every score and finding must be backed by observable evidence.

## Status

Foundation implementation in progress.
