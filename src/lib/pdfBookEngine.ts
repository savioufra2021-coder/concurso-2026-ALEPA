import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import {
  downloadDriveFileBuffer,
  getDriveFileMetadata,
  parseGoogleWorkspaceUrl,
} from './googleWorkspace';
import { getLocalFile } from './localFiles';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfOutlineNode {
  id: string;
  title: string;
  pageNumber: number | null;
  children: PdfOutlineNode[];
}

export interface StructuredReadingBlock {
  id: string;
  kind: 'heading' | 'subheading' | 'paragraph' | 'list_item';
  text: string;
}

export interface StructuredPageContent {
  pageNumber: number;
  blocks: StructuredReadingBlock[];
  plainText: string;
  charCount: number;
  isLikelyScanned: boolean;
}

export interface PdfSearchHit {
  id: string;
  pageNumber: number;
  snippet: string;
  matchCount: number;
}

export interface PdfInspectionResult {
  pageCount: number;
  fileSizeBytes?: number;
  textLayerStatus: 'selectable' | 'scanned' | 'mixed';
  hasOutline: boolean;
  sampleChars: number;
  metadataTitle?: string;
  metadataAuthor?: string;
  sampleSnippet?: string;
  outlineTitles?: string[];
  outlineWithPages?: Array<{ title: string; page?: number }>;
  checksumSha256?: string;
}

export interface ResolvedPdfSource {
  kind: 'data' | 'url';
  data?: Uint8Array;
  url?: string;
  fileSizeBytes?: number;
  resolvedFileName?: string;
  blobUrlForDownload?: string;
}

