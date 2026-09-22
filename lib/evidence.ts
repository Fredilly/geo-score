import {
  assertPublicDns,
  normalizeAndValidatePublicUrl,
} from "./network-safety.ts";

const USER_AGENT = "Article6-Signal/1.0 (+https://signal.article6.org)";
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}
const HOME_MAX_BYTES = 512_000;
const AUX_MAX_BYTES = 128_000;
const PAGE_MAX_BYTES = 256_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_EXTRA_PAGES = 3;
const MAX_TEXT_CHARS = 20_000;

export type PageEvidence = {
  url: string;
  status: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  headings: string[];
  internalLinks: string[];
  readableText: string;
  structuredDataBlocks: number;
};

export type WebsiteEvidence = {
  requestedUrl: string;
  finalUrl: string | null;
  state: "complete" | "partial";
  warnings: string[];
  homepage: PageEvidence | null;
  pages: PageEvidence[];
  robots: { url: string; status: number | null; present: boolean };
  sitemap: { url: string; status: number | null; present: boolean };
};

type SafeFetchResult = {
  response: Response;
  finalUrl: URL;
  body: string;
};

export async function collectWebsiteEvidence(input: string): Promise<WebsiteEvidence> {
  const initial = normalizeAndValidatePublicUrl(input);
  if (!initial.ok) throw new Error(initial.error);

  const warnings: string[] = [];
  let homepage: PageEvidence | null = null;
  let finalUrl: URL | null = null;

  try {
    const home = await safeFetchText(initial.url, HOME_MAX_BYTES);
    finalUrl = home.finalUrl;
    homepage = parsePageEvidence(home.finalUrl, home.response.status, home.body);
  } catch (error) {
    throw new Error(toPublicCollectionError(error));
  }

  const origin = finalUrl.origin;
  const robotsUrl = new URL("/robots.txt", origin);
  const sitemapUrl = new URL("/sitemap.xml", origin);

  const [robots, sitemap] = await Promise.all([
    collectAuxiliary(robotsUrl, warnings, "robots"),
    collectAuxiliary(sitemapUrl, warnings, "sitemap"),
  ]);

  const candidateLinks = homepage.internalLinks
    .map((href) => new URL(href, finalUrl!))
    .filter((url) => url.origin === origin)
    .filter((url) => url.pathname !== finalUrl!.pathname)
    .slice(0, MAX_EXTRA_PAGES);

  const pages: PageEvidence[] = [];
  for (const url of candidateLinks) {
    try {
      const result = await safeFetchText(url, PAGE_MAX_BYTES);
      if (result.finalUrl.origin !== origin) {
        warnings.push(`Skipped redirected off-site page: ${url.pathname}`);
        continue;
      }
      pages.push(parsePageEvidence(result.finalUrl, result.response.status, result.body));
    } catch {
      warnings.push(`Could not collect page: ${url.pathname}`);
    }
  }

  return {
    requestedUrl: initial.url.toString(),
    finalUrl: finalUrl.toString(),
    state: warnings.length ? "partial" : "complete",
    warnings,
    homepage,
    pages,
    robots,
    sitemap,
  };
}


const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot"];

export function blockedAiBotsFromRobots(content: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);

  const groups: Array<{ agents: string[]; rules: Array<{ kind: "allow" | "disallow"; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ kind: "allow" | "disallow"; path: string }> } | null = null;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ kind: key, path: value });
    }
  }

  function blocked(bot: string): boolean {
    const lower = bot.toLowerCase();
    const matching = groups.filter((group) => group.agents.includes(lower));
    const candidates = matching.length ? matching : groups.filter((group) => group.agents.includes("*"));
    for (const group of candidates) {
      for (const rule of group.rules) {
        if (rule.kind === "disallow" && rule.path === "/") return true;
        if (rule.kind === "allow" && rule.path === "/") return false;
      }
    }
    return false;
  }

  return AI_BOTS.filter(blocked);
}

