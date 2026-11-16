#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const AISTUDIO_DIR = path.join(ROOT_DIR, 'public', 'assets', 'aistudio');
const OUT_TS_PATH = path.join(ROOT_DIR, 'src', 'data', 'apostilaMap.ts');
const OUT_REPORT_PATH = path.join(ROOT_DIR, 'apostilaMap.report.md');
const FIREBASE_CONFIG_PATH = path.join(ROOT_DIR, 'firebase-applet-config.json');

// ---------------------------------------------------------------------------
// 1. Load Syllabuses and Existing Material Registry cleanly via esbuild
// ---------------------------------------------------------------------------
function loadProjectData() {
  const result = esbuild.buildSync({
    stdin: {
      contents: `
        export { ALEPA_DISCIPLINES } from './src/data/alepaSyllabus';
        export { ALL_MEDIO_DISCIPLINES, MEDIO_CARGOS, getMedioDisciplines } from './src/data/alepaMedioSyllabus';
        export { MEDIO_DEFAULT_MATERIALS } from './src/data/alepaMedioLibrary';
        export { DEFAULT_STUDY_MATERIALS } from './src/data/alepaQuestions';
        export { GERAL_DEFAULT_MATERIALS } from './src/data/alepaGeneralLibrary';
      `,
      resolveDir: ROOT_DIR,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'cjs',
    logLevel: 'silent',
  });

  const mod = { exports: {} };
  const fn = new Function('exports', 'module', result.outputFiles[0].text);
  fn(mod.exports, mod);
  return mod.exports;
}

// ---------------------------------------------------------------------------
// 2. Normalization and Similarity Helpers
// ---------------------------------------------------------------------------
const PT_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'ate', 'com', 'como', 'da', 'das', 'de', 'do', 'dos',
  'e', 'em', 'entre', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela',
  'pelas', 'pelo', 'pelos', 'por', 'que', 'se', 'sem', 'sobre', 'sua', 'suas',
  'seu', 'seus', 'um', 'uma', 'uns', 'umas',
]);

// Generic heading fillers that shouldn't carry strong matching weight on their own
const GENERIC_HEADING_TOKENS = new Set([
  'nocoes', 'basicas', 'basico', 'conceito', 'conceitos', 'geral', 'gerais',
  'introducao', 'fundamento', 'fundamentos', 'aspecto', 'aspectos',
  'caracteristicas', 'tipos', 'natureza', 'finalidades', 'criterios',
  'formas', 'principais', 'tema', 'temas', 'modulo', 'unidade',
  'aplicada', 'aplicado', 'oficial', 'plataforma', 'pa', 'paraense', 'republica',
]);

