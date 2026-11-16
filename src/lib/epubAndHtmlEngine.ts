import JSZip from 'jszip';
import {
  downloadDriveFileBuffer,
  parseGoogleWorkspaceUrl,
} from './googleWorkspace';
import { getLocalFile } from './localFiles';
import {
  isAllowedHtmlPortalUrl,
  isPdfReadableMaterial,
  type PdfOutlineNode,
  type StructuredReadingBlock,
} from './pdfBookEngine';

export type MaterialOpeningMode = 'pdf' | 'epub' | 'html_portal' | 'external';

export interface StructuredBookUnit {
  unitNumber: number;
  chapterId: string;
  title: string;
  blocks: StructuredReadingBlock[];
  plainText: string;
}

export interface ParsedStructuredBook {
  sourceKind: 'epub' | 'html_portal';
  title: string;
  author?: string;
  units: StructuredBookUnit[];
  outline: PdfOutlineNode[];
  blobUrlForDownload?: string;
  canonicalUrl?: string;
}

export function classifyMaterialOpeningMode(mat: {
  url: string;
  fileType: string;
  resourceType?: string;
  fileName?: string;
  pendingDefinition?: boolean;
}): MaterialOpeningMode {
  if (mat.pendingDefinition) return 'external';
  const url = (mat.url || '').trim();
  if (!url) return 'external';
  const lowerUrl = url.toLowerCase();
  const lowerName = (mat.fileName || '').toLowerCase();

  if (
    mat.fileType === 'epub' ||
    /\.epub($|[?#])/i.test(lowerUrl) ||
    lowerName.endsWith('.epub')
  ) {
    return 'epub';
  }

  if (isPdfReadableMaterial(mat)) {
    return 'pdf';
  }

  if (
    (mat.fileType === 'html' || isAllowedHtmlPortalUrl(url)) &&
    mat.fileType !== 'video' &&
    mat.fileType !== 'xlsx' &&
    mat.fileType !== 'pptx' &&
    mat.resourceType !== 'video' &&
    mat.resourceType !== 'podcast'
  ) {
    return 'html_portal';
  }

  return 'external';
}

export function isInAppReadableMaterial(mat: {
  url: string;
  fileType: string;
  resourceType?: string;
  fileName?: string;
  pendingDefinition?: boolean;
}): boolean {
  return classifyMaterialOpeningMode(mat) !== 'external';
}

function resolveZipPath(baseDir: string, relativeHref: string): string {
  const cleanHref = relativeHref.split('#')[0].split('?')[0].replace(/^\/+/, '');
  if (!baseDir) return cleanHref;
  const baseParts = baseDir.split('/').filter(Boolean);
  const relParts = cleanHref.split('/');
  for (const seg of relParts) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      baseParts.pop();
    } else {
      baseParts.push(seg);
    }
  }
  return baseParts.join('/');
}

