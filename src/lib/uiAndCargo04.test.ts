import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CARGO_04_BASICAS_QUESTIONS } from '../data/alepaCargo04BasicasQuestions';
import { CARGO_04_ESPECIFICAS_QUESTIONS } from '../data/alepaCargo04EspecificasQuestions';
import { GERAL_DEFAULT_MATERIALS } from '../data/alepaGeneralLibrary';
import { MEDIO_DEFAULT_MATERIALS, MEDIO_QUESTIONS } from '../data/alepaMedioLibrary';
import { getMedioDisciplines } from '../data/alepaMedioSyllabus';
import { DEFAULT_STUDY_MATERIALS } from '../data/alepaQuestions';
import type { Discipline, StudyMaterial } from '../types';
import {
  buildSimuladoDistributionPlan,
  buildVideoCategoryGroups,
  collectTopicsForDisciplines,
  filterDisciplinesByBlock,
  matchesVideoCategoryGroup,
  normalizeTextKey,
} from './filterHelpers';
import {
  computeCenteredScrollLeft,
  computePdfPageWidth,
  formatZoomBadge,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  PDF_ZOOM_PRESETS,
  stepPdfZoom,
} from './pdfZoomHelpers';

const cargo04Disciplines: Discipline[] = getMedioDisciplines('cargo_01_04');
const allMaterials: StudyMaterial[] = [
  ...DEFAULT_STUDY_MATERIALS,
  ...MEDIO_DEFAULT_MATERIALS,
  ...GERAL_DEFAULT_MATERIALS,
];

