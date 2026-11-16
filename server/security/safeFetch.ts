import dns from 'node:dns/promises';
import net from 'node:net';

export interface DnsLookupAddress {
  address: string;
  family: number;
}

export type DnsLookupFn = (hostname: string) => Promise<DnsLookupAddress[]>;

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  acceptKind?: 'pdf' | 'epub' | 'html_portal' | 'any';
  lookupFn?: DnsLookupFn;
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  acceptRanges: string | null;
  contentRange: string | null;
  buffer: Buffer;
}

export interface StructuredHtmlBlock {
  id: string;
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'law_article';
  text: string;
  chapterId?: string;
}

export interface StructuredHtmlChapter {
  id: string;
  title: string;
  level: number;
  blockIndex: number;
}

export interface StructuredHtmlDocument {
  title: string;
  url: string;
  canonicalHost: string;
  blocks: StructuredHtmlBlock[];
  chapters: StructuredHtmlChapter[];
  plainText: string;
  fetchedAt: string;
}

const ALLOWED_HTML_READER_HOSTS = [
  'planalto.gov.br',
  'alepa.pa.gov.br',
  'camara.leg.br',
  'senado.leg.br',
  'gov.br',
  'fundacaocetap.selecao.net.br',
  'cetapnet.com.br',
  'cartilha.cert.br',
  'impa.br',
  'portaldamatematica.impa.br',
  'tre-pa.jus.br',
  'tjpa.jus.br',
  'pge.pa.gov.br',
];

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
  '.home.arpa',
  '.lan',
  '.nip.io',
  '.sslip.io',
  '.xip.io',
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

export function normalizeRemoteUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function rewriteGoogleDriveDownloadUrl(rawUrl: string): string {
  const fileMatch = rawUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  const openIdMatch = rawUrl.match(/drive\.google\.com\/open\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (openIdMatch) {
    return `https://drive.google.com/uc?export=download&id=${openIdMatch[1]}`;
  }
  return rawUrl;
}

export function isAllowedHtmlReaderHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!host) return false;
  return ALLOWED_HTML_READER_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

function isBlockedIpv4Tuple(parts: number[]): boolean {
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  // 0.0.0.0/8 ("this" network)
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local & cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.168.0.0/16 (RFC1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved/broadcast)
  if (a >= 224) return true;
  return false;
}

function expandIpv6ToWords(rawIp: string): number[] | null {
  const withoutZone = rawIp.split('%')[0].toLowerCase();
  if (!withoutZone) return null;

  // Handle IPv4-embedded suffix (e.g. ::ffff:127.0.0.1)
  let ipv6Part = withoutZone;
  let embeddedIpv4Words: number[] | null = null;
  const lastColon = withoutZone.lastIndexOf(':');
  if (lastColon !== -1 && withoutZone.slice(lastColon + 1).includes('.')) {
    const v4Str = withoutZone.slice(lastColon + 1);
    if (net.isIPv4(v4Str)) {
      const octets = v4Str.split('.').map(Number);
      embeddedIpv4Words = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
      ipv6Part = withoutZone.slice(0, lastColon);
      if (ipv6Part.endsWith(':')) {
        // "::ffff:127.0.0.1" -> ipv6Part "::ffff", OK; "::127.0.0.1" -> "::"
        if (ipv6Part === ':') ipv6Part = '::';
      }
    } else {
      return null;
    }
  }

  const targetWords = embeddedIpv4Words ? 6 : 8;
  const doubleColonParts = ipv6Part.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseSegment = (segment: string): number[] | null => {
    if (!segment) return [];
    const pieces = segment.split(':');
    const out: number[] = [];
    for (const p of pieces) {
      if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
      out.push(parseInt(p, 16));
    }
    return out;
  };

  let words: number[] = [];
  if (doubleColonParts.length === 2) {
    const left = parseSegment(doubleColonParts[0]);
    const right = parseSegment(doubleColonParts[1]);
    if (!left || !right) return null;
    const missing = targetWords - (left.length + right.length);
    if (missing < 1) return null;
    words = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    const exact = parseSegment(doubleColonParts[0]);
    if (!exact || exact.length !== targetWords) return null;
    words = exact;
  }

  if (embeddedIpv4Words) {
    words.push(...embeddedIpv4Words);
  }
  return words.length === 8 ? words : null;
}

