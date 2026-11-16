import { apiFetch } from './apiClient';
import { classifyMaterialOpeningMode, loadAndParseEpub, loadAndParseHtmlPortal } from './epubAndHtmlEngine';
import {
  extractPdfOutline,
  extractStructuredPageContent,
  loadPdfDocument,
  resolvePdfDocumentSource,
} from './pdfBookEngine';
import type {
  DocumentIndexChunk,
  DocumentIndexMeta,
  DocumentSearchHit,
  LibraryScope,
  StudyMaterial,
} from '../types';

const DB_NAME = 'campus_alepa_doc_index_v1';
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_META = 'meta';

// In-memory fallback when IndexedDB is unavailable (Vitest / restricted private mode)
const memoryMetaStore = new Map<string, DocumentIndexMeta>();
const memoryChunkStore = new Map<string, DocumentIndexChunk[]>();

const PT_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'entre',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por',
  'que', 'se', 'sem', 'sobre', 'sua', 'suas', 'seu', 'seus', 'um', 'uma', 'uns', 'umas',
]);

// Legal & Edital Synonyms (expands terminology differences between edital and books/laws)
export const LEGAL_EDITAL_SYNONYM_GROUPS: string[][] = [
  ['limpe', 'principios administrativos', 'legalidade impessoalidade moralidade publicidade eficiencia', 'artigo 37', 'art 37'],
  ['ato administrativo', 'atos administrativos', 'atributos presuncao legitimidade imperatividade autoexecutoriedade', 'competencia finalidade forma motivo objeto'],
  ['processo legislativo', 'emenda constitucional', 'lei complementar', 'lei ordinaria', 'medida provisoria', 'decreto legislativo', 'resolucao'],
  ['regimento interno', 'mesa diretora', 'comissoes', 'plenario', 'sessao legislativa', 'quorum', 'alepa'],
  ['estatuto dos servidores', 'regime juridico unico', 'rju', 'lei estadual 5810', '5810 1994', 'provimento vacancia posse exercicio'],
  ['etica', 'improbidade administrativa', 'lei 8429', 'decoro parlamentar', 'responsabilidade servidor'],
  ['licitacao', 'contratos administrativos', 'lei 14133', 'pregao', 'dispensa inexigibilidade'],
  ['crase', 'acento grave', 'regencia verbal', 'regencia nominal'],
  ['concordancia verbal', 'concordancia nominal', 'sujeito composto', 'sintaxe'],
  ['pontuacao', 'virgula', 'ponto e virgula', 'oracoes subordinadas', 'coordenadas'],
  ['arquivologia', 'gestao de documentos', 'ciclo vital', 'arquivo corrente intermediario permanente', 'tabela de temporalidade'],
  ['redacao oficial', 'manual de redacao', 'oficio', 'memorando', 'pronome de tratamento', 'vossa excelencia'],
  ['seguranca da informacao', 'phishing', 'ransomware', 'malware', 'autenticacao', 'cartilha cert', 'backup'],
  ['raciocinio logico', 'proposicoes', 'tabela verdade', 'equivalencia logica', 'negacao', 'conjuncao disjuncao'],
];

export function normalizeForIndex(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeForIndex(raw: string): string[] {
  const normalized = normalizeForIndex(raw);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .filter((t) => t.length >= 2 && !PT_STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

function expandQueryWithSynonyms(normalizedQuery: string, tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const group of LEGAL_EDITAL_SYNONYM_GROUPS) {
    const groupHits = group.some(
      (phrase) => normalizedQuery.includes(phrase) || tokens.some((t) => phrase.includes(t) && t.length >= 4)
    );
    if (groupHits) {
      for (const phrase of group) {
        tokenizeForIndex(phrase).forEach((t) => expanded.add(t));
      }
    }
  }
  tokens.forEach((t) => expanded.delete(t));
  return Array.from(expanded);
}

function openIndexDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'materialId' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkId' });
        store.createIndex('by_materialId', 'materialId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir índice documental'));
  });
}

