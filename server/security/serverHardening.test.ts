import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildCspHeader,
  createApp,
  normalizeClientIp,
  parseSpotifyTarget,
  ProxyRateLimiter,
  resolveTrustProxyHops,
} from '../../server.ts';

async function startTestServer(options: {
  trustProxyHops?: number | string;
  proxyMaxPerMinute?: number;
}) {
  const app = await createApp({
    enableVite: false,
    ...options,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe('Server Trust Proxy & Client IP Normalization', () => {
  it('validates TRUST_PROXY_HOPS safely and rejects unsafe values like true or out-of-range ints', () => {
    expect(resolveTrustProxyHops(undefined)).toBe(1);
    expect(resolveTrustProxyHops('')).toBe(1);
    expect(resolveTrustProxyHops('0')).toBe(0);
    expect(resolveTrustProxyHops('false')).toBe(0);
    expect(resolveTrustProxyHops('off')).toBe(0);
    expect(resolveTrustProxyHops('2')).toBe(2);
    expect(resolveTrustProxyHops('loopback')).toBe('loopback');
    expect(resolveTrustProxyHops('true')).toBe(1);
    expect(resolveTrustProxyHops('99')).toBe(1);
    expect(resolveTrustProxyHops('-1')).toBe(1);
    expect(resolveTrustProxyHops('invalid')).toBe(1);
  });

  it('normalizes IPv4-mapped IPv6 addresses and strips zone identifiers', () => {
    expect(normalizeClientIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeClientIp('fe80::1%eth0')).toBe('fe80::1');
    expect(normalizeClientIp(' 198.51.100.7 ')).toBe('198.51.100.7');
    expect(normalizeClientIp('')).toBe('unknown');
  });
});

describe('Spotify Target Parser & CSP Header', () => {
  it('accepts valid Spotify URLs/URIs and rejects traversal or untrusted hosts', () => {
    expect(parseSpotifyTarget('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toEqual({
      kind: 'episode',
      id: '4rOoJ6Egrf8K2IrywzwOMk',
      canonicalUrl: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
    });
    expect(parseSpotifyTarget('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      canonicalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    });
    expect(parseSpotifyTarget('https://evil.example.com/playlist/12345').kind).toBe('unknown');
    expect(parseSpotifyTarget('spotify:user:..').kind).toBe('unknown');
    expect(parseSpotifyTarget('https://open.spotify.com/track/abc_def').kind).toBe('unknown');
  });

  it('includes required directives for AI Studio iframe, Firebase, and PDF.js workers in CSP', () => {
    const csp = buildCspHeader();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'self' https://aistudio.google.com");
    expect(csp).toContain('https://firebasestorage.googleapis.com');
  });
});

describe('ProxyRateLimiter Sliding Window', () => {
  it('enforces maxRequests within the window and calculates retryAfterSeconds', () => {
    const limiter = new ProxyRateLimiter({ maxRequests: 2, windowMs: 10_000 });
    const t0 = 1_000_000;
    expect(limiter.consume('ip:1.2.3.4', t0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('ip:1.2.3.4', t0 + 1000)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = limiter.consume('ip:1.2.3.4', t0 + 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(8);
    expect(limiter.consume('ip:5.6.7.8', t0 + 2000).allowed).toBe(true);
    expect(limiter.consume('ip:1.2.3.4', t0 + 11_000).allowed).toBe(true);
  });
});

describe('HTTP Integration: Security Headers, Guest AI Quota Isolation, Proxy Rate Limit, and 404/JSON Errors', () => {
  let proxySrv: Awaited<ReturnType<typeof startTestServer>>;
  let directSrv: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    proxySrv = await startTestServer({ trustProxyHops: 1, proxyMaxPerMinute: 3 });
    directSrv = await startTestServer({ trustProxyHops: 0, proxyMaxPerMinute: 3 });
  });

  afterAll(async () => {
    await Promise.all([proxySrv.close(), directSrv.close()]);
  });

  it('sets security headers including CSP and COOP=same-origin-allow-popups', async () => {
    const res = await fetch(`${proxySrv.baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
  });

  it('isolates guest AI quota per visitor IP behind 1 proxy and prevents leftmost X-Forwarded-For spoofing', async () => {
    const visitorA = '198.51.100.11';
    const visitorB = '198.51.100.12';

    const hitA = await fetch(`${proxySrv.baseUrl}/api/gemini/test-probe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `203.0.113.99, ${visitorA}`,
      },
      body: JSON.stringify({}),
    });
    expect(hitA.headers.get('x-ai-quota-tier')).toBe('guest');
    const limit = Number(hitA.headers.get('x-ai-quota-limit'));
    expect(Number(hitA.headers.get('x-ai-quota-remaining'))).toBe(limit - 1);

    const usageA = (await (
      await fetch(`${proxySrv.baseUrl}/api/ai/usage`, {
        headers: { 'X-Forwarded-For': visitorA },
      })
    ).json()) as { usage: { dayUsed: number } };
    expect(usageA.usage.dayUsed).toBe(1);

    const usageB = (await (
      await fetch(`${proxySrv.baseUrl}/api/ai/usage`, {
        headers: { 'X-Forwarded-For': visitorB },
      })
    ).json()) as { usage: { dayUsed: number } };
    expect(usageB.usage.dayUsed).toBe(0);
  });

  it('ignores spoofed X-Forwarded-For headers when trustProxyHops is 0', async () => {
    await fetch(`${directSrv.baseUrl}/api/gemini/direct-probe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.201',
      },
      body: JSON.stringify({}),
    });
    const usageOtherHeader = (await (
      await fetch(`${directSrv.baseUrl}/api/ai/usage`, {
        headers: { 'X-Forwarded-For': '198.51.100.202' },
      })
    ).json()) as { usage: { dayUsed: number } };
    expect(usageOtherHeader.usage.dayUsed).toBeGreaterThanOrEqual(1);
  });

  it('rate-limits /api/materials/pdf-proxy and /api/materials/reader-proxy with HTTP 429 and Retry-After', async () => {
    const clientIp = '198.51.100.33';
    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`${proxySrv.baseUrl}/api/materials/pdf-proxy`, {
        headers: { 'X-Forwarded-For': clientIp },
      });
      expect(res.status).toBe(400);
    }
    const throttled = await fetch(`${proxySrv.baseUrl}/api/materials/pdf-proxy`, {
      headers: { 'X-Forwarded-For': clientIp },
    });
    expect(throttled.status).toBe(429);
    expect(Number(throttled.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    const body = (await throttled.json()) as { kind?: string };
    expect(body.kind).toBe('rate_limited');
  });

  it('returns JSON 404 for unknown /api/* and missing /assets/*, plus JSON 400 on malformed JSON body', async () => {
    const missingApi = await fetch(`${proxySrv.baseUrl}/api/unknown-route-check`);
    expect(missingApi.status).toBe(404);
    expect(missingApi.headers.get('content-type')).toContain('application/json');

    const missingAsset = await fetch(`${proxySrv.baseUrl}/assets/non-existent-file-12345.pdf`);
    expect(missingAsset.status).toBe(404);
    expect(missingAsset.headers.get('content-type')).toContain('application/json');

    const badJson = await fetch(`${proxySrv.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.44',
      },
      body: '{invalid-json',
    });
    expect(badJson.status).toBe(400);
    expect(badJson.headers.get('content-type')).toContain('application/json');
  });
});