export function isBlockedIpAddress(ipAddress: string): boolean {
  const clean = ipAddress.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const version = net.isIP(clean);
  if (version === 4) {
    const parts = clean.split('.').map(Number);
    return isBlockedIpv4Tuple(parts);
  }
  if (version === 6) {
    const words = expandIpv6ToWords(clean);
    if (!words) return true;
    const isAllZero = words.every((w) => w === 0);
    if (isAllZero) return true; // ::
    const isLoopback = words.slice(0, 7).every((w) => w === 0) && words[7] === 1;
    if (isLoopback) return true; // ::1

    // ::ffff:0:0/96 IPv4-mapped or ::/96 IPv4-compatible
    const isV4Mapped =
      words.slice(0, 5).every((w) => w === 0) && (words[5] === 0xffff || words[5] === 0);
    if (isV4Mapped) {
      const v4Parts = [
        (words[6] >> 8) & 0xff,
        words[6] & 0xff,
        (words[7] >> 8) & 0xff,
        words[7] & 0xff,
      ];
      return isBlockedIpv4Tuple(v4Parts);
    }

    // 64:ff9b::/96 NAT64
    if (words[0] === 0x0064 && words[1] === 0xff9b && words.slice(2, 6).every((w) => w === 0)) {
      return true;
    }

    // fc00::/7 Unique Local Address (fc00..fdff)
    if ((words[0] & 0xfe00) === 0xfc00) return true;
    // fe80::/10 Link-Local
    if ((words[0] & 0xffc0) === 0xfe80) return true;
    // fec0::/10 Deprecated Site-Local
    if ((words[0] & 0xffc0) === 0xfec0) return true;
    // ff00::/8 Multicast
    if ((words[0] & 0xff00) === 0xff00) return true;
    // 2001:db8::/32 Documentation
    if (words[0] === 0x2001 && words[1] === 0x0db8) return true;
    return false;
  }
  return true;
}

export function isBlockedHostnameSyntax(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (/^\d+$/.test(host)) return true; // decimal integer IP shorthand (e.g. 2130706433)
  if (/^0x[0-9a-f]+$/i.test(host)) return true; // hex IP shorthand
  if (net.isIP(host)) {
    return isBlockedIpAddress(host);
  }
  return false;
}

const defaultDnsLookup: DnsLookupFn = async (hostname: string) => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family }));
};

export async function assertSafeRemoteUrl(
  rawUrl: string,
  options?: { requireHtmlAllowlist?: boolean; lookupFn?: DnsLookupFn }
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfValidationError('URL inválida ou malformada.', 400);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SsrfValidationError('Protocolo não permitido. Utilize apenas http:// ou https://.', 400);
  }
  if (parsed.username || parsed.password) {
    throw new SsrfValidationError('Credenciais embutidas na URL não são permitidas.', 400);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (isBlockedHostnameSyntax(hostname)) {
    throw new SsrfValidationError('Destino local ou privado bloqueado por segurança.', 403);
  }

  if (options?.requireHtmlAllowlist && !isAllowedHtmlReaderHost(hostname)) {
    throw new SsrfValidationError(
      'Este site não pertence à lista de portais oficiais autorizados para leitura integrada.',
      403
    );
  }

  // If hostname is not a raw IP literal, resolve via DNS and ensure every resolved address is public
  if (!net.isIP(hostname)) {
    const lookup = options?.lookupFn || defaultDnsLookup;
    let resolved: DnsLookupAddress[];
    try {
      resolved = await lookup(hostname);
    } catch {
      throw new SsrfValidationError('Não foi possível resolver o domínio informado com segurança.', 502);
    }

    if (!Array.isArray(resolved) || resolved.length === 0) {
      throw new SsrfValidationError('Domínio sem endereço público válido.', 502);
    }

    for (const addr of resolved) {
      if (!addr?.address || isBlockedIpAddress(addr.address)) {
        throw new SsrfValidationError(
          'O endereço resolvido aponta para rede privada ou reservada (bloqueado por política SSRF).',
          403
        );
      }
    }
  }

  return parsed;
}

export class SsrfValidationError extends Error {
  status: number;
  kind: string;

  constructor(message: string, status = 403, kind = 'ssrf_blocked') {
    super(message);
    this.name = 'SsrfValidationError';
    this.status = status;
    this.kind = kind;
  }
}

export class RemoteSizeLimitError extends Error {
  status = 413;
  kind = 'too_large';