export async function saveMaterialIndex(
  meta: DocumentIndexMeta,
  chunks: DocumentIndexChunk[]
): Promise<void> {
  memoryMetaStore.set(meta.materialId, meta);
  memoryChunkStore.set(meta.materialId, chunks);

  try {
    const db = await openIndexDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
      tx.objectStore(STORE_META).put(meta);

      const chunkStore = tx.objectStore(STORE_CHUNKS);
      const idx = chunkStore.index('by_materialId');
      const existingKeysReq = idx.getAllKeys(meta.materialId);
      existingKeysReq.onsuccess = () => {
        const keys = existingKeysReq.result || [];
        keys.forEach((k) => chunkStore.delete(k));
        chunks.forEach((ch) => chunkStore.put(ch));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Keep in-memory fallback silently if IndexedDB is blocked
  }
}

export async function getAllIndexedMetas(): Promise<DocumentIndexMeta[]> {
  try {
    const db = await openIndexDb();
    const list = await new Promise<DocumentIndexMeta[]>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => resolve((req.result as DocumentIndexMeta[]) || []);
      req.onerror = () => reject(req.error);
    });
    list.forEach((m) => memoryMetaStore.set(m.materialId, m));
    return list;
  } catch {
    return Array.from(memoryMetaStore.values());
  }
}

export async function getAllIndexedChunks(): Promise<DocumentIndexChunk[]> {
  try {
    const db = await openIndexDb();
    const list = await new Promise<DocumentIndexChunk[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const req = tx.objectStore(STORE_CHUNKS).getAll();
      req.onsuccess = () => resolve((req.result as DocumentIndexChunk[]) || []);
      req.onerror = () => reject(req.error);
    });
    return list;
  } catch {
    return Array.from(memoryChunkStore.values()).flat();
  }
}

export async function getChunksForMaterial(materialId: string): Promise<DocumentIndexChunk[]> {
  if (memoryChunkStore.has(materialId)) {
    return memoryChunkStore.get(materialId) || [];
  }
  try {
    const db = await openIndexDb();
    const list = await new Promise<DocumentIndexChunk[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const req = tx.objectStore(STORE_CHUNKS).index('by_materialId').getAll(materialId);
      req.onsuccess = () => resolve((req.result as DocumentIndexChunk[]) || []);
      req.onerror = () => reject(req.error);
    });
    memoryChunkStore.set(materialId, list);
    return list;
  } catch {
    return [];
  }
}

export function buildCatalogFallbackChunks(material: StudyMaterial): DocumentIndexChunk[] {
  const chunks: DocumentIndexChunk[] = [];
  if (Array.isArray(material.chapters) && material.chapters.length > 0) {
    material.chapters.forEach((ch, idx) => {
      const text = [ch.title, ch.summary, ch.description, (ch.topics || []).join(', '), ch.notes]
        .filter(Boolean)
        .join(' — ')
        .trim();
      if (!text) return;
      const verifiedPage = typeof ch.startPage === 'number' && ch.startPage >= 1 ? ch.startPage : undefined;
      chunks.push({
        chunkId: `${material.id}__chap_${idx + 1}`,
        materialId: material.id,
        materialTitle: material.title,
        disciplineId: material.disciplineId,
        campusLevel: material.campusLevel,
        sourceKind: 'chapters',
        pageNumber: verifiedPage,
        chapterId: ch.id,
        chapterTitle: ch.title,
        text: text.slice(0, 1200),
        normalizedText: normalizeForIndex(text),
        tokens: tokenizeForIndex(text),
      });
    });
  } else {
    const summaryText = [material.title, material.subtitle, material.editalTopic, material.description, (material.keywords || []).join(', ')]
      .filter(Boolean)
      .join(' — ')
      .trim();
    if (summaryText) {
      chunks.push({
        chunkId: `${material.id}__meta_1`,
        materialId: material.id,
        materialTitle: material.title,
        disciplineId: material.disciplineId,
        campusLevel: material.campusLevel,
        sourceKind: 'chapters',
        chapterTitle: material.editalTopic || material.title,
        text: summaryText.slice(0, 1200),
        normalizedText: normalizeForIndex(summaryText),
        tokens: tokenizeForIndex(summaryText),
      });
    }
  }
  return chunks;
}