function parseXhtmlChapterBlocks(xhtml: string, unitNumber: number, fallbackTitle: string): {
  title: string;
  blocks: StructuredReadingBlock[];
  plainText: string;
} {
  const blocks: StructuredReadingBlock[] = [];
  let title = fallbackTitle;

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
    const parseError = doc.querySelector('parsererror');
    const targetDoc = parseError
      ? parser.parseFromString(xhtml, 'text/html')
      : doc;

    targetDoc.querySelectorAll('script, style, svg, nav, noscript').forEach((el) => el.remove());

    const headingEl =
      targetDoc.querySelector('h1') ||
      targetDoc.querySelector('h2') ||
      targetDoc.querySelector('title');
    const headingText = headingEl?.textContent?.replace(/\s+/g, ' ').trim();
    if (headingText && headingText.length >= 2) {
      title = headingText.slice(0, 140);
    }

    const bodyRoot = targetDoc.body || targetDoc.documentElement;
    const elements = bodyRoot.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, pre');
    let seq = 0;

    elements.forEach((el) => {
      const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (!text || text.length < 2) return;
      const tag = el.tagName.toLowerCase();
      let kind: StructuredReadingBlock['kind'] = 'paragraph';
      if (tag === 'h1' || tag === 'h2') kind = 'heading';
      else if (tag === 'h3' || tag === 'h4') kind = 'subheading';
      else if (tag === 'li') kind = 'list_item';
      seq += 1;
      blocks.push({
        id: `epub_${unitNumber}_${seq}`,
        kind,
        text,
      });
    });

    if (blocks.length === 0) {
      const rawText = (bodyRoot.textContent || '')
        .split(/\n+/)
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter((l) => l.length >= 2);
      rawText.forEach((line, idx) => {
        blocks.push({
          id: `epub_${unitNumber}_raw_${idx + 1}`,
          kind: 'paragraph',
          text: line,
        });
      });
    }
  } else {
    // Fallback regex extraction when running in non-DOM environments (e.g. Node Vitest)
    const stripped = xhtml
      .replace(/<(head|script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length >= 2);

    if (stripped.length > 0) {
      title = stripped[0].slice(0, 140);
    }
    stripped.forEach((line, idx) => {
      blocks.push({
        id: `epub_${unitNumber}_txt_${idx + 1}`,
        kind: idx === 0 ? 'heading' : 'paragraph',
        text: line,
      });
    });
  }

  return {
    title,
    blocks,
    plainText: blocks.map((b) => b.text).join('\n\n'),
  };
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function findZipFileCaseInsensitive(zip: JSZip, targetPath: string): JSZip.JSZipObject | null {
  const direct = zip.file(targetPath);
  if (direct) return direct;
  const normalized = targetPath.replace(/^\/+/, '').toLowerCase();
  const matchedKey = Object.keys(zip.files).find(
    (k) => !zip.files[k].dir && k.replace(/^\/+/, '').toLowerCase() === normalized
  );
  return matchedKey ? zip.file(matchedKey) : null;
}

export async function parseEpubBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fallbackBookTitle = 'Livro Digital EPUB',
  blobUrlForDownload?: string
): Promise<ParsedStructuredBook> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('O arquivo EPUB está vazio ou incompleto.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Arquivo EPUB inválido ou corrompido (falha ao abrir o pacote ZIP).');
  }

  const containerFile = findZipFileCaseInsensitive(zip, 'META-INF/container.xml');
  let opfPath = '';

  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const opfMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (opfMatch?.[1]) {
      opfPath = safeDecodeUriComponent(opfMatch[1]);
    }
  }

  if (!opfPath) {
    const candidateOpf = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith('.opf'));
    if (!candidateOpf) {
      throw new Error('Arquivo EPUB inválido: pacote OPF não encontrado.');
    }
    opfPath = candidateOpf;
  }

  const opfFile = findZipFileCaseInsensitive(zip, opfPath);
  if (!opfFile) {
    throw new Error('Não foi possível abrir o manifesto OPF do EPUB.');
  }

  const opfXml = await opfFile.async('text');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const authorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
  const bookTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : fallbackBookTitle;
  const bookAuthor = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

  const manifestMap = new Map<string, { href: string; mediaType: string }>();
  const itemTagRegex = /<item\b([^>]+)\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemTagRegex.exec(opfXml)) !== null) {
    const attrs = itemMatch[1];
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const mediaType = attrs.match(/\bmedia-type=["']([^"']+)["']/i)?.[1] || '';
    if (id && href) {
      manifestMap.set(id, { href: safeDecodeUriComponent(href), mediaType });
    }
  }

  const spineIds: string[] = [];
  const itemrefRegex = /<itemref\b([^>]+)\/?>/gi;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = itemrefRegex.exec(opfXml)) !== null) {
    const idref = refMatch[1].match(/\bidref=["']([^"']+)["']/i)?.[1];
    if (idref) spineIds.push(idref);
  }

  const units: StructuredBookUnit[] = [];
  const outline: PdfOutlineNode[] = [];

  for (let i = 0; i < spineIds.length; i++) {
    const manifestItem = manifestMap.get(spineIds[i]);
    if (!manifestItem) continue;
    const zipEntryPath = resolveZipPath(opfDir, manifestItem.href);
    const entryFile =
      findZipFileCaseInsensitive(zip, zipEntryPath) ||
      findZipFileCaseInsensitive(zip, manifestItem.href);
    if (!entryFile) continue;

    const xhtml = await entryFile.async('text');
    const unitNumber = units.length + 1;
    const parsed = parseXhtmlChapterBlocks(xhtml, unitNumber, `Capítulo ${unitNumber}`);
    if (parsed.blocks.length === 0) continue;

    const chapterId = `epub_ch_${unitNumber}`;
    units.push({
      unitNumber,
      chapterId,
      title: parsed.title,
      blocks: parsed.blocks,
      plainText: parsed.plainText,
    });
    outline.push({
      id: chapterId,
      title: parsed.title,
      pageNumber: unitNumber,
      children: [],
    });
  }

  if (units.length === 0) {
    throw new Error('O arquivo EPUB não possui capítulos legíveis no pacote.');
  }

  return {
    sourceKind: 'epub',
    title: bookTitle,
    author: bookAuthor,
    units,
    outline,
    blobUrlForDownload,
  };
}