  constructor(message: string) {
    super(message);
    this.name = 'RemoteSizeLimitError';
  }
}

export function isPdfMagicBuffer(buf: Buffer): boolean {
  if (buf.byteLength < 4) return false;
  // Some generators add UTF-8 BOM or leading whitespace before %PDF-
  const headerSlice = buf.subarray(0, 16).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  return headerSlice.startsWith('%PDF');
}

export function isZipMagicBuffer(buf: Buffer): boolean {
  if (buf.byteLength < 4) return false;
  return (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    ((buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06))
  );
}

export function looksLikeHtmlBuffer(buf: Buffer, contentType: string): boolean {
  const ctype = contentType.toLowerCase();
  if (ctype.includes('text/html') || ctype.includes('application/xhtml+xml')) {
    return true;
  }
  const head = buf.subarray(0, 64).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head');
}

async function readResponseWithByteLimit(response: globalThis.Response, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    try {
      await response.body?.cancel();
    } catch {
      // ignore cancel errors
    }
    throw new RemoteSizeLimitError(
      `O arquivo remoto ultrapassa o limite máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB).`
    );
  }

  if (!response.body) {
    const arrBuf = await response.arrayBuffer();
    if (arrBuf.byteLength > maxBytes) {
      throw new RemoteSizeLimitError(
        `O arquivo remoto ultrapassa o limite máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB).`
      );
    }
    return Buffer.from(arrBuf);
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel error
        }
        throw new RemoteSizeLimitError(
          `O arquivo remoto ultrapassa o limite máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB).`
        );
      }
      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks, total);
}

export async function safeFetchRemoteDocument(
  rawUrl: string,
  options?: SafeFetchOptions
): Promise<SafeFetchResult> {
  const maxBytes = options?.maxBytes ?? 45 * 1024 * 1024;
  const timeoutMs = options?.timeoutMs ?? 25_000;
  const maxRedirects = options?.maxRedirects ?? 5;
  const requireHtmlAllowlist = options?.acceptKind === 'html_portal';
  const fetchFn = options?.fetchImpl ?? fetch;

  let currentUrl = rewriteGoogleDriveDownloadUrl(normalizeRemoteUrlInput(rawUrl));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const safeParsed = await assertSafeRemoteUrl(currentUrl, {
        requireHtmlAllowlist,
        lookupFn: options?.lookupFn,
      });

      const upstream = await fetchFn(safeParsed.toString(), {
        method: 'GET',
        headers: options?.headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (
        upstream.status === 301 ||
        upstream.status === 302 ||
        upstream.status === 303 ||
        upstream.status === 307 ||
        upstream.status === 308
      ) {
        try {
          await upstream.body?.cancel();
        } catch {
          // ignore
        }
        const location = upstream.headers.get('location');
        if (!location) {
          throw new SsrfValidationError('Redirecionamento HTTP sem cabeçalho Location.', 502, 'bad_redirect');
        }
        if (hop === maxRedirects) {
          throw new SsrfValidationError('Número máximo de redirecionamentos excedido.', 502, 'too_many_redirects');
        }
        currentUrl = new URL(location, safeParsed).toString();
        continue;
      }

      if (!upstream.ok && upstream.status !== 206) {
        try {
          await upstream.body?.cancel();
        } catch {
          // ignore
        }
        throw new SsrfValidationError(
          `O servidor de origem respondeu com status ${upstream.status}.`,
          upstream.status === 404 ? 404 : 502,
          'upstream_error'
        );
      }

      const buffer = await readResponseWithByteLimit(upstream, maxBytes);
      return {
        finalUrl: safeParsed.toString(),
        status: upstream.status,
        contentType: (upstream.headers.get('content-type') || '').toLowerCase(),
        acceptRanges: upstream.headers.get('accept-ranges'),
        contentRange: upstream.headers.get('content-range'),
        buffer,
      };
    }

    throw new SsrfValidationError('Número máximo de redirecionamentos excedido.', 502, 'too_many_redirects');
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlTextEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ordm;/gi, 'º')
    .replace(/&ordf;/gi, 'ª')
    .replace(/&sect;/gi, '§')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&aacute;/g, 'á')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&iacute;/g, 'í')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&atilde;/g, 'ã')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    });
}