export class PdfSourceError extends Error {
  code: 'HTML_PORTAL' | 'AUTH_REQUIRED' | 'LOCAL_MISSING' | 'LOAD_FAILED' | 'TOO_LARGE';
  constructor(
    code: PdfSourceError['code'],
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

export function getMaterialProgressKey(materialId: string): string {
  return materialId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'material';
}

const KNOWN_HTML_PORTAL_RE =
  /^https?:\/\/(?:www\.)?(planalto\.gov\.br\/ccivil|www4\.planalto\.gov\.br|fundacaocetap\.selecao\.net\.br|bancodeleis\.alepa|escolavirtual\.gov\.br|saberes\.senado\.leg\.br|cartilha\.cert\.br|pciconcursos\.com\.br|gov\.br\/planalto|gov\.br\/arquivonacional|www2\.camara\.leg\.br|scielo\.br|educapes\.capes|oasisbr\.ibict|bdtd\.ibict)/i;

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

export function isAllowedHtmlPortalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HTML_READER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function isPdfReadableMaterial(mat: {
  url: string;
  fileType: string;
  resourceType?: string;
  fileName?: string;
}): boolean {
  const url = (mat.url || '').trim();
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  const lowerName = (mat.fileName || '').toLowerCase();

  // Explicit non-PDFs (video, audio, spreadsheets, slides, epub, html, folders)
  if (
    mat.fileType === 'video' ||
    mat.fileType === 'xlsx' ||
    mat.fileType === 'pptx' ||
    mat.fileType === 'epub' ||
    mat.fileType === 'html'
  ) {
    return false;
  }
  if (mat.resourceType === 'video' || mat.resourceType === 'podcast') return false;
  if (/\.(xlsx?|csv|pptx?|odp|mp4|mp3|m4a|wav|ogg|epub|html?)($|[?#])/i.test(lowerUrl)) return false;

  // Local uploaded PDF
  if (lowerUrl.startsWith('local://')) {
    return mat.fileType === 'pdf' || lowerName.endsWith('.pdf');
  }

  // Direct PDF path or bundled /assets/*.pdf
  if (/\.pdf($|[?#])/i.test(lowerUrl) || lowerUrl.startsWith('/assets/')) {
    return true;
  }

  // Google Drive file (not folder/sheet/slide)
  const parsedDrive = parseGoogleWorkspaceUrl(url);
  if (parsedDrive.kind === 'folder' || parsedDrive.kind === 'spreadsheet' || parsedDrive.kind === 'presentation') {
    return false;
  }
  if (parsedDrive.kind === 'drive_file') {
    return (
      mat.fileType === 'pdf' ||
      lowerName.endsWith('.pdf') ||
      (mat.fileType === 'drive' && !/\.(xlsx?|csv|pptx?|docx?|epub)$/i.test(lowerName))
    );
  }

  // External HTTP(S) catalog entries marked as PDF/livro_digital that are NOT known HTML portals
  if (
    (mat.fileType === 'pdf' || mat.resourceType === 'livro_digital') &&
    mat.resourceType !== 'questoes' &&
    mat.resourceType !== 'simulado' &&
    mat.resourceType !== 'curso' &&
    !KNOWN_HTML_PORTAL_RE.test(url)
  ) {
    return true;
  }

  return false;
}

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false;
  const searchLimit = Math.min(bytes.length - 3, 1024);
  for (let i = 0; i <= searchLimit; i += 1) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46
    ) {
      return true;
    }
  }
  return false;
}

export async function resolvePdfDocumentSource(params: {
  url: string;
  fileName?: string;
  workspaceAccessToken?: string | null;
}): Promise<ResolvedPdfSource> {
  const rawUrl = (params.url || '').trim();
  if (!rawUrl) {
    throw new PdfSourceError('LOAD_FAILED', 'Este material não possui arquivo ou link cadastrado.');
  }

  // 1. Local IndexedDB file
  if (rawUrl.startsWith('local://')) {
    const localKey = rawUrl.replace('local://', '');
    const record = await getLocalFile(localKey);
    if (!record) {
      throw new PdfSourceError(
        'LOCAL_MISSING',
        'Este PDF foi salvo localmente em outro dispositivo ou navegador. Envie o arquivo novamente ou vincule uma URL/Google Drive.'
      );
    }
    if (!record.buffer || record.buffer.byteLength === 0) {
      throw new PdfSourceError(
        'LOAD_FAILED',
        'O arquivo PDF salvo neste navegador está vazio ou corrompido. Envie o arquivo novamente.'
      );
    }
    const uint8 = new Uint8Array(record.buffer.slice(0));
    if (!hasPdfMagicBytes(uint8)) {
      throw new PdfSourceError(
        'LOAD_FAILED',
        'O arquivo salvo localmente não possui assinatura PDF válida (%PDF).'
      );
    }
    const blobUrl = URL.createObjectURL(new Blob([record.buffer], { type: 'application/pdf' }));
    return {
      kind: 'data',
      data: uint8,
      fileSizeBytes: record.buffer.byteLength,
      resolvedFileName: record.fileName,
      blobUrlForDownload: blobUrl,
    };
  }

  // 2. Same-origin bundled /assets/... PDF (supports progressive HTTP range loading)
  if (rawUrl.startsWith('/')) {
    return {
      kind: 'url',
      url: rawUrl,
      resolvedFileName: params.fileName || rawUrl.split('/').pop() || 'material.pdf',
      blobUrlForDownload: rawUrl,
    };
  }

  // 3. Google Drive file
  const parsedDrive = parseGoogleWorkspaceUrl(rawUrl);
  if (parsedDrive.kind === 'drive_file' && parsedDrive.id) {
    if (params.workspaceAccessToken) {
      try {
        const [meta, buffer] = await Promise.all([
          getDriveFileMetadata(params.workspaceAccessToken, parsedDrive.id),
          downloadDriveFileBuffer(params.workspaceAccessToken, parsedDrive.id),
        ]);
        if (!buffer || buffer.byteLength === 0) {
          throw new PdfSourceError(
            'LOAD_FAILED',
            'O arquivo retornado pelo Google Drive está vazio ou inacessível.'
          );
        }
        const uint8 = new Uint8Array(buffer.slice(0));
        if (!hasPdfMagicBytes(uint8)) {
          throw new PdfSourceError(
            'LOAD_FAILED',
            'O arquivo baixado do Google Drive não é um PDF válido.'
          );
        }
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
        return {
          kind: 'data',
          data: uint8,
          fileSizeBytes: buffer.byteLength,
          resolvedFileName: meta.name || params.fileName || 'documento.pdf',
          blobUrlForDownload: blobUrl,
        };
      } catch (err) {
        if (err instanceof PdfSourceError) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'AUTH_EXPIRED') {
          throw new PdfSourceError(
            'AUTH_REQUIRED',
            'Sua conexão com o Google Drive expirou. Reconecte sua conta Google para ler este PDF privado.'
          );
        }
        // Fallback to public proxy check below
      }
    }
  }

  // 4. Remote HTTP(S) PDF via safe server proxy (avoids browser CORS & inspects magic bytes)
  const proxyUrl = `/api/materials/pdf-proxy?url=${encodeURIComponent(rawUrl)}`;
  const probeRes = await fetch(proxyUrl, { method: 'GET' });
  if (!probeRes.ok) {
    let payload: { kind?: string; error?: string } = {};
    try {
      payload = (await probeRes.json()) as { kind?: string; error?: string };
    } catch {
      // ignore non-json error
    }

    if (probeRes.status === 429) {
      throw new PdfSourceError(
        'LOAD_FAILED',
        payload.error || 'Muitas solicitações de leitura em sequência. Aguarde alguns segundos e tente novamente.'
      );
    }

    if (payload.kind === 'html_portal' || probeRes.status === 415) {
      if (parsedDrive.kind === 'drive_file' && !params.workspaceAccessToken) {
        throw new PdfSourceError(
          'AUTH_REQUIRED',
          'Este PDF está no Google Drive com acesso restrito. Conecte seu Google Drive no botão abaixo para abrir no leitor digital.'
        );
      }
      throw new PdfSourceError(
        'HTML_PORTAL',
        payload.error || 'Este endereço abre uma página web externa em vez de um arquivo PDF direto.'
      );
    }

    if (probeRes.status === 413 || payload.kind === 'too_large') {
      throw new PdfSourceError(
        'TOO_LARGE',
        payload.error || 'Este PDF excede o limite de tamanho para leitura via proxy.'
      );
    }

    throw new PdfSourceError(
      'LOAD_FAILED',
      payload.error || `Não foi possível carregar o PDF (${probeRes.status}).`
    );
  }

  const arrBuffer = await probeRes.arrayBuffer();
  if (!arrBuffer || arrBuffer.byteLength === 0) {
    throw new PdfSourceError('LOAD_FAILED', 'O servidor retornou um arquivo PDF vazio.');
  }
  const uint8 = new Uint8Array(arrBuffer);
  if (!hasPdfMagicBytes(uint8)) {
    throw new PdfSourceError(
      'LOAD_FAILED',
      'O arquivo recebido não é um PDF válido ou está corrompido.'
    );
  }
  const blobUrl = URL.createObjectURL(new Blob([arrBuffer], { type: 'application/pdf' }));
  return {
    kind: 'data',
    data: uint8,
    fileSizeBytes: arrBuffer.byteLength,
    resolvedFileName: params.fileName || 'material.pdf',
    blobUrlForDownload: blobUrl,
  };
}

export async function loadPdfDocument(source: ResolvedPdfSource): Promise<PDFDocumentProxy> {
  const loadingTask =
    source.kind === 'url' && source.url
      ? pdfjsLib.getDocument({
          url: source.url,
          disableAutoFetch: true,
          disableStream: false,
          rangeChunkSize: 65536,
        })
      : pdfjsLib.getDocument({
          data: source.data,
          disableAutoFetch: true,
        });

  try {
    return await loadingTask.promise;
  } catch (err) {
    const errName = (err as { name?: string })?.name || '';
    if (errName === 'PasswordException') {
      throw new PdfSourceError(
        'AUTH_REQUIRED',
        'Este PDF está protegido por senha e não pode ser aberto diretamente no leitor.'
      );
    }
    if (errName === 'InvalidPDFException') {
      throw new PdfSourceError(
        'LOAD_FAILED',
        'Arquivo PDF inválido, incompleto ou corrompido.'
      );
    }
    if (errName === 'MissingPDFException') {
      throw new PdfSourceError(
        'LOAD_FAILED',
        'Arquivo PDF não encontrado no servidor ou endereço informado.'
      );
    }
    if (errName === 'UnexpectedResponseException') {
      throw new PdfSourceError(
        'LOAD_FAILED',
        'Erro de rede ou resposta inesperada ao baixar o PDF.'
      );
    }
    if (err instanceof PdfSourceError) {
      throw err;
    }
    throw new PdfSourceError(
      'LOAD_FAILED',
      err instanceof Error && err.message
        ? `Não foi possível renderizar o PDF: ${err.message}`
        : 'Não foi possível renderizar este arquivo PDF.'
    );
  }
}

async function resolveDestToPageNumber(
  pdfDoc: PDFDocumentProxy,
  dest: unknown
): Promise<number | null> {
  try {
    let resolved = dest;
    if (typeof dest === 'string') {
      resolved = await pdfDoc.getDestination(dest);
    }
    if (Array.isArray(resolved) && resolved.length > 0) {
      const ref = resolved[0];
      if (typeof ref === 'number') {
        return ref + 1;
      }
      if (ref && typeof ref === 'object') {
        const pageIndex = await pdfDoc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
        return pageIndex + 1;
      }
    }
  } catch {
    // Ignore unresolvable outline destination
  }
  return null;
}

export async function extractPdfOutline(pdfDoc: PDFDocumentProxy): Promise<PdfOutlineNode[]> {
  try {
    const rawOutline = await pdfDoc.getOutline();
    if (!rawOutline || rawOutline.length === 0) return [];

    let seq = 0;
    const convertItems = async (
      items: NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>,
      depth = 0
    ): Promise<PdfOutlineNode[]> => {
      if (depth > 4) return [];
      const result: PdfOutlineNode[] = [];
      for (const item of items.slice(0, 120)) {
        seq += 1;
        const pageNumber = item.dest ? await resolveDestToPageNumber(pdfDoc, item.dest) : null;
        const children = item.items?.length ? await convertItems(item.items, depth + 1) : [];
        result.push({
          id: `out_${seq}`,
          title: (item.title || 'Seção').trim(),
          pageNumber,
          children,
        });
      }
      return result;
    };

    return convertItems(rawOutline);
  } catch {
    return [];
  }
}

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item && 'transform' in item);
}

interface RawTextLine {
  y: number;
  xStart: number;
  fontSize: number;
  text: string;
}

function cleanPdfExtractedLine(text: string): string {
  return text
    .replace(/[\uE000-\uF8FF]/g, '') // Strip private-use icon font glyphs
    .replace(/\bBOOK-OPEN\b/g, '')
    .replace(/\bFILE-TEXT\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractStructuredPageContent(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number
): Promise<StructuredPageContent> {
  const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();

  const items = textContent.items.filter(isTextItem);
  const rawLines: RawTextLine[] = [];

  let currentLine: { y: number; xStart: number; fontSum: number; count: number; parts: string[] } | null = null;

  for (const item of items) {
    const str = item.str;
    if (!str && !item.hasEOL) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const fontH = Math.max(6, Math.abs(item.transform[3] || item.transform[0] || item.height || 11));

    const sameLine = currentLine && Math.abs(currentLine.y - y) <= Math.max(3, fontH * 0.45);
    if (!sameLine) {
      if (currentLine) {
        const joined = cleanPdfExtractedLine(currentLine.parts.join(' '));
        if (joined) {
          rawLines.push({
            y: currentLine.y,
            xStart: currentLine.xStart,
            fontSize: currentLine.fontSum / Math.max(1, currentLine.count),
            text: joined,
          });
        }
      }
      currentLine = {
        y,
        xStart: x,
        fontSum: fontH,
        count: 1,
        parts: str ? [str] : [],
      };
    } else if (currentLine) {
      if (str) {
        const prevPart = currentLine.parts[currentLine.parts.length - 1] || '';
        if (prevPart && !prevPart.endsWith(' ') && !str.startsWith(' ')) {
          currentLine.parts.push(str);
        } else {
          currentLine.parts.push(str);
        }
      }
      currentLine.fontSum += fontH;
      currentLine.count += 1;
    }

    if (item.hasEOL && currentLine) {
      const joined = cleanPdfExtractedLine(currentLine.parts.join(' '));
      if (joined) {
        rawLines.push({
          y: currentLine.y,
          xStart: currentLine.xStart,
          fontSize: currentLine.fontSum / Math.max(1, currentLine.count),
          text: joined,
        });
      }
      currentLine = null;
    }
  }

  if (currentLine) {
    const joined = cleanPdfExtractedLine(currentLine.parts.join(' '));
    if (joined) {
      rawLines.push({
        y: currentLine.y,
        xStart: currentLine.xStart,
        fontSize: currentLine.fontSum / Math.max(1, currentLine.count),
        text: joined,
      });
    }
  }

  const allText = rawLines.map((l) => l.text).join('\n').trim();
  const charCount = allText.replace(/\s+/g, '').length;

  // Determine median body font size on page to classify headings vs body
  const sortedSizes = rawLines.map((l) => l.fontSize).sort((a, b) => a - b);
  const medianSize = sortedSizes.length > 0 ? sortedSizes[Math.floor(sortedSizes.length / 2)] : 11;

  const blocks: StructuredReadingBlock[] = [];
  let paragraphBuf = '';
  let blockSeq = 0;

  const flushParagraph = () => {
    const clean = paragraphBuf.replace(/\s+/g, ' ').trim();
    if (clean) {
      blockSeq += 1;
      blocks.push({
        id: `b_${pageNumber}_${blockSeq}`,
        kind: 'paragraph',
        text: clean,
      });
    }
    paragraphBuf = '';
  };

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    const prev = i > 0 ? rawLines[i - 1] : null;
    const text = line.text;

    const isBullet = /^([•●◦▪▫\-–*]|\d+[.)]|[a-zA-Z][.)]|(?:Art\.|ART\.|§|Parágrafo)\s*\d+)/.test(text);
    const isLargerFont = line.fontSize >= medianSize * 1.24 && text.length <= 130;
    const isMediumHeading =
      line.fontSize >= medianSize * 1.1 &&
      text.length <= 90 &&
      !/[.,;]$/.test(text);
    const isUpperShortHeading =
      text.length >= 4 &&
      text.length <= 80 &&
      text === text.toUpperCase() &&
      /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(text);

    if (isLargerFont || isUpperShortHeading) {
      flushParagraph();
      blockSeq += 1;
      blocks.push({
        id: `b_${pageNumber}_${blockSeq}`,
        kind: 'heading',
        text,
      });
      continue;
    }

    if (isMediumHeading) {
      flushParagraph();
      blockSeq += 1;
      blocks.push({
        id: `b_${pageNumber}_${blockSeq}`,
        kind: 'subheading',
        text,
      });
      continue;
    }

    if (isBullet) {
      flushParagraph();
      blockSeq += 1;
      blocks.push({
        id: `b_${pageNumber}_${blockSeq}`,
        kind: 'list_item',
        text,
      });
      continue;
    }

    const verticalGap = prev ? Math.abs(prev.y - line.y) : 0;
    const bigGap = prev && verticalGap > medianSize * 2.1;
    const prevEndedSentence = prev && /[.!?:]$/.test(prev.text) && prev.text.length < 75;

    if (bigGap || prevEndedSentence) {
      flushParagraph();
    }

    if (paragraphBuf.endsWith('-') && !paragraphBuf.endsWith(' -')) {
      paragraphBuf = `${paragraphBuf.slice(0, -1)}${text}`;
    } else if (paragraphBuf) {
      paragraphBuf = `${paragraphBuf} ${text}`;
    } else {
      paragraphBuf = text;
    }
  }

