export type WebsiteUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function normalizeWebsiteUrl(input: string): WebsiteUrlResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: "Enter a website address." };
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "Enter a valid website address." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Use a public http or https website." };
  }

  if (!url.hostname || url.username || url.password) {
    return { ok: false, error: "Enter a public website address without login details." };
  }

  url.hash = "";

  return { ok: true, url: url.toString() };
}