const mockAuthState: Record<string, unknown> = {
  user: null,
  profile: null,
  isAdmin: false,
  campus: 'medio',
  medioCargoGroup: 'cargo_01_04',
  getCampusDisciplines: () => cargo04Disciplines,
  materials: allMaterials,
  questions: [...MEDIO_QUESTIONS, ...CARGO_04_BASICAS_QUESTIONS, ...CARGO_04_ESPECIFICAS_QUESTIONS],
  simuladoLists: [],
  preferences: {
    theme: 'light',
    accentColor: 'emerald',
    fontScale: 'md',
    density: 'comfortable',
    hiddenDashboardCards: [],
    dashboardCardOrder: [],
    favoriteMaterialIds: [],
    favoriteQuestionIds: [],
    favoriteTopicIds: [],
    customShortcuts: [],
  },
  topicProgressMap: {},
  readingProgressMap: {},
  mediaProgressMap: {},
  studyLogs: [],
  simuladoAttempts: [],
  canPublishShared: false,
  canAccessTeacherPanel: false,
  workspaceAccessToken: null,
  saveTopicProgress: vi.fn(),
  updateStudentPreferences: vi.fn(),
  saveMediaProgress: vi.fn(),
  toggleFavoriteQuestion: vi.fn(),
  saveSimuladoAttempt: vi.fn(),
  addErrorEntry: vi.fn(),
  addCustomQuestion: vi.fn(),
  addMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
  loginWithGoogle: vi.fn(),
  saveReadingProgress: vi.fn(),
  connectGoogleWorkspace: vi.fn(),
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('pdfjs-dist', () => ({
  TextLayer: class {},
  GlobalWorkerOptions: { workerSrc: '' },
}));

vi.mock('./pdfBookEngine', () => ({
  extractPdfOutline: vi.fn(async () => []),
  extractStructuredPageContent: vi.fn(async () => ({
    pageNumber: 1,
    blocks: [],
    plainText: '',
    charCount: 0,
    isLikelyScanned: false,
  })),
  getMaterialProgressKey: (id: string) => id,
  isAllowedHtmlPortalUrl: () => false,
  isPdfReadableMaterial: () => true,
  loadPdfDocument: vi.fn(),
  PdfSourceError: class PdfSourceError extends Error {
    code = 'LOAD_FAILED';
  },
  resolvePdfDocumentSource: vi.fn(),
  searchPdfDocument: vi.fn(async () => []),
}));

vi.mock('./epubAndHtmlEngine', () => ({
  classifyMaterialOpeningMode: () => 'pdf',
  isInAppReadableMaterial: () => true,
  loadAndParseEpub: vi.fn(),
  loadAndParseHtmlPortal: vi.fn(),
}));

import { DisciplinesView } from '../components/DisciplinesView';
import { VideosView } from '../components/VideosView';
import { SimuladosView } from '../components/SimuladosView';
import { BookReaderModal } from '../components/BookReaderModal';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

describe('Cargo 04 (PL.AL.060) question bank expansion', () => {
  const cargo04DiscIds = new Set(cargo04Disciplines.map((d) => d.id));
  const mergedPool = [
    ...MEDIO_QUESTIONS,
    ...CARGO_04_BASICAS_QUESTIONS,
    ...CARGO_04_ESPECIFICAS_QUESTIONS,
  ].filter((q) => cargo04DiscIds.has(q.disciplineId));

  it('expands Cargo 04 bank to 122 valid unique questions with 5 options', () => {
    expect(CARGO_04_BASICAS_QUESTIONS).toHaveLength(50);
    expect(CARGO_04_ESPECIFICAS_QUESTIONS).toHaveLength(60);
    expect(mergedPool.length).toBe(122);

    const idSet = new Set<string>();
    const stemSet = new Set<string>();
    for (const q of [...CARGO_04_BASICAS_QUESTIONS, ...CARGO_04_ESPECIFICAS_QUESTIONS]) {
      expect(idSet.has(q.id)).toBe(false);
      idSet.add(q.id);

      const normStem = normalizeTextKey(q.statement);
      expect(stemSet.has(normStem)).toBe(false);
      stemSet.add(normStem);

      expect(q.options).toHaveLength(5);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(5);
      expect(q.originType).toBe('training_platform');
      expect(q.isOfficial).toBe(false);
      expect(q.escolaridade).toBe('medio');
    }
  });

  it('covers every Cargo 04 discipline and syllabus topic', () => {
    for (const d of cargo04Disciplines) {
      const discQuestions = mergedPool.filter((q) => q.disciplineId === d.id);
      expect(discQuestions.length).toBeGreaterThanOrEqual(6);
      for (const topic of d.topics) {
        const covered = discQuestions.some(
          (q) => normalizeTextKey(q.topicTitle) === normalizeTextKey(topic.title)
        );
        expect(covered, `Missing topic coverage: ${d.id} -> ${topic.title}`).toBe(true);
      }
    }
  });

  it('keeps c04_rl_04 unambiguous with Diego in Setor 1 (correctIndex 0)', () => {
    const q = CARGO_04_BASICAS_QUESTIONS.find((item) => item.id === 'c04_rl_04');
    expect(q).toBeDefined();
    expect(q?.correctIndex).toBe(0);
    expect(q?.options[0]).toContain('Setor 1');
  });
});

describe('filterHelpers & Simulado distribution', () => {
  const pool = [
    ...MEDIO_QUESTIONS,
    ...CARGO_04_BASICAS_QUESTIONS,
    ...CARGO_04_ESPECIFICAS_QUESTIONS,
  ].filter((q) => cargo04Disciplines.some((d) => d.id === q.disciplineId));

  it('filters disciplines by edital block cleanly', () => {
    expect(filterDisciplinesByBlock(cargo04Disciplines, 'all')).toHaveLength(11);
    const specificOnly = filterDisciplinesByBlock(cargo04Disciplines, 'Conhecimentos Específicos');
    expect(specificOnly.length).toBe(7);
    expect(specificOnly.every((d) => d.editalBlock === 'Conhecimentos Específicos')).toBe(true);
  });

  it('deduplicates video category labels when scope is all', () => {
    const videos = allMaterials.filter((m) => m.fileType === 'video');
    const groups = buildVideoCategoryGroups('all', videos);
    const seenTitles = new Set<string>();
    for (const g of groups) {
      const norm = normalizeTextKey(g.title);
      expect(seenTitles.has(norm)).toBe(false);
      seenTitles.add(norm);
    }
    if (groups[0]) {
      const matched = videos.filter((v) => matchesVideoCategoryGroup(v, groups[0].key, groups));
      expect(matched).toHaveLength(groups[0].count);
    }
  });

  it('collects topics and builds 50-question proportional Cargo 04 simulado', () => {
    const topics = collectTopicsForDisciplines(
      cargo04Disciplines,
      cargo04Disciplines.map((d) => d.id),
      pool
    );
    expect(topics.length).toBeGreaterThanOrEqual(19);

    const plan = buildSimuladoDistributionPlan({
      disciplines: cargo04Disciplines,
      campusQuestions: pool,
      selectedDiscIds: cargo04Disciplines.map((d) => d.id),
      selectedTopics: [],
      difficultyFilter: 'all',
      originFilter: 'all',
      targetCountInput: 50,
      strategy: 'proportional',
    });

    expect(plan.maxAvailable).toBe(122);
    expect(plan.targetCount).toBe(50);
    const sumPlanned = plan.breakdown.reduce((acc, item) => acc + item.planned, 0);
    expect(sumPlanned).toBe(50);
  });
});

describe('pdfZoomHelpers', () => {
  it('defines zoom presets in requested order and clamps zoom bounds', () => {
    expect(PDF_ZOOM_PRESETS.map((p) => p.label)).toEqual(['Ajustar', '100%', '125%', '150%']);
    expect(stepPdfZoom(0, 0.15, 1.15)).toBe(1.3);
    expect(stepPdfZoom(1.5, -0.15)).toBe(1.35);
    expect(stepPdfZoom(MAX_PDF_ZOOM, 0.5)).toBe(MAX_PDF_ZOOM);
    expect(stepPdfZoom(MIN_PDF_ZOOM, -0.5)).toBe(MIN_PDF_ZOOM);
    expect(formatZoomBadge(0)).toBe('Ajustar');
    expect(formatZoomBadge(1.25)).toBe('125%');
  });

  it('computes centered scrollLeft and expanded vs compact page widths', () => {
    expect(computeCenteredScrollLeft(600, 800)).toBe(0);
    expect(computeCenteredScrollLeft(1200, 800)).toBe(200);

    const compactSingle = computePdfPageWidth({
      measuredWidth: 1000,
      isExpanded: false,
      mode: 'single',
    });
    const expandedSingle = computePdfPageWidth({
      measuredWidth: 1200,
      isExpanded: true,
      mode: 'single',
    });
    expect(expandedSingle).toBeGreaterThan(compactSingle);

    const narrowPhone = computePdfPageWidth({
      measuredWidth: 300,
      isExpanded: false,
      mode: 'original',
    });
    expect(narrowPhone).toBeGreaterThanOrEqual(220);
    expect(narrowPhone).toBeLessThanOrEqual(300);
  });
});

describe('Initial collapsed states, role gating, and compact reader SSR', () => {
  beforeEach(() => {
    mockAuthState.canPublishShared = false;
    mockAuthState.canAccessTeacherPanel = false;
  });

  it('DisciplinesView renders with block filter and progress indicators collapsed by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(DisciplinesView, {
        campus: 'medio',
        onChangeCampus: vi.fn(),
        medioCargoGroup: 'cargo_01_04',
        onChangeMedioCargoGroup: vi.fn(),
      })
    );
    expect(html).toContain('Campus 01');
    expect(html).toContain('Cargo 04');
    expect(html).toContain('Filtrar disciplinas');
    expect(html).not.toContain('Teoria concluída');
    expect(html).not.toContain('Questões resolvidas');
    expect(html).not.toContain('Revisão feita');
  });

  it('VideosView collapses filters and gates video creation by role', () => {
    const guestHtml = renderToStaticMarkup(
      React.createElement(VideosView, { campus: 'medio' })
    );
    expect(guestHtml).toContain('Filtrar por nível');
    expect(guestHtml).toContain('Plataforma');
    expect(guestHtml).toContain('Filtrar por disciplina');
    expect(guestHtml).not.toContain('Adicionar vídeo');

    mockAuthState.canAccessTeacherPanel = true;
    const teacherHtml = renderToStaticMarkup(
      React.createElement(VideosView, { campus: 'medio' })
    );
    expect(teacherHtml).toContain('Adicionar vídeo');
  });

  it('SimuladosView collapses generator/filters, shows Cargo 04 simulator, and gates question creation', () => {
    const guestHtml = renderToStaticMarkup(
      React.createElement(SimuladosView, {
        campus: 'medio',
        medioCargoGroup: 'cargo_01_04',
      })
    );
    expect(guestHtml).toContain('Montar Simulado Personalizado');
    expect(guestHtml).toContain('Cargo 04');
    expect(guestHtml).toContain('Gerar e iniciar simulado');
    expect(guestHtml).not.toContain('Cadastrar questão');

    mockAuthState.canAccessTeacherPanel = true;
    const teacherHtml = renderToStaticMarkup(
      React.createElement(SimuladosView, {
        campus: 'medio',
        medioCargoGroup: 'cargo_01_04',
      })
    );
    expect(teacherHtml).toContain('Cadastrar questão');
  });

  it('BookReaderModal starts in Modo Compacto with Livro/Leitura/PDF Original and Ampliar toggle', () => {
    const html = renderToStaticMarkup(
      React.createElement(BookReaderModal, {
        material: {
          id: 'mat_test_pdf',
          ownerId: 'system',
          title: 'Apostila ALEPA Cargo 04',
          fileType: 'pdf',
          url: 'https://example.com/apostila.pdf',
          disciplineId: 'nm_portugues',
          institution: 'Acervo ALEPA',
          isShared: true,
        },
        onClose: vi.fn(),
      })
    );

    expect(html).toContain('data-reader-mode="expanded"');
    expect(html).toContain('Apostila ALEPA Cargo 04');
    expect(html).toContain('Livro');
    expect(html).toContain('Leitura');
    expect(html).toContain('PDF Original');
    expect(html).toContain('Recolher');
  });

  it('ThemeSwitcher reflects current theme preference accurately', () => {
    const prefs = mockAuthState.preferences as Record<string, unknown>;
    prefs.theme = 'light';
    const lightHtml = renderToStaticMarkup(React.createElement(ThemeSwitcher));
    expect(lightHtml).toContain('Modo Claro');

    prefs.theme = 'dark';
    const darkHtml = renderToStaticMarkup(React.createElement(ThemeSwitcher));
    expect(darkHtml).toContain('Modo Escuro');

    prefs.theme = 'auto';
    const autoHtml = renderToStaticMarkup(React.createElement(ThemeSwitcher));
    expect(autoHtml).toContain('Automático');
    prefs.theme = 'light';
  });
});
