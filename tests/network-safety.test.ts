import assert from "node:assert/strict";
import test from "node:test";
import {
  isBlockedIp,
  normalizeAndValidatePublicUrl,
} from "../lib/network-safety.ts";

test("allows ordinary public websites", () => {
  const result = normalizeAndValidatePublicUrl("https://example.com");
  assert.equal(result.ok, true);
});

test("blocks localhost hostnames", () => {
  assert.equal(normalizeAndValidatePublicUrl("http://localhost").ok, false);
  assert.equal(normalizeAndValidatePublicUrl("http://dev.localhost").ok, false);
});

test("blocks private IPv4 ranges", () => {
  for (const ip of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
  ]) {
    assert.equal(isBlockedIp(ip), true, ip);
    assert.equal(normalizeAndValidatePublicUrl(`http://${ip}`).ok, false, ip);
  }
});

test("blocks non-public and metadata IPv4 ranges", () => {
  for (const ip of [
    "0.0.0.0",
    "100.64.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
  ]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
});

test("blocks private, link-local, loopback and mapped IPv6", () => {
  for (const ip of [
    "::",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
});

test("blocks common metadata hostnames and internal suffixes", () => {
  for (const host of [
    "metadata.google.internal",
    "instance-data.ec2.internal",
    "service.internal",
    "printer.local",
  ]) {
    assert.equal(normalizeAndValidatePublicUrl(`http://${host}`).ok, false, host);
  }
});