  flushParagraph();

  // Check if page is likely scanned (very little selectable text + image operators)
  let isLikelyScanned = charCount < 45;
  if (isLikelyScanned) {
    try {
      const opList = await page.getOperatorList();
      const hasImageOp = opList.fnArray.some(
        (fn) =>
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject
      );
      isLikelyScanned = hasImageOp || charCount < 20;
    } catch {
      isLikelyScanned = charCount < 25;
    }
  }

  page.cleanup();

  return {
    pageNumber,
    blocks,
    plainText: allText,
    charCount,
    isLikelyScanned,
  };
}

export async function searchPdfDocument(
  pdfDoc: PDFDocumentProxy,
  rawQuery: string,
  textCache: Map<number, string>,
  signal?: AbortSignal
): Promise<PdfSearchHit[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: PdfSearchHit[] = [];
  const total = pdfDoc.numPages;

  for (let p = 1; p <= total; p += 1) {
    if (signal?.aborted) break;

    let pageText = textCache.get(p);
    if (pageText === undefined) {
      const page = await pdfDoc.getPage(p);
      const tc = await page.getTextContent();
      pageText = tc.items
        .filter(isTextItem)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      textCache.set(p, pageText);
      page.cleanup();
    }

    const lower = pageText.toLowerCase();
    const firstIdx = lower.indexOf(q);
    if (firstIdx !== -1) {
      let count = 0;
      let pos = firstIdx;
      while (pos !== -1) {
        count += 1;
        pos = lower.indexOf(q, pos + q.length);
      }
      const start = Math.max(0, firstIdx - 45);
      const end = Math.min(pageText.length, firstIdx + q.length + 75);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < pageText.length ? '...' : '';
      hits.push({
        id: `hit_${p}`,
        pageNumber: p,
        snippet: `${prefix}${pageText.slice(start, end)}${suffix}`,
        matchCount: count,
      });
    }

    if (hits.length >= 60) break;
  }

  return hits;
}

