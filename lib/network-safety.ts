import { normalizeWebsiteUrl } from "./website-url";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
  "instance-data.ec2.internal",
]);

export type PublicUrlResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

export function normalizeAndValidatePublicUrl(input: string): PublicUrlResult {
  const normalized = normalizeWebsiteUrl(input);
  if (!normalized.ok) return normalized;

  const url = new URL(normalized.url);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { ok: false, error: "That address is not a public website." };
  }

  if (isIpAddress(hostname) && isBlockedIp(hostname)) {
    return { ok: false, error: "That address is not a public website." };
  }

  return { ok: true, url };
}

export function isIpAddress(hostname: string): boolean {
  return isIpv4(hostname) || hostname.includes(":");
}

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return isIpv4(normalized)
    ? isBlockedIpv4(normalized)
    : isBlockedIpv6(normalized);
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isBlockedIpv4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(ip: string): boolean {
  if (!ip.includes(":")) return true;

  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;

  const first = Number.parseInt(ip.split(":")[0] || "0", 16);
  if (Number.isFinite(first) && first >= 0xfe80 && first <= 0xfebf) return true;
  if (Number.isFinite(first) && first >= 0xff00) return true;
  if (ip.startsWith("2001:db8:") || ip === "2001:db8::") return true;

  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  return false;
}

type DnsJson = {
  Status?: number;
  Answer?: Array<{ type?: number; data?: string }>;
};

async function resolveRecord(hostname: string, type: "A" | "AAAA", signal: AbortSignal) {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);

  const response = await fetch(endpoint, {
    headers: { accept: "application/dns-json" },
    signal,
  });

  if (!response.ok) {
    throw new Error("dns_lookup_failed");
  }

  const payload = (await response.json()) as DnsJson;
  return (payload.Answer ?? [])
    .filter((answer) => answer.type === 1 || answer.type === 28)
    .map((answer) => answer.data)
    .filter((value): value is string => Boolean(value));
}

export async function assertPublicDns(hostname: string, signal: AbortSignal) {
  if (isIpAddress(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("blocked_address");
    return [hostname];
  }

  const [v4, v6] = await Promise.all([
    resolveRecord(hostname, "A", signal),
    resolveRecord(hostname, "AAAA", signal),
  ]);

  const addresses = [...v4, ...v6];
  if (addresses.length === 0) throw new Error("dns_no_public_address");
  if (addresses.some(isBlockedIp)) throw new Error("blocked_address");

  return addresses;
}
