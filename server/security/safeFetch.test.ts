import { describe, expect, it } from 'vitest';
import {
  assertSafeRemoteUrl,
  decodeHtmlBuffer,
  extractStructuredHtmlPortal,
  isAllowedHtmlReaderHost,
  isBlockedHostnameSyntax,
  isBlockedIpAddress,
  isPdfMagicBuffer,
  isZipMagicBuffer,
  RemoteSizeLimitError,
  safeFetchRemoteDocument,
  SsrfValidationError,
} from './safeFetch';

describe('safeFetch SSRF protection & sanitization', () => {
  it('blocks loopback, RFC1918 private, link-local metadata IPv4 addresses', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('10.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true);
    expect(isBlockedIpAddress('172.31.255.254')).toBe(true);
    expect(isBlockedIpAddress('192.168.1.1')).toBe(true);
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true);
    expect(isBlockedIpAddress('100.64.0.1')).toBe(true);
    expect(isBlockedIpAddress('0.0.0.0')).toBe(true);

    // Public IP should be allowed
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
    expect(isBlockedIpAddress('177.71.128.10')).toBe(false);
  });

  it('blocks loopback, ULA, link-local, IPv4-mapped, and NAT64 IPv6 addresses', () => {
    expect(isBlockedIpAddress('::1')).toBe(true);
    expect(isBlockedIpAddress('::')).toBe(true);
    expect(isBlockedIpAddress('fc00::1')).toBe(true);
    expect(isBlockedIpAddress('fd12:3456:789a::1')).toBe(true);
    expect(isBlockedIpAddress('fe80::1')).toBe(true);
    expect(isBlockedIpAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedIpAddress('64:ff9b::10.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('64:ff9b::c0a8:0101')).toBe(true);

    // Public IPv6 should be allowed
    expect(isBlockedIpAddress('2001:4860:4860::8888')).toBe(false);
  });

  it('blocks localhost, metadata hostnames, local suffixes, and numeric IP shorthands', () => {
    expect(isBlockedHostnameSyntax('localhost')).toBe(true);
    expect(isBlockedHostnameSyntax('metadata.google.internal')).toBe(true);
    expect(isBlockedHostnameSyntax('api.myservice.local')).toBe(true);
    expect(isBlockedHostnameSyntax('127.0.0.1.nip.io')).toBe(true);
    expect(isBlockedHostnameSyntax('2130706433')).toBe(true);
    expect(isBlockedHostnameSyntax('0x7f000001')).toBe(true);
    expect(isBlockedHostnameSyntax('www.planalto.gov.br')).toBe(false);
  });

  it('rejects DNS rebinding resolutions pointing to private or metadata IPs', async () => {
    await expect(
      assertSafeRemoteUrl('https://rebind.attacker.example/doc.pdf', {
        lookupFn: async () => [{ address: '127.0.0.1', family: 4 }],
      })
    ).rejects.toThrow(SsrfValidationError);

    await expect(
      assertSafeRemoteUrl('https://rebind-meta.attacker.example/doc.pdf', {
        lookupFn: async () => [{ address: '169.254.169.254', family: 4 }],
      })
    ).rejects.toThrow(SsrfValidationError);

    await expect(
      assertSafeRemoteUrl('http://user:pass@www.planalto.gov.br/doc.pdf', {
        lookupFn: async () => [{ address: '200.130.0.10', family: 4 }],
      })
    ).rejects.toThrow(SsrfValidationError);
  });

  it('enforces HTML portal host allowlist strictly', () => {
    expect(isAllowedHtmlReaderHost('www.planalto.gov.br')).toBe(true);
    expect(isAllowedHtmlReaderHost('bancodeleis.alepa.pa.gov.br')).toBe(true);
    expect(isAllowedHtmlReaderHost('planalto.gov.br.evil.com')).toBe(false);
    expect(isAllowedHtmlReaderHost('evil.example.org')).toBe(false);
  });

  it('blocks unsafe redirects to private IPs and enforces maxRedirects <= 5', async () => {
    const publicDns = async () => [{ address: '200.130.40.10', family: 4 }];

    await expect(
      safeFetchRemoteDocument('https://public.example.org/start.pdf', {
        lookupFn: publicDns,
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://127.0.0.1:8080/internal-admin' },
          }),
      })
    ).rejects.toThrow(SsrfValidationError);

    let hopCount = 0;
    await expect(
      safeFetchRemoteDocument('https://public.example.org/loop.pdf', {
        maxRedirects: 5,
        lookupFn: publicDns,
        fetchImpl: async () => {
          hopCount += 1;
          return new Response(null, {
            status: 302,
            headers: { location: `https://public.example.org/step-${hopCount}.pdf` },
          });
        },
      })
    ).rejects.toThrow(/redirecionamentos/i);
  });

  it('enforces streaming byte size limits', async () => {
    const publicDns = async () => [{ address: '200.130.40.10', family: 4 }];
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(600));
        controller.enqueue(new Uint8Array(600));
        controller.close();
      },
    });

    await expect(
      safeFetchRemoteDocument('https://public.example.org/big.pdf', {
        maxBytes: 1024,
        lookupFn: publicDns,
        fetchImpl: async () =>
          new Response(oversizedStream, {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          }),
      })
    ).rejects.toThrow(RemoteSizeLimitError);
  });

  it('validates PDF & ZIP magic bytes accurately', () => {
    expect(isPdfMagicBuffer(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdfMagicBuffer(Buffer.from('\uFEFF%PDF-1.4\n'))).toBe(true);
    expect(isPdfMagicBuffer(Buffer.from('<html>not a pdf</html>'))).toBe(false);

    expect(isZipMagicBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(true);
    expect(isZipMagicBuffer(Buffer.from('<html>not a zip</html>'))).toBe(false);
  });

  it('strips scripts, iframes, forms, and raw markup during HTML portal extraction', () => {
    const rawHtml = `<!doctype html>
      <html>
        <head><title>Lei Estadual n&ordm; 5.810/1994</title></head>
        <body>
          <nav><a href="https://evil.com">Menu nav ignorado</a></nav>
          <main>
            <h1>CAP&Iacute;TULO I - Do Regime Jur&iacute;dico</h1>
            <script>alert("xss")</script>
            <iframe src="javascript:alert(1)"></iframe>
            <p onclick="stealCookie()">Art. 1&ordm; Esta Lei institui o regime jur&iacute;dico &uacute;nico dos servidores p&uacute;blicos civis do Estado.</p>
          </main>
        </body>
      </html>`;

    const decoded = decodeHtmlBuffer(Buffer.from(rawHtml, 'utf8'), 'text/html; charset=utf-8');
    const doc = extractStructuredHtmlPortal(decoded, 'https://www.alepa.pa.gov.br/lei5810');

    expect(doc.title).toContain('Lei Estadual nº 5.810/1994');
    expect(doc.plainText).not.toContain('alert("xss")');
    expect(doc.plainText).not.toContain('<script');
    expect(doc.plainText).not.toContain('<iframe');
    expect(doc.plainText).not.toContain('stealCookie');
    expect(doc.plainText).not.toContain('Menu nav ignorado');
    expect(doc.blocks.some((b) => b.kind === 'law_article' && b.text.includes('Art. 1º'))).toBe(true);
    expect(doc.chapters.length).toBeGreaterThanOrEqual(1);
  });
});