export async function indexMaterialDocument(params: {
  material: StudyMaterial;
  workspaceAccessToken?: string | null;
  maxPdfPages?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ meta: DocumentIndexMeta; chunks: DocumentIndexChunk[] }> {
  const { material, workspaceAccessToken } = params;
  if (material.pendingDefinition) {
    throw new Error('Material com definição pendente aguardando confirmação antes da indexação.');
  }

  const mode = classifyMaterialOpeningMode(material);
  const chunks: DocumentIndexChunk[] = [];
  let sourceKind: DocumentIndexMeta['sourceKind'] = 'chapters';
  let totalUnits = 0;

  if (mode === 'pdf') {
    const source = await resolvePdfDocumentSource({
      url: material.url,
      fileName: material.fileName,
      workspaceAccessToken,
    });
    const pdfDoc = await loadPdfDocument(source);
    try {
      const outline = await extractPdfOutline(pdfDoc);
      const pageChapterMap = new Map<number, string>();
      outline.forEach((node) => {
        if (node.pageNumber) pageChapterMap.set(node.pageNumber, node.title);
      });

      const maxPages = Math.min(pdfDoc.numPages, params.maxPdfPages ?? 180);
      totalUnits = pdfDoc.numPages;
      sourceKind = 'pdf';

      let currentChapter: string | undefined;
      for (let p = 1; p <= maxPages; p++) {
        if (pageChapterMap.has(p)) {
          currentChapter = pageChapterMap.get(p);
        }
        const pageContent = await extractStructuredPageContent(pdfDoc, p);
        params.onProgress?.(p, maxPages);
        const text = pageContent.plainText.trim();
        if (text.length < 15) continue;

        const headingBlock = pageContent.blocks.find((b) => b.kind === 'heading' || b.kind === 'subheading');
        chunks.push({
          chunkId: `${material.id}__p${p}`,
          materialId: material.id,
          materialTitle: material.title,
          disciplineId: material.disciplineId,
          campusLevel: material.campusLevel,
          sourceKind: 'pdf',
          pageNumber: p,
          chapterTitle: currentChapter || headingBlock?.text?.slice(0, 120),
          sectionTitle: headingBlock?.text?.slice(0, 120),
          text: text.slice(0, 2000),
          normalizedText: normalizeForIndex(text),
          tokens: tokenizeForIndex(text),
        });
      }
    } finally {
      await pdfDoc.loadingTask.destroy();
      if (source.blobUrlForDownload && source.blobUrlForDownload.startsWith('blob:')) {
        URL.revokeObjectURL(source.blobUrlForDownload);
      }
    }
  } else if (mode === 'epub' || mode === 'html_portal') {
    const parsed =
      mode === 'epub'
        ? await loadAndParseEpub({
            url: material.url,
            fileName: material.fileName,
            title: material.title,
            workspaceAccessToken,
          })
        : await loadAndParseHtmlPortal(material.url, material.title);

    sourceKind = parsed.sourceKind;
    totalUnits = parsed.units.length;
    parsed.units.forEach((unit, idx) => {
      params.onProgress?.(idx + 1, parsed.units.length);
      if (unit.plainText.trim().length < 15) return;
      chunks.push({
        chunkId: `${material.id}__u${unit.unitNumber}`,
        materialId: material.id,
        materialTitle: material.title,
        disciplineId: material.disciplineId,
        campusLevel: material.campusLevel,
        sourceKind: parsed.sourceKind,
        pageNumber: unit.unitNumber,
        chapterId: unit.chapterId,
        chapterTitle: unit.title,
        text: unit.plainText.slice(0, 2200),
        normalizedText: normalizeForIndex(unit.plainText),
        tokens: tokenizeForIndex(unit.plainText),
      });
    });

    if (parsed.blobUrlForDownload && parsed.blobUrlForDownload.startsWith('blob:')) {
      URL.revokeObjectURL(parsed.blobUrlForDownload);
    }
  } else {
    const fallback = buildCatalogFallbackChunks(material);
    chunks.push(...fallback);
    totalUnits = fallback.length;
  }

  const meta: DocumentIndexMeta = {
    materialId: material.id,
    materialTitle: material.title,
    disciplineId: material.disciplineId,
    campusLevel: material.campusLevel,
    sourceKind,
    totalUnits,
    chunkCount: chunks.length,
    indexedAt: new Date().toISOString(),
    status: chunks.length > 0 ? (sourceKind === 'pdf' && totalUnits > (params.maxPdfPages ?? 180) ? 'partial' : 'indexed') : 'partial',
  };

  await saveMaterialIndex(meta, chunks);
  return { meta, chunks };
}

export function searchChunksLexical(
  rawQuery: string,
  chunks: DocumentIndexChunk[],
  options?: {
    disciplineId?: string;
    campusLevel?: LibraryScope;
    materialId?: string;
    limit?: number;
  }
): DocumentSearchHit[] {
  const normalizedQuery = normalizeForIndex(rawQuery);
  const queryTokens = tokenizeForIndex(rawQuery);
  if (!normalizedQuery || queryTokens.length === 0) return [];

  const synonymTokens = expandQueryWithSynonyms(normalizedQuery, queryTokens);
  const hits: DocumentSearchHit[] = [];

  for (const chunk of chunks) {
    if (options?.materialId && chunk.materialId !== options.materialId) continue;
    if (options?.disciplineId && chunk.disciplineId !== options.disciplineId && chunk.disciplineId !== 'geral') {
      continue;
    }
    if (
      options?.campusLevel &&
      options.campusLevel !== 'geral' &&
      chunk.campusLevel &&
      chunk.campusLevel !== 'geral' &&
      chunk.campusLevel !== options.campusLevel
    ) {
      continue;
    }

    const tokenSet = new Set(chunk.tokens);
    let score = 0;
    const matchedTerms: string[] = [];

    if (chunk.normalizedText.includes(normalizedQuery)) {
      score += 65;
      matchedTerms.push(rawQuery.trim());
    }

    for (const qt of queryTokens) {
      if (tokenSet.has(qt)) {
        score += 18;
        matchedTerms.push(qt);
      } else if (chunk.normalizedText.includes(qt)) {
        score += 10;
        matchedTerms.push(qt);
      }
    }

    let synHits = 0;
    for (const st of synonymTokens) {
      if (tokenSet.has(st) || chunk.normalizedText.includes(st)) {
        score += 9;
        synHits += 1;
        if (matchedTerms.length < 6) matchedTerms.push(st);
      }
    }

    if (chunk.chapterTitle && normalizeForIndex(chunk.chapterTitle).includes(normalizedQuery)) {
      score += 20;
    }

    if (score >= 16) {
      hits.push({
        chunk,
        score,
        matchStage: matchedTerms.length > 0 && synHits === 0 ? 'exact' : 'synonym',
        matchedTerms: Array.from(new Set(matchedTerms)).slice(0, 6),
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, options?.limit ?? 12);
}

export async function searchDocumentIndexWithFallback(params: {
  query: string;
  materials?: StudyMaterial[];
  disciplineId?: string;
  campusLevel?: LibraryScope;
  materialId?: string;
  useSemanticAi?: boolean;
  limit?: number;
}): Promise<DocumentSearchHit[]> {
  let chunks = await getAllIndexedChunks();

  // Include lightweight catalog fallback chunks for unindexed non-pending materials
  if (params.materials && params.materials.length > 0) {
    const indexedMaterialIds = new Set(chunks.map((c) => c.materialId));
    const fallbackChunks = params.materials
      .filter((m) => !m.pendingDefinition && !indexedMaterialIds.has(m.id))
      .flatMap(buildCatalogFallbackChunks);
    chunks = [...chunks, ...fallbackChunks];
  }

  const lexicalHits = searchChunksLexical(params.query, chunks, {
    disciplineId: params.disciplineId,
    campusLevel: params.campusLevel,
    materialId: params.materialId,
    limit: params.limit ?? 12,
  });

  if (lexicalHits.length >= 3 || !params.useSemanticAi) {
    return lexicalHits;
  }

  // Stage 4: Gemini Semantic Rerank over real candidate chunks (never fabricates pages/chunks)
  const scopedChunks = chunks
    .filter((c) => (!params.disciplineId || c.disciplineId === params.disciplineId || c.disciplineId === 'geral'))
    .slice(0, 20);

  if (scopedChunks.length === 0) return lexicalHits;

  try {
    const res = await apiFetch('/api/ai/semantic-index-search', {
      method: 'POST',
      body: JSON.stringify({
        query: params.query,
        campus: params.campusLevel === 'medio' ? 'medio' : 'superior',
        candidates: scopedChunks.map((c) => ({
          chunkId: c.chunkId,
          materialId: c.materialId,
          materialTitle: c.materialTitle,
          pageNumber: c.pageNumber,
          chapterTitle: c.chapterTitle,
          excerpt: c.text.slice(0, 500),
        })),
      }),
    });

    if (!res.ok) return lexicalHits;
    const data = (await res.json()) as {
      matches?: Array<{ chunkId: string; relevanceScore: number; reason: string }>;
    };

    const chunkMap = new Map(scopedChunks.map((c) => [c.chunkId, c]));
    const semanticHits: DocumentSearchHit[] = [];
    for (const m of data.matches || []) {
      const realChunk = chunkMap.get(m.chunkId);
      if (!realChunk) continue;
      semanticHits.push({
        chunk: realChunk,
        score: m.relevanceScore,
        matchStage: 'semantic',
        matchedTerms: tokenizeForIndex(params.query).slice(0, 4),
        reason: m.reason,
      });
    }

    const merged = new Map<string, DocumentSearchHit>();
    lexicalHits.forEach((h) => merged.set(h.chunk.chunkId, h));
    semanticHits.forEach((h) => {
      if (!merged.has(h.chunk.chunkId)) merged.set(h.chunk.chunkId, h);
    });

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit ?? 12);
  } catch {
    return lexicalHits;
  }
}