function normalizeText(raw) {
  return String(raw || '')
    .replace(/(\d+)\.(\d+)/g, '$1$2')
    .replace(/\bn[º°o]\s*/gi, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\blc\b/g, 'lei complementar')
    .replace(/\brju\b/g, 'regime juridico unico')
    .replace(/\bcf(?:\s*\/?\s*88)?\b/g, 'constituicao federal')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemPtToken(token) {
  if (token.length <= 4) return token;
  if (/(?:mais|dois|tres|pais|apos|atras|meses)$/.test(token)) return token;
  if (token.endsWith('coes')) return `${token.slice(0, -4)}cao`;
  if (token.endsWith('soes')) return `${token.slice(0, -4)}sao`;
  if (token.endsWith('oes')) return `${token.slice(0, -3)}ao`;
  if (token.endsWith('ais')) return `${token.slice(0, -3)}al`;
  if (token.endsWith('eis')) return `${token.slice(0, -3)}el`;
  if (token.endsWith('ores')) return `${token.slice(0, -2)}`;
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokenize(raw, { dropGeneric = true } = {}) {
  const norm = normalizeText(raw);
  if (!norm) return [];
  return Array.from(
    new Set(
      norm
        .split(' ')
        .filter((t) => t.length >= 2 && !PT_STOPWORDS.has(t) && (!dropGeneric || !GENERIC_HEADING_TOKENS.has(t)))
        .map(stemPtToken)
    )
  );
}

function splitCandidateSegments(text) {
  const raw = String(text || '');
  const parts = raw
    .split(/[;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  return parts.length > 1 ? [raw, ...parts] : [raw];
}

// Compatible section -> discipline hints to prevent absurd cross-domain ties
// while still allowing cross-listed topics (e.g. Orçamento -> Direito Financeiro, Processo Legislativo -> processo_legislativo)
function getSectionCompatibilityBonus(parentSectionTitle, disciplineId) {
  const sec = normalizeText(parentSectionTitle);
  if (!sec) return 0;

  const isSec = (kw) => sec.includes(kw);

  if (isSec('lingua portuguesa')) {
    return disciplineId === 'portugues' || disciplineId === 'nm_portugues' ? 0.14 : -0.25;
  }
  if (isSec('informatica')) {
    return disciplineId === 'informatica' || disciplineId === 'nm_informatica' ? 0.14 : -0.25;
  }
  if (isSec('raciocinio logico')) {
    return disciplineId === 'raciocinio_logico' || disciplineId === 'nm_raciocinio_logico' ? 0.14 : -0.25;
  }
  if (isSec('direito administrativo')) {
    if (
      disciplineId === 'direito_administrativo' ||
      disciplineId === 'nm_01_04_administrativo' ||
      disciplineId === 'direito_financeiro'
    ) {
      return 0.12;
    }
    return -0.22;
  }
  if (isSec('administracao publica')) {
    if (
      disciplineId === 'administracao_gestao' ||
      disciplineId === 'nm_04_administracao_publica' ||
      disciplineId === 'direito_administrativo' ||
      disciplineId === 'nm_01_04_administrativo' ||
      disciplineId === 'juridicas_complementares'
    ) {
      return 0.12;
    }
    return -0.22;
  }
  if (isSec('direito constitucional')) {
    if (disciplineId === 'direito_constitucional' || disciplineId === 'nm_01_04_constitucional') {
      return 0.14;
    }
    if (disciplineId === 'processo_legislativo') {
      return 0.04;
    }
    return -0.22;
  }
  if (isSec('arquivologia')) {
    if (disciplineId === 'nm_04_arquivologia' || disciplineId === 'juridicas_complementares') {
      return 0.14;
    }
    return -0.25;
  }
  if (isSec('recursos materiais')) {
    if (
      disciplineId === 'nm_04_recursos_materiais' ||
      disciplineId === 'administracao_gestao' ||
      disciplineId === 'juridicas_complementares' ||
      disciplineId === 'nm_03_climatizacao_seguranca_patrimonio'
    ) {
      return 0.12;
    }
    return -0.22;
  }
  if (isSec('tecnica legislativa')) {
    if (disciplineId === 'processo_legislativo' || disciplineId === 'nm_01_04_tecnica_legislativa') {
      return 0.14;
    }
    return -0.22;
  }
  if (isSec('basicas de secretaria')) {
    if (
      disciplineId === 'nm_04_secretaria' ||
      disciplineId === 'nm_04_arquivologia' ||
      disciplineId === 'nm_04_administracao_publica' ||
      disciplineId === 'nm_portugues' ||
      disciplineId === 'juridicas_complementares' ||
      disciplineId === 'administracao_gestao' ||
      disciplineId === 'portugues'
    ) {
      return 0.1;
    }
    return -0.2;
  }
  if (isSec('etica e conduta')) {
    return disciplineId === 'legislacao_etica' || disciplineId === 'nm_legislacao_etica' ? 0.14 : -0.25;
  }
  if (isSec('legislacao')) {
    if (
      disciplineId === 'legislacao_etica' ||
      disciplineId === 'nm_legislacao_etica' ||
      disciplineId === 'direito_administrativo' ||
      disciplineId === 'nm_01_04_administrativo' ||
      disciplineId === 'processo_legislativo' ||
      disciplineId === 'nm_01_04_tecnica_legislativa' ||
      disciplineId === 'nm_04_arquivologia' ||
      disciplineId === 'juridicas_complementares'
    ) {
      return 0.08;
    }
    return -0.22;
  }

  return 0;
}

function scoreMarkerAgainstText(markerVariants, candidateText) {
  const candNorm = normalizeText(candidateText);
  const candTokensAll = tokenize(candidateText, { dropGeneric: false });
  const candTokens = tokenize(candidateText, { dropGeneric: true });
  if (candTokens.length === 0 && candTokensAll.length === 0) return 0;

  let best = 0;

  for (const variant of markerVariants) {
    const mNorm = normalizeText(variant);
    if (!mNorm) continue;

    const mTokens = tokenize(variant, { dropGeneric: true });
    const mTokensActive = mTokens.length > 0 ? mTokens : tokenize(variant, { dropGeneric: false });
    const cTokensActive = candTokens.length > 0 ? candTokens : candTokensAll;
    if (mTokensActive.length === 0 || cTokensActive.length === 0) continue;

    const cSet = new Set(cTokensActive);
    const shared = mTokensActive.filter((t) => cSet.has(t));
    if (shared.length === 0) continue;

    const precision = shared.length / mTokensActive.length;
    const recall = shared.length / cTokensActive.length;
    const f1 = (2 * precision * recall) / (precision + recall);

    // Weighted blend emphasizing marker coverage + balanced F1
    let score = 0.55 * precision + 0.45 * f1;

    // Exact phrase containment bonus (only when both sides carry meaningful multi-word signal)
    const significantCandPhrase =
      candNorm.length >= 10 &&
      (cTokensActive.length >= 2 || mTokensActive.length <= 2) &&
      cTokensActive.length >= Math.ceil(mTokensActive.length * 0.4);
    if (mNorm.length >= 6 && (candNorm.includes(mNorm) || (significantCandPhrase && mNorm.includes(candNorm)))) {
      score = Math.max(score, 0.72 + 0.18 * precision);
    }

    // Specific law number match bonus (e.g. 13709, 14133, 5810, 8429, 12846, 11129, 8159, 95)
    const lawNumbers = shared.filter((t) => /^\d{2,5}$/.test(t));
    if (lawNumbers.length > 0) {
      score += Math.min(0.18, lawNumbers.length * 0.12);
    }

    if (score > best) best = score;
  }

  return Math.min(1, best);
}

function scoreMarkerAgainstTopic(markerTitle, parentSectionTitle, topic, discipline) {
  const colonIdx = markerTitle.indexOf(':');
  const markerVariants = [markerTitle];
  if (colonIdx > 4) {
    markerVariants.push(markerTitle.slice(0, colonIdx).trim());
    markerVariants.push(markerTitle.slice(colonIdx + 1).trim());
  }
  const parenStripped = markerTitle.replace(/\([^)]*\)/g, '').trim();
  if (parenStripped && parenStripped !== markerTitle) {
    markerVariants.push(parenStripped);
  }

  // Compare against topic title
  let bestSegmentScore = 0;
  for (const seg of splitCandidateSegments(topic.title)) {
    const s = scoreMarkerAgainstText(markerVariants, seg);
    if (s > bestSegmentScore) bestSegmentScore = s;
  }

  // Compare against each subtopic (and its `;`-separated clauses)
  for (const sub of topic.subtopics || []) {
    for (const seg of splitCandidateSegments(sub)) {
      const s = scoreMarkerAgainstText(markerVariants, seg);
      if (s > bestSegmentScore) bestSegmentScore = s;
    }
  }

  const sectionAdj = getSectionCompatibilityBonus(parentSectionTitle, discipline.id);
  const adjusted = Math.max(0, Math.min(1, bestSegmentScore + sectionAdj));

  return {
    rawScore: Number(bestSegmentScore.toFixed(3)),
    score: Number(adjusted.toFixed(3)),
  };
}

// Minimum threshold & tie margin
const AUTO_LINK_MIN_SCORE = 0.50;
const DOUBT_MIN_SCORE = 0.34;
const TIE_MARGIN = 0.06;

function matchMarkerToCampus(markerTitle, parentSectionTitle, disciplines) {
  const scored = [];
  for (const disc of disciplines) {
    for (const topic of disc.topics || []) {
      const { rawScore, score } = scoreMarkerAgainstTopic(markerTitle, parentSectionTitle, topic, disc);
      if (score >= DOUBT_MIN_SCORE && rawScore >= 0.30) {
        scored.push({
          disciplineId: disc.id,
          disciplineName: disc.name,
          topicId: topic.id,
          topicTitle: topic.title,
          rawScore,
          score,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || b.rawScore - a.rawScore);

  if (scored.length === 0) {
    return { status: 'unmatched', matches: [], topCandidates: [] };
  }

  const best = scored[0];
  const second = scored[1];

  if (best.score < AUTO_LINK_MIN_SCORE) {
    return {
      status: 'doubt_low_score',
      matches: [],
      topCandidates: scored.slice(0, 3),
    };
  }

  // Check for tie / near-tie ambiguity within the same campus
  if (second && second.score >= AUTO_LINK_MIN_SCORE - 0.04 && best.score - second.score < TIE_MARGIN) {
    return {
      status: 'doubt_tie',
      matches: [],
      topCandidates: scored.slice(0, 3),
    };
  }

  return {
    status: 'matched',
    matches: [best],
    topCandidates: scored.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// 3. PDF Discovery (Local public/assets/aistudio + Firebase Storage)
// ---------------------------------------------------------------------------
function inferKindFromFileName(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('questoes') || lower.includes('questões')) return 'questoes';
  if (lower.includes('resumo')) return 'resumo';
  if (lower.includes('teoria') || lower.includes('versao_para_impressao') || lower.includes('impressao')) {
    return 'teoria';
  }
  return 'teoria';
}

function isNonApostilaPdf(fileName) {
  const lower = fileName.toLowerCase();
  return lower.startsWith('anexo_ii') || lower.startsWith('anexo_iii');
}

function inferMaterialId(urlPath, fileName, registeredMaterials) {
  const exact = registeredMaterials.find((m) => m.url === urlPath || m.fileName === fileName);
  if (exact) return exact.id;
  const stem = fileName
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/_[0-9a-f]{8}$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `apostila_${stem}`;
}

async function discoverStoragePdfs(registeredMaterials) {
  const storageSources = [];
  const statusNotes = [];

  // Optional explicit manifest path or env JSON for CI / offline runs
  const manifestArgIdx = process.argv.indexOf('--storage-manifest');
  const manifestPath = manifestArgIdx !== -1 ? process.argv[manifestArgIdx + 1] : null;
  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      for (const item of entries) {
        if (item?.url) {
          storageSources.push({
            sourceType: 'storage',
            materialId: item.materialId || inferMaterialId(item.url, item.fileName || path.basename(item.url), registeredMaterials),
            fileName: item.fileName || path.basename(item.url),
            url: item.url,
          });
        }
      }
      statusNotes.push(`Manifesto Storage carregado (${storageSources.length} entrada(s)).`);
      return { storageSources, statusNotes };
    } catch (err) {
      statusNotes.push(`Erro ao ler --storage-manifest: ${err.message}`);
    }
  }

  if (process.env.APOSTILA_STORAGE_PDFS) {
    try {
      const entries = JSON.parse(process.env.APOSTILA_STORAGE_PDFS);
      for (const item of entries) {
        if (item?.url) {
          storageSources.push({
            sourceType: 'storage',
            materialId: item.materialId || inferMaterialId(item.url, item.fileName || path.basename(item.url), registeredMaterials),
            fileName: item.fileName || path.basename(item.url),
            url: item.url,
          });
        }
      }
    } catch (err) {
      statusNotes.push(`APOSTILA_STORAGE_PDFS inválido: ${err.message}`);
    }
  }

  // Probe Firebase Storage bucket JSON API if configured
  if (fs.existsSync(FIREBASE_CONFIG_PATH)) {
    try {
      const fbCfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));
      const bucket = fbCfg.storageBucket;
      if (bucket) {
        const headers = {};
        if (process.env.FIREBASE_STORAGE_TOKEN) {
          headers.Authorization = `Bearer ${process.env.FIREBASE_STORAGE_TOKEN}`;
        }
        const listUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=200`;
        const resp = await fetch(listUrl, { headers, signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
          const data = await resp.json();
          const pdfItems = (data.items || []).filter((obj) => String(obj.name || '').toLowerCase().endsWith('.pdf'));
          for (const obj of pdfItems) {
            const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(obj.name)}?alt=media`;
            const baseName = path.basename(obj.name);
            storageSources.push({
              sourceType: 'storage',
              materialId: inferMaterialId(downloadUrl, baseName, registeredMaterials),
              fileName: baseName,
              url: downloadUrl,
              headers,
            });
          }
          statusNotes.push(`Firebase Storage (${bucket}): ${pdfItems.length} PDF(s) encontrado(s).`);
        } else {
          statusNotes.push(
            `Firebase Storage (${bucket}): listagem retornou HTTP ${resp.status} (bucket não provisionado ou requer autenticação em ambiente ao vivo).`
          );
        }
      }
    } catch (err) {
      statusNotes.push(`Firebase Storage indisponível offline: ${err.message}`);
    }
  }

  // Also inspect any Firebase Storage PDFs explicitly registered in catalog arrays
  for (const mat of registeredMaterials) {
    if (
      mat.url &&
      !mat.pendingDefinition &&
      /firebasestorage\.googleapis\.com/i.test(mat.url) &&
      (mat.fileType === 'pdf' || /\.pdf($|\?)/i.test(mat.url)) &&
      !storageSources.some((s) => s.url === mat.url)
    ) {
      storageSources.push({
        sourceType: 'storage',
        materialId: mat.id,
        fileName: mat.fileName || path.basename(mat.url.split('?')[0]),
        url: mat.url,
      });
    }
  }

  return { storageSources, statusNotes };
}

// ---------------------------------------------------------------------------
// 4. PDF Outline Extraction with pdfjs-dist (getOutline + getPageIndex)
// ---------------------------------------------------------------------------
async function extractPdfMarkers(pdfjs, buffer, sourceMeta) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const numPages = doc.numPages;
  const outline = await doc.getOutline();

  if (!outline || outline.length === 0) {
    return { numPages, markers: [] };
  }

  async function resolvePage(dest) {
    let resolved = dest;
    if (typeof resolved === 'string') {
      resolved = await doc.getDestination(resolved);
    }
    if (Array.isArray(resolved) && resolved[0]) {
      const idx = await doc.getPageIndex(resolved[0]);
      return idx + 1;
    }
    return null;
  }

  // Extract depth-0 (discipline sections) and depth-1 (topic markers).
  // Depth-2 in *_questoes PDFs are exercise tiers ("Questões Fáceis", "Gabaritos..."), not topics.
  const topicNodes = [];

  for (const d0 of outline) {
    const d0Page = await resolvePage(d0.dest);
    const d0Title = String(d0.title || '').replace(/\s+/g, ' ').trim();
    const children = Array.isArray(d0.items) ? d0.items : [];

    if (children.length === 0) {
      // Skip non-programmatic intro bookmark
      if (/^como usar esta apostila$/i.test(d0Title)) continue;
      if (d0Page !== null) {
        topicNodes.push({
          title: d0Title,
          parentSectionTitle: d0Title,
          startPage: d0Page,
          level: 0,
        });
      }
      continue;
    }

    for (const d1 of children) {
      const d1Page = await resolvePage(d1.dest);
      const d1Title = String(d1.title || '').replace(/\s+/g, ' ').trim();
      if (d1Page !== null && d1Title) {
        topicNodes.push({
          title: d1Title,
          parentSectionTitle: d0Title,
          startPage: d1Page,
          level: 1,
        });
      }
    }
  }

  // Compute endPage = startPage of next marker at the same level minus 1 (clamped to [startPage, numPages])
  const markers = topicNodes.map((node, idx) => {
    let endPage = numPages;
    for (let j = idx + 1; j < topicNodes.length; j++) {
      if (topicNodes[j].startPage > node.startPage) {
        endPage = topicNodes[j].startPage - 1;
        break;
      }
      if (topicNodes[j].startPage === node.startPage) {
        endPage = node.startPage;
        break;
      }
    }
    endPage = Math.max(node.startPage, Math.min(numPages, endPage));
    return {
      materialId: sourceMeta.materialId,
      kind: inferKindFromFileName(sourceMeta.fileName),
      title: node.title,
      parentSectionTitle: node.parentSectionTitle,
      startPage: node.startPage,
      endPage,
    };
  });

  return { numPages, markers };
}

// ---------------------------------------------------------------------------
// 5. Expected No-Match Cargo Reason Helper
// ---------------------------------------------------------------------------
function describeUnmatchedTopicNote(campus, disciplineId) {
  if (campus === 'medio') {
    if (disciplineId.startsWith('nm_02_') || disciplineId.startsWith('nm_03_')) {
      return 'sem correspondência esperada (tópico específico de outro cargo do Nível Médio não coberto pela apostila de Assistência Administrativa)';
    }
  }
  if (campus === 'superior') {
    if (disciplineId === 'juridicas_complementares') {
      return 'parcialmente sem correspondência esperada (Direito Civil / Processual Civil / Previdenciário / Direitos Humanos não cobertos pela apostila)';
    }
    if (disciplineId === 'administracao_gestao') {
      return 'parcialmente sem correspondência esperada (tópico específico de Administração Geral/Pessoas não coberto por esta apostila)';
    }
    if (disciplineId === 'direito_financeiro') {
      return 'sem correspondência esperada (LRF / fiscalização detalhada não coberta nesta apostila)';
    }
  }
  return 'sem marcador correspondente encontrado';
}

// ---------------------------------------------------------------------------
// 6. Main Execution
// ---------------------------------------------------------------------------
async function main() {
  const data = loadProjectData();
  const superiorDisciplines = data.ALEPA_DISCIPLINES || [];
  const medioDisciplines = data.ALL_MEDIO_DISCIPLINES || [];
  const registeredMaterials = [
    ...(data.MEDIO_DEFAULT_MATERIALS || []),
    ...(data.DEFAULT_STUDY_MATERIALS || []),
    ...(data.GERAL_DEFAULT_MATERIALS || []),
  ];

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const localPdfFiles = fs.existsSync(AISTUDIO_DIR)
    ? fs
        .readdirSync(AISTUDIO_DIR)
        .filter((f) => f.toLowerCase().endsWith('.pdf') && !isNonApostilaPdf(f))
        .sort()
    : [];

  const sources = localPdfFiles.map((fileName) => {
    const urlPath = `/assets/aistudio/${fileName}`;
    return {
      sourceType: 'local',
      fileName,
      filePath: path.join(AISTUDIO_DIR, fileName),
      url: urlPath,
      materialId: inferMaterialId(urlPath, fileName, registeredMaterials),
    };
  });

  const { storageSources, statusNotes: storageNotes } = await discoverStoragePdfs(registeredMaterials);
  sources.push(...storageSources);

  const allMarkers = [];
  const skippedFiles = [];
  const processedFiles = [];
  const chaptersByMaterial = {};

  // Report collectors separated by campus
  const matchedTopicKeys = {
    superior: new Set(),
    medio: new Set(),
  };
  const doubtfulMatches = {
    superior: [],
    medio: [],
  };
  const completelyUnmatchedMarkers = [];

  for (const src of sources) {
    let buffer;
    try {
      if (src.sourceType === 'local') {
        buffer = fs.readFileSync(src.filePath);
      } else {
        const resp = await fetch(src.url, { headers: src.headers || {}, signal: AbortSignal.timeout(20000) });
        if (!resp.ok) {
          skippedFiles.push(`${src.fileName} (HTTP ${resp.status})`);
          continue;
        }
        buffer = Buffer.from(await resp.arrayBuffer());
      }
    } catch (err) {
      skippedFiles.push(`${src.fileName} (erro ao ler: ${err.message})`);
      continue;
    }

    const { numPages, markers } = await extractPdfMarkers(pdfjs, buffer, src);
    if (markers.length === 0) {
      skippedFiles.push(`${src.fileName} (${numPages} págs., 0 marcadores)`);
      continue;
    }

    processedFiles.push({
      materialId: src.materialId,
      fileName: src.fileName,
      kind: inferKindFromFileName(src.fileName),
      numPages,
      markerCount: markers.length,
      sourceType: src.sourceType,
    });

    // Populate MaterialChapter[] for StudyMaterial.chapters (req 3f)
    chaptersByMaterial[src.materialId] = markers.map((m, i) => ({
      id: `${src.materialId}_ch_${String(i + 1).padStart(3, '0')}`,
      title: m.title,
      startPage: m.startPage,
      endPage: m.endPage,
    }));

    for (const m of markers) {
      const supRes = matchMarkerToCampus(m.title, m.parentSectionTitle, superiorDisciplines);
      const medRes = matchMarkerToCampus(m.title, m.parentSectionTitle, medioDisciplines);

      const targets = [];

      if (supRes.status === 'matched') {
        for (const hit of supRes.matches) {
          targets.push({ campus: 'superior', disciplineId: hit.disciplineId, topicId: hit.topicId });
          matchedTopicKeys.superior.add(`${hit.disciplineId}:${hit.topicId}`);
        }
      } else if (supRes.status === 'doubt_low_score' || supRes.status === 'doubt_tie') {
        doubtfulMatches.superior.push({
          materialId: m.materialId,
          kind: m.kind,
          markerTitle: m.title,
          parentSection: m.parentSectionTitle,
          startPage: m.startPage,
          reason: supRes.status === 'doubt_tie' ? 'empate / margem mínima' : 'pontuação baixa',
          candidates: supRes.topCandidates,
        });
      }

      if (medRes.status === 'matched') {
        for (const hit of medRes.matches) {
          targets.push({ campus: 'medio', disciplineId: hit.disciplineId, topicId: hit.topicId });
          matchedTopicKeys.medio.add(`${hit.disciplineId}:${hit.topicId}`);
        }
      } else if (medRes.status === 'doubt_low_score' || medRes.status === 'doubt_tie') {
        doubtfulMatches.medio.push({
          materialId: m.materialId,
          kind: m.kind,
          markerTitle: m.title,
          parentSection: m.parentSectionTitle,
          startPage: m.startPage,
          reason: medRes.status === 'doubt_tie' ? 'empate / margem mínima' : 'pontuação baixa',
          candidates: medRes.topCandidates,
        });
      }

      if (targets.length === 0) {
        completelyUnmatchedMarkers.push({
          materialId: m.materialId,
          kind: m.kind,
          title: m.title,
          parentSection: m.parentSectionTitle,
          startPage: m.startPage,
          endPage: m.endPage,
        });
      }

      allMarkers.push({
        materialId: m.materialId,
        kind: m.kind,
        title: m.title,
        startPage: m.startPage,
        endPage: m.endPage,
        targets,
      });
    }
  }

  // Group ranges by (campus, disciplineId, topicId, materialId)
  const KIND_ORDER = { teoria: 0, resumo: 1, questoes: 2 };
  const topicBuckets = new Map();

  for (const marker of allMarkers) {
    for (const target of marker.targets) {
      const topicKey = `${target.campus}:${target.disciplineId}:${target.topicId}`;
      if (!topicBuckets.has(topicKey)) {
        topicBuckets.set(topicKey, new Map());
      }
      const byMat = topicBuckets.get(topicKey);
      if (!byMat.has(marker.materialId)) {
        byMat.set(marker.materialId, {
          materialId: marker.materialId,
          kind: marker.kind,
          ranges: [],
        });
      }
      const entry = byMat.get(marker.materialId);
      const duplicateRange = entry.ranges.some(
        (r) => r.title === marker.title && r.startPage === marker.startPage && r.endPage === marker.endPage
      );
      if (!duplicateRange) {
        entry.ranges.push({
          title: marker.title,
          startPage: marker.startPage,
          endPage: marker.endPage,
        });
      }
    }
  }

  const topicMapObj = {};
  for (const [topicKey, byMat] of Array.from(topicBuckets.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const entries = Array.from(byMat.values()).map((entry) => ({
      ...entry,
      ranges: entry.ranges.sort((a, b) => a.startPage - b.startPage),
    }));
    entries.sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.materialId.localeCompare(b.materialId));
    topicMapObj[topicKey] = entries;
  }

  // Generate src/data/apostilaMap.ts
  const tsHeader = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
// Generated by: node scripts/buildApostilaMap.mjs
import type { CampusLevel, MaterialChapter } from '../types';

export type ApostilaKind = 'teoria' | 'resumo' | 'questoes';

export interface ApostilaTargetRef {
  campus: CampusLevel;
  disciplineId: string;
  topicId: string;
}

export interface ApostilaMarkerEntry {
  materialId: string;
  kind: ApostilaKind;
  title: string;
  startPage: number;
  endPage: number;
  targets: ApostilaTargetRef[];
}

export interface ApostilaPageRange {
  title: string;
  startPage: number;
  endPage: number;
}

export interface ApostilaTopicEntry {
  materialId: string;
  kind: ApostilaKind;
  ranges: ApostilaPageRange[];
}

`;

  const tsBody =
    `export const APOSTILA_MARKERS: ApostilaMarkerEntry[] = ${JSON.stringify(allMarkers, null, 2)};\n\n` +
    `export const APOSTILA_TOPIC_MAP: Record<string, ApostilaTopicEntry[]> = ${JSON.stringify(topicMapObj, null, 2)};\n\n` +
    `export const APOSTILA_CHAPTERS_BY_MATERIAL: Record<string, MaterialChapter[]> = ${JSON.stringify(chaptersByMaterial, null, 2)};\n\n` +
    `export function getApostilaEntriesForTopic(\n` +
    `  campus: CampusLevel,\n` +
    `  disciplineId: string,\n` +
    `  topicId: string\n` +
    `): ApostilaTopicEntry[] {\n` +
    `  return APOSTILA_TOPIC_MAP[\`\${campus}:\${disciplineId}:\${topicId}\`] || [];\n` +
    `}\n`;

  fs.writeFileSync(OUT_TS_PATH, tsHeader + tsBody, 'utf8');

  // Generate apostilaMap.report.md
  const unmatchedTopicsSup = [];
  for (const disc of superiorDisciplines) {
    for (const topic of disc.topics || []) {
      if (!matchedTopicKeys.superior.has(`${disc.id}:${topic.id}`)) {
        unmatchedTopicsSup.push({
          disciplineId: disc.id,
          disciplineName: disc.shortName || disc.name,
          topicId: topic.id,
          topicTitle: topic.title,
          note: describeUnmatchedTopicNote('superior', disc.id),
        });
      }
    }
  }

  const unmatchedTopicsMed = [];
  for (const disc of medioDisciplines) {
    for (const topic of disc.topics || []) {
      if (!matchedTopicKeys.medio.has(`${disc.id}:${topic.id}`)) {
        unmatchedTopicsMed.push({
          disciplineId: disc.id,
          disciplineName: disc.shortName || disc.name,
          topicId: topic.id,
          topicTitle: topic.title,
          note: describeUnmatchedTopicNote('medio', disc.id),
        });
      }
    }
  }

  const totalSupTopics = superiorDisciplines.reduce((acc, d) => acc + (d.topics?.length || 0), 0);
  const totalMedTopics = medioDisciplines.reduce((acc, d) => acc + (d.topics?.length || 0), 0);

  const lines = [];
  lines.push('# Relatório de Mapeamento Tópico → Página da Apostila (`apostilaMap.report.md`)');
  lines.push('');
  lines.push('Gerado automaticamente por `node scripts/buildApostilaMap.mjs`.');
  lines.push('');
  lines.push('## 1. Resumo das Fontes Analisadas');
  lines.push('');
  lines.push('| Material ID | Arquivo | Tipo | Páginas | Marcadores | Origem |');
  lines.push('| --- | --- | --- | ---: | ---: | --- |');
  for (const pf of processedFiles) {
    lines.push(`| \`${pf.materialId}\` | \`${pf.fileName}\` | \`${pf.kind}\` | ${pf.numPages} | ${pf.markerCount} | ${pf.sourceType} |`);
  }
  lines.push('');
  if (storageNotes.length > 0) {
    lines.push('**Status Firebase Storage:**');
    for (const note of storageNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }
  if (skippedFiles.length > 0) {
    lines.push('**Arquivos ignorados/não processados:**');
    for (const s of skippedFiles) lines.push(`- ${s}`);
    lines.push('');
  }
  lines.push(`- **Superior:** ${matchedTopicKeys.superior.size}/${totalSupTopics} tópicos vinculados automaticamente.`);
  lines.push(`- **Médio:** ${matchedTopicKeys.medio.size}/${totalMedTopics} tópicos vinculados automaticamente.`);
  lines.push(`- **Marcadores extraídos no total:** ${allMarkers.length}.`);
  lines.push('');

  // Campus Superior
  lines.push('---');
  lines.push('');
  lines.push('## 2. Campus 02 — Nível Superior (`src/data/alepaSyllabus.ts`)');
  lines.push('');
  lines.push(`### 2.1. Tópicos do edital SEM marcador (${unmatchedTopicsSup.length})`);
  lines.push('');
  if (unmatchedTopicsSup.length === 0) {
    lines.push('_Todos os tópicos do edital Superior possuem ao menos um marcador vinculado._');
  } else {
    for (const item of unmatchedTopicsSup) {
      lines.push(`- **\`${item.disciplineId}\` / \`${item.topicId}\`** (${item.disciplineName}): ${item.topicTitle} — _${item.note}_`);
    }
  }
  lines.push('');
  lines.push(`### 2.2. Casamentos duvidosos — Superior (${doubtfulMatches.superior.length})`);
  lines.push('');
  if (doubtfulMatches.superior.length === 0) {
    lines.push('_Nenhum casamento duvidoso ou empate registrado no Superior._');
  } else {
    for (const d of doubtfulMatches.superior) {
      const cands = d.candidates
        .map((c) => `\`${c.disciplineId}/${c.topicId}\` (score=${c.score}, raw=${c.rawScore})`)
        .join(' ; ');
      lines.push(`- **\`${d.materialId}\` [p. ${d.startPage}]** "${d.markerTitle}" _(seção: ${d.parentSection})_ — **${d.reason}** → Candidatos: ${cands}`);
    }
  }
  lines.push('');

  // Campus Médio
  lines.push('---');
  lines.push('');
  lines.push('## 3. Campus 01 — Nível Médio (`src/data/alepaMedioSyllabus.ts`)');
  lines.push('');
  lines.push(`### 3.1. Tópicos do edital SEM marcador (${unmatchedTopicsMed.length})`);
  lines.push('');
  if (unmatchedTopicsMed.length === 0) {
    lines.push('_Todos os tópicos do edital Médio possuem ao menos um marcador vinculado._');
  } else {
    for (const item of unmatchedTopicsMed) {
      lines.push(`- **\`${item.disciplineId}\` / \`${item.topicId}\`** (${item.disciplineName}): ${item.topicTitle} — _${item.note}_`);
    }
  }
  lines.push('');
  lines.push(`### 3.2. Casamentos duvidosos — Médio (${doubtfulMatches.medio.length})`);
  lines.push('');
  if (doubtfulMatches.medio.length === 0) {
    lines.push('_Nenhum casamento duvidoso ou empate registrado no Médio._');
  } else {
    for (const d of doubtfulMatches.medio) {
      const cands = d.candidates
        .map((c) => `\`${c.disciplineId}/${c.topicId}\` (score=${c.score}, raw=${c.rawScore})`)
        .join(' ; ');
      lines.push(`- **\`${d.materialId}\` [p. ${d.startPage}]** "${d.markerTitle}" _(seção: ${d.parentSection})_ — **${d.reason}** → Candidatos: ${cands}`);
    }
  }
  lines.push('');

  // Marcadores sem tópico em nenhum dos dois campus
  lines.push('---');
  lines.push('');
  lines.push(`## 4. Marcadores SEM tópico em nenhum dos dois campus (${completelyUnmatchedMarkers.length})`);
  lines.push('');
  if (completelyUnmatchedMarkers.length === 0) {
    lines.push('_Todos os marcadores extraídos foram vinculados a pelo menos um campus._');
  } else {
    for (const m of completelyUnmatchedMarkers) {
      lines.push(`- **\`${m.materialId}\` (${m.kind}) [pp. ${m.startPage}–${m.endPage}]**: "${m.title}" _(seção: ${m.parentSection})_`);
    }
  }
  lines.push('');

  fs.writeFileSync(OUT_REPORT_PATH, lines.join('\n'), 'utf8');

  console.log(
    `[buildApostilaMap] Concluído: ${processedFiles.length} PDFs, ${allMarkers.length} marcadores, ` +
      `${Object.keys(topicMapObj).length} entradas (campus:disciplina:topico), ` +
      `Superior ${matchedTopicKeys.superior.size}/${totalSupTopics}, Médio ${matchedTopicKeys.medio.size}/${totalMedTopics}.`
  );
  console.log(`[buildApostilaMap] Arquivos gerados: src/data/apostilaMap.ts e apostilaMap.report.md`);
}

main().catch((err) => {
  console.error('[buildApostilaMap] Falha:', err);
  process.exitCode = 1;
});