export async function inspectPdfMetadata(params: {
  url?: string;
  file?: File;
  workspaceAccessToken?: string | null;
}): Promise<PdfInspectionResult> {
  let source: ResolvedPdfSource;
  let sourceDataCopy: Uint8Array | undefined;
  if (params.file) {
    const buffer = await params.file.arrayBuffer();
    sourceDataCopy = new Uint8Array(buffer);
    source = {
      kind: 'data',
      data: sourceDataCopy,
      fileSizeBytes: buffer.byteLength,
      resolvedFileName: params.file.name,
    };
  } else if (params.url) {
    source = await resolvePdfDocumentSource({
      url: params.url,
      workspaceAccessToken: params.workspaceAccessToken,
    });
    if (source.data) {
      sourceDataCopy = source.data;
    }
  } else {
    throw new PdfSourceError('LOAD_FAILED', 'Informe um arquivo ou URL PDF para inspeção.');
  }

  let checksumSha256: string | undefined;
  if (sourceDataCopy && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const copy = new Uint8Array(sourceDataCopy.byteLength);
      copy.set(sourceDataCopy);
      const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
      checksumSha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      checksumSha256 = undefined;
    }
  }

  const pdfDoc = await loadPdfDocument(source);
  try {
    const pageCount = pdfDoc.numPages;
    const outline = await pdfDoc.getOutline().catch(() => null);
    const meta = await pdfDoc.getMetadata().catch(() => null);
    const infoObj = (meta?.info || {}) as { Title?: unknown; Author?: unknown };
    const metadataTitle =
      typeof infoObj.Title === 'string' && infoObj.Title.trim() ? infoObj.Title.trim() : undefined;
    const metadataAuthor =
      typeof infoObj.Author === 'string' && infoObj.Author.trim() ? infoObj.Author.trim() : undefined;

    const samplePages = new Set<number>([1]);
    if (pageCount >= 2) samplePages.add(2);
    if (pageCount >= 3) samplePages.add(Math.min(pageCount, Math.ceil(pageCount / 2)));
    if (pageCount >= 4) samplePages.add(pageCount);

    let scannedCount = 0;
    let selectableCount = 0;
    let sampleChars = 0;
    const snippetParts: string[] = [];

    for (const p of samplePages) {
      const content = await extractStructuredPageContent(pdfDoc, p);
      sampleChars += content.charCount;
      if (content.plainText && snippetParts.join(' ').length < 1800) {
        snippetParts.push(`[Pág. ${p}] ${content.plainText.slice(0, 750)}`);
      }
      if (content.isLikelyScanned) scannedCount += 1;
      else selectableCount += 1;
    }

    const textLayerStatus: PdfInspectionResult['textLayerStatus'] =
      selectableCount > 0 && scannedCount === 0
        ? 'selectable'
        : selectableCount === 0 && scannedCount > 0
          ? 'scanned'
          : 'mixed';

    const outlineTitles = Array.isArray(outline)
      ? outline
          .map((node) => (typeof node?.title === 'string' ? node.title.trim() : ''))
          .filter(Boolean)
          .slice(0, 15)
      : undefined;

    const outlineWithPages: Array<{ title: string; page?: number }> = [];
    if (outline && outline.length > 0) {
      const outlineNodes = await extractPdfOutline(pdfDoc);
      const flattenNodes = (nodes: PdfOutlineNode[]) => {
        for (const n of nodes) {
          if (outlineWithPages.length >= 30) break;
          if (n.title) {
            outlineWithPages.push({ title: n.title, page: n.pageNumber ?? undefined });
          }
          if (n.children?.length) flattenNodes(n.children);
        }
      };
      flattenNodes(outlineNodes);
    }

    return {
      pageCount,
      fileSizeBytes: source.fileSizeBytes,
      textLayerStatus,
      hasOutline: Boolean(outline && outline.length > 0),
      sampleChars,
      metadataTitle,
      metadataAuthor,
      sampleSnippet: snippetParts.join('\n\n').slice(0, 2200) || undefined,
      outlineTitles: outlineTitles?.length ? outlineTitles : undefined,
      outlineWithPages: outlineWithPages.length ? outlineWithPages : undefined,
      checksumSha256,
    };
  } finally {
    await pdfDoc.loadingTask.destroy();
    if (source.blobUrlForDownload && source.blobUrlForDownload.startsWith('blob:')) {
      URL.revokeObjectURL(source.blobUrlForDownload);
    }
  }
}