function stripTagsAndClean(rawHtml: string): string {
  return decodeHtmlTextEntities(
    rawHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function decodeHtmlBuffer(buffer: Buffer, contentType: string): string {
  const sniff = buffer.subarray(0, 2048).toString('latin1').toLowerCase();
  const ctype = contentType.toLowerCase();
  const isLatin1 =
    ctype.includes('iso-8859-1') ||
    ctype.includes('windows-1252') ||
    sniff.includes('charset=iso-8859-1') ||
    sniff.includes('charset="iso-8859-1"') ||
    sniff.includes('charset=windows-1252');
  return buffer.toString(isLatin1 ? 'latin1' : 'utf8');
}

export function extractStructuredHtmlPortal(
  html: string,
  sourceUrl: string
): StructuredHtmlDocument {
  const parsedUrl = new URL(sourceUrl);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const docTitle = titleMatch ? stripTagsAndClean(titleMatch[1]) : parsedUrl.hostname;

  // Prefer <main> or <article> when meaningful, otherwise cleaned <body>
  const mainMatch =
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);

  let working = mainMatch ? mainMatch[1] : html;
  working = working
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|object|embed|nav|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const blocks: StructuredHtmlBlock[] = [];
  const chapters: StructuredHtmlChapter[] = [];
  let activeChapterId: string | undefined;

  const elementRegex = /<(h1|h2|h3|h4|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let blockIdx = 0;

  while ((match = elementRegex.exec(working)) !== null) {
    const tag = match[1].toLowerCase();
    const cleaned = stripTagsAndClean(match[2]);
    if (!cleaned || cleaned.length < 2) continue;

    let kind: StructuredHtmlBlock['kind'] = 'p';
    if (tag === 'h1') kind = 'h1';
    else if (tag === 'h2') kind = 'h2';
    else if (tag === 'h3' || tag === 'h4') kind = 'h3';
    else if (tag === 'li') kind = 'li';
    else if (tag === 'blockquote') kind = 'quote';
    else if (/^(Art\.?\s+\d+|T[ÍI]TULO\s+[IVXLC]+|CAP[ÍI]TULO\s+[IVXLC]+|SE[ÇC][ÃA]O\s+[IVXLC]+)/i.test(cleaned)) {
      kind = 'law_article';
    }

    if (kind === 'h1' || kind === 'h2' || kind === 'h3' || /^(T[ÍI]TULO|CAP[ÍI]TULO|LIVRO)\s+[IVXLC0-9]+/i.test(cleaned)) {
      const chapterId = `html_ch_${chapters.length + 1}`;
      activeChapterId = chapterId;
      chapters.push({
        id: chapterId,
        title: cleaned.slice(0, 140),
        level: kind === 'h1' ? 1 : kind === 'h2' ? 2 : 3,
        blockIndex: blocks.length,
      });
    }

    blocks.push({
      id: `html_blk_${blockIdx++}`,
      kind,
      text: cleaned,
      chapterId: activeChapterId,
    });

    if (blocks.length >= 1600) break;
  }

  // Fallback for legacy Brazilian legislation HTML (like Planalto <font>/<div> without <p>)
  if (blocks.length < 4) {
    const plainLines = stripTagsAndClean(
      working.replace(/<\/(div|p|tr|li|h[1-6]|section)>/gi, '\n')
    )
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 4);

    for (const line of plainLines.slice(0, 1600)) {
      const isHeading = /^(T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|LIVRO|LEI\s+N|CONSTITUI[ÇC][ÃA]O|REGIMENTO)/i.test(
        line
      );
      const isArticle = /^Art\.?\s+\d+/i.test(line);
      if (isHeading && line.length <= 160) {
        const chapterId = `html_ch_${chapters.length + 1}`;
        activeChapterId = chapterId;
        chapters.push({
          id: chapterId,
          title: line.slice(0, 140),
          level: 2,
          blockIndex: blocks.length,
        });
      }
      blocks.push({
        id: `html_blk_${blockIdx++}`,
        kind: isHeading ? 'h2' : isArticle ? 'law_article' : 'p',
        text: line,
        chapterId: activeChapterId,
      });
    }
  }

  const plainText = blocks.map((b) => b.text).join('\n\n').slice(0, 200_000);

  return {
    title: docTitle || parsedUrl.hostname,
    url: sourceUrl,
    canonicalHost: parsedUrl.hostname.toLowerCase(),
    blocks,
    chapters,
    plainText,
    fetchedAt: new Date().toISOString(),
  };
}