async function collectRobots(url: URL, warnings: string[]) {
  try {
    const result = await safeFetchText(url, AUX_MAX_BYTES);
    const present = result.response.ok && result.body.trim().length > 0;
    const blockedBots = present ? blockedAiBotsFromRobots(result.body) : [];

    const aiAccess: "allowed" | "blocked" | "unknown" =
      !present ? "unknown" : blockedBots.length ? "blocked" : "allowed";

    return {
      url: result.finalUrl.toString(),
      status: result.response.status,
      present,
      aiAccess,
      blockedBots,
    };
  } catch {
    warnings.push("Could not verify robots.");
    return {
      url: url.toString(),
      status: null,
      present: false,
      aiAccess: "unknown" as const,
      blockedBots: [],
    };
  }
}

async function collectAuxiliary(
  url: URL,
  warnings: string[],
  label: "sitemap" | "llms",
) {
  try {
    const result = await safeFetchText(url, AUX_MAX_BYTES);
    return {
      url: result.finalUrl.toString(),
      status: result.response.status,
      present: result.response.ok && result.body.trim().length > 0,
    };
  } catch {
    warnings.push(`Could not verify ${label}.`);
    return { url: url.toString(), status: null, present: false };
  }
}

async function safeFetchText(startUrl: URL, maxBytes: number): Promise<SafeFetchResult> {
  let current = new URL(startUrl);
  const visited = new Set<string>();

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const currentKey = current.toString();
    if (visited.has(currentKey)) throw new Error("redirect_loop");
    visited.add(currentKey);
    const validated = normalizeAndValidatePublicUrl(current.toString());
    if (!validated.ok) throw new Error("blocked_address");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      await assertPublicDns(validated.url.hostname.replace(/^\[|\]$/g, ""), controller.signal);

      const response = await fetch(validated.url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
        },
      });

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("invalid_redirect");
        current = new URL(location, validated.url);
        continue;
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > maxBytes) throw new Error("response_too_large");

      const body = await readBoundedBody(response, maxBytes);
      return { response, finalUrl: validated.url, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("too_many_redirects");
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export function parsePageEvidence(url: URL, status: number, html: string): PageEvidence {
  const title = firstTagText(html, "title");
  const description = metaContent(html, "description");
  const canonical = linkHref(html, "canonical");
  const headings = extractHeadings(html).slice(0, 50);
  const internalLinks = extractInternalLinks(html, url).slice(0, 100);
  const structuredDataBlocks =
    html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi)?.length ?? 0;

  return {
    url: url.toString(),
    status,
    title,
    description,
    canonical,
    headings,
    internalLinks,
    readableText: extractReadableText(html).slice(0, MAX_TEXT_CHARS),
    structuredDataBlocks,
  };
}

function firstTagText(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) || null : null;
}

function metaContent(html: string, name: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameValue = attr(tag, "name")?.toLowerCase();
    if (nameValue === name) return attr(tag, "content")?.trim() || null;
  }
  return null;
}

function linkHref(html: string, rel: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const relValue = attr(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    if (relValue.includes(rel)) return attr(tag, "href")?.trim() || null;
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted) return decodeEntities(quoted[2]);

  const bare = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return bare ? decodeEntities(bare[1]) : null;
}

function extractHeadings(html: string): string[] {
  const result: string[] = [];
  const regex = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const text = cleanText(match[1]);
    if (text) result.push(text);
  }
  return result;
}

function extractInternalLinks(html: string, base: URL): string[] {
  const seen = new Set<string>();
  const tags = html.match(/<a\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    try {
      const url = new URL(href, base);
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin === base.origin) {
        url.hash = "";
        seen.add(url.toString());
      }
    } catch {
      // Ignore malformed links. Evidence collection must remain bounded and resilient.
    }
  }

  return [...seen];
}

function extractReadableText(html: string): string {
  return cleanText(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function cleanText(value: string): string {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function toPublicCollectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "blocked_address") return "That address is not a public website.";
  if (message === "response_too_large") return "The website response is too large to analyze safely.";
  if (message === "redirect_loop") {
    return "The website is stuck in a redirect loop.";
  }
  if (message === "too_many_redirects" || message === "invalid_redirect") {
    return "The website redirects could not be analyzed safely.";
  }
  if (message === "dns_no_public_address" || message === "dns_lookup_failed") {
    return "The website address could not be verified.";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The website took too long to respond.";
  }
  return "We could not collect enough public evidence from that website.";
}