export async function loadAndParseEpub(params: {
  url: string;
  fileName?: string;
  title?: string;
  workspaceAccessToken?: string | null;
}): Promise<ParsedStructuredBook> {
  const rawUrl = (params.url || '').trim();
  if (!rawUrl) {
    throw new Error('Material EPUB sem endereço cadastrado.');
  }

  let arrayBuffer: ArrayBuffer | null = null;
  let blobUrlForDownload: string | undefined;

  if (rawUrl.startsWith('local://')) {
    const localKey = rawUrl.replace('local://', '');
    const record = await getLocalFile(localKey);
    if (!record) {
      throw new Error('Este arquivo EPUB foi salvo localmente em outro dispositivo. Envie o arquivo novamente.');
    }
    if (!record.buffer || record.buffer.byteLength === 0) {
      throw new Error('O arquivo EPUB salvo localmente está vazio ou corrompido. Envie o arquivo novamente.');
    }
    arrayBuffer = record.buffer.slice(0);
    blobUrlForDownload = URL.createObjectURL(new Blob([record.buffer], { type: 'application/epub+zip' }));
  } else if (rawUrl.startsWith('/')) {
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Não foi possível carregar o EPUB local (${res.status}).`);
    arrayBuffer = await res.arrayBuffer();
    blobUrlForDownload = rawUrl;
  } else {
    const parsedDrive = parseGoogleWorkspaceUrl(rawUrl);
    if (parsedDrive.kind === 'drive_file' && parsedDrive.id && params.workspaceAccessToken) {
      arrayBuffer = await downloadDriveFileBuffer(params.workspaceAccessToken, parsedDrive.id);
      blobUrlForDownload = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/epub+zip' }));
    } else {
      const res = await fetch(`/api/materials/reader-proxy?kind=epub&url=${encodeURIComponent(rawUrl)}`);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Muitas solicitações de leitura em sequência. Aguarde alguns segundos e tente novamente.');
        }
        const errBody = await res.json().catch(() => ({ error: 'Não foi possível abrir o EPUB remoto.' }));
        throw new Error(String((errBody as { error?: string }).error || 'Erro ao carregar EPUB remoto.'));
      }
      arrayBuffer = await res.arrayBuffer();
      blobUrlForDownload = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/epub+zip' }));
    }
  }

  return parseEpubBuffer(arrayBuffer, params.title || params.fileName || 'Livro EPUB', blobUrlForDownload);
}

interface ReaderProxyHtmlResponse {
  title: string;
  url: string;
  canonicalHost: string;
  blocks: Array<{
    id: string;
    kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'law_article';
    text: string;
    chapterId?: string;
  }>;
  chapters: Array<{
    id: string;
    title: string;
    level: number;
    blockIndex: number;
  }>;
  plainText: string;
}

export async function loadAndParseHtmlPortal(
  url: string,
  fallbackTitle = 'Portal Oficial'
): Promise<ParsedStructuredBook> {
  const res = await fetch(`/api/materials/reader-proxy?kind=html&url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Muitas solicitações de leitura em sequência. Aguarde alguns segundos e tente novamente.');
    }
    const errBody = await res.json().catch(() => ({ error: 'Não foi possível carregar o portal oficial.' }));
    throw new Error(String((errBody as { error?: string }).error || 'Erro ao carregar página autorizada.'));
  }

  const data = (await res.json()) as ReaderProxyHtmlResponse;
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

  const mapKind = (
    k: ReaderProxyHtmlResponse['blocks'][number]['kind']
  ): StructuredReadingBlock['kind'] => {
    if (k === 'h1' || k === 'h2') return 'heading';
    if (k === 'h3') return 'subheading';
    if (k === 'li') return 'list_item';
    return 'paragraph';
  };

  // Group portal blocks into comfortable reading pages/sections (~18 blocks per unit or split by chapter)
  const units: StructuredBookUnit[] = [];
  const outline: PdfOutlineNode[] = [];
  const BLOCKS_PER_SECTION = 24;

  let currentBlocks: StructuredReadingBlock[] = [];
  let currentTitle = data.title || fallbackTitle;
  let unitCounter = 0;

  const pushUnit = () => {
    if (currentBlocks.length === 0) return;
    unitCounter += 1;
    const chapterId = `html_sec_${unitCounter}`;
    units.push({
      unitNumber: unitCounter,
      chapterId,
      title: currentTitle,
      blocks: currentBlocks,
      plainText: currentBlocks.map((b) => b.text).join('\n\n'),
    });
    outline.push({
      id: chapterId,
      title: currentTitle,
      pageNumber: unitCounter,
      children: [],
    });
    currentBlocks = [];
  };

  for (const blk of blocks) {
    const isMajorBreak = (blk.kind === 'h1' || blk.kind === 'h2') && currentBlocks.length >= 4;
    if (isMajorBreak || currentBlocks.length >= BLOCKS_PER_SECTION) {
      pushUnit();
      if (blk.kind === 'h1' || blk.kind === 'h2' || blk.kind === 'h3') {
        currentTitle = blk.text.slice(0, 140);
      } else {
        currentTitle = `${data.title || fallbackTitle} · Parte ${unitCounter + 1}`;
      }
    } else if (currentBlocks.length === 0 && (blk.kind === 'h1' || blk.kind === 'h2')) {
      currentTitle = blk.text.slice(0, 140);
    }

    currentBlocks.push({
      id: blk.id,
      kind: mapKind(blk.kind),
      text: blk.text,
    });
  }
  pushUnit();

  if (units.length === 0) {
    throw new Error('A página oficial não retornou texto legível para o leitor interno.');
  }

  return {
    sourceKind: 'html_portal',
    title: data.title || fallbackTitle,
    author: data.canonicalHost,
    units,
    outline,
    canonicalUrl: data.url,
  };
}
