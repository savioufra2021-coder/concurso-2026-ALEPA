import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileEdit,
  FileText,
  Filter,
  GraduationCap,
  Headphones,
  Layers,
  Play,
  Sparkles,
  Video,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MEDIO_CARGOS, MEDIO_CONCURSO_PROFILE, isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { CONCURSO_PROFILE } from '../data/alepaSyllabus';
import { filterDisciplinesByBlock } from '../lib/filterHelpers';
import {
  CampusLevel,
  Discipline,
  MediaPlaybackPreference,
  MedioCargoGroup,
  NavSection,
  StudyMaterial,
  SyllabusTopic,
} from '../types';
import {
  APOSTILA_CHAPTERS_BY_MATERIAL,
  getApostilaEntriesForTopic,
  type ApostilaKind,
  type ApostilaTopicEntry,
} from '../data/apostilaMap';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { isPdfReadableMaterial } from '../lib/pdfBookEngine';
import { searchDocumentIndexWithFallback } from '../lib/documentIndexer';
import { BookReaderModal } from './BookReaderModal';
import { MediaPlaybackModal } from './MediaPlaybackModal';
import { PlaybackChoiceModal } from './PlaybackChoiceModal';

const APOSTILA_MATERIAL_IDS = new Set(Object.keys(APOSTILA_CHAPTERS_BY_MATERIAL));

const APOSTILA_KIND_LABELS: Record<ApostilaKind, string> = {
  teoria: 'Teoria',
  resumo: 'Resumo',
  questoes: 'Questões',
};

interface DisciplinesViewProps {
  campus: CampusLevel;
  onChangeCampus: (campus: CampusLevel) => void;
  medioCargoGroup: MedioCargoGroup;
  onChangeMedioCargoGroup: (group: MedioCargoGroup) => void;
  onOpenStudyRoom?: (disciplineId: string, topicId: string) => void;
  onNavigate?: (section: NavSection) => void;
}

export function DisciplinesView({
  campus,
  onChangeCampus,
  medioCargoGroup,
  onChangeMedioCargoGroup,
  onOpenStudyRoom,
  onNavigate,
}: DisciplinesViewProps) {
  const {
    topicProgressMap,
    saveTopicProgress,
    getCampusDisciplines,
    materials,
    questions,
    preferences,
    updateStudentPreferences,
    saveMediaProgress,
  } = useAuth();

  // Compact Academic Identifier (ALWAYS collapsed by default on access)
  // 1) Compact identifier strip (`academicCardExpanded = false` default)
  // 2) Single-expand Discipline accordion (`expandedDisciplineId`)
  // 3) Dedicated progressive screen for a selected Topic (`focusedTarget`)
  const [academicCardExpanded, setAcademicCardExpanded] = useState(false);
  const [expandedDisciplineId, setExpandedDisciplineId] = useState<string | null>(null);
  const [blockFilter, setBlockFilter] = useState<string>('all');
  const [blockFilterOpen, setBlockFilterOpen] = useState(false);
  const [progressPanelOpen, setProgressPanelOpen] = useState(false);
  const [showExamDetails, setShowExamDetails] = useState(false);

  const [focusedTarget, setFocusedTarget] = useState<{ disciplineId: string; topicId: string } | null>(null);
  const savedScrollRef = useRef<number>(0);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Contextual media & document viewers inside focused Topic view
  const [readerTarget, setReaderTarget] = useState<{
    material: StudyMaterial;
    page?: number;
    chapterId?: string;
    query?: string;
  } | null>(null);
  const [choiceMedia, setChoiceMedia] = useState<StudyMaterial | null>(null);
  const [playingMedia, setPlayingMedia] = useState<{
    material: StudyMaterial;
    mode: 'internal' | 'external';
  } | null>(null);
  const [expandedApostilaIds, setExpandedApostilaIds] = useState<Record<string, boolean>>({});
  const [otherMaterialsExpanded, setOtherMaterialsExpanded] = useState(false);

  useEffect(() => {
    setExpandedDisciplineId(null);
    setBlockFilter('all');
    setBlockFilterOpen(false);
    setProgressPanelOpen(false);
  }, [campus, medioCargoGroup]);

  useEffect(() => {
    setExpandedApostilaIds({});
    setProgressPanelOpen(false);
  }, [campus, medioCargoGroup, focusedTarget]);

  const blocks = [
    'all',
    'Conhecimentos Específicos',
    'Legislação e Ética',
    'Língua Portuguesa',
    'Raciocínio Lógico',
    'Noções de Informática',
  ];

  const handleToggleDiscipline = (discId: string) => {
    setExpandedDisciplineId((prev) => (prev === discId ? null : discId));
  };

  const handleOpenTopicDetail = (disciplineId: string, topicId: string) => {
    savedScrollRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
    setFocusedTarget({ disciplineId, topicId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDisciplines = () => {
    const restoreY = savedScrollRef.current;
    setFocusedTarget(null);
    window.setTimeout(() => {
      window.scrollTo({ top: restoreY, behavior: 'auto' });
    }, 30);
  };

  const handleToggleProgress = async (
    topicId: string,
    disciplineId: string,
    field: 'theoryDone' | 'questionsDone' | 'revisionDone'
  ) => {
    const current = topicProgressMap[topicId];
    const nextVal = !(current?.[field] ?? false);
    setSavingTopicId(topicId);
    setStatusMessage(null);
    try {
      await saveTopicProgress(topicId, disciplineId, { [field]: nextVal });
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao atualizar tópico.');
    } finally {
      setSavingTopicId(null);
    }
  };

  const handleSaveNotes = async (topicId: string, disciplineId: string) => {
    const text = noteDrafts[topicId] ?? topicProgressMap[topicId]?.notes ?? '';
    setSavingTopicId(topicId);
    setStatusMessage(null);
    try {
      await saveTopicProgress(topicId, disciplineId, { notes: text });
      setStatusMessage('Anotações do tópico sincronizadas com sua conta.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao salvar anotação.');
    } finally {
      setSavingTopicId(null);
    }
  };

  const handleOpenMedia = (mat: StudyMaterial) => {
    const pref = preferences.mediaPlaybackPreference || 'ask';
    if (pref === 'internal') {
      setPlayingMedia({ material: mat, mode: 'internal' });
      return;
    }
    if (pref === 'external') {
      setPlayingMedia({ material: mat, mode: 'external' });
      return;
    }
    setChoiceMedia(mat);
  };

  const handleChoiceSelection = (mode: 'internal' | 'external', savePref?: MediaPlaybackPreference) => {
    if (!choiceMedia) return;
    if (savePref) {
      void updateStudentPreferences({ mediaPlaybackPreference: savePref });
    }
    if (mode === 'external') {
      void saveMediaProgress(choiceMedia.id, {
        materialTitle: choiceMedia.title,
        mediaType: choiceMedia.resourceType === 'podcast' ? 'audio' : 'video',
        preferredMode: 'external',
        openedExternallyAt: new Date().toISOString(),
      });
    }
    setPlayingMedia({ material: choiceMedia, mode });
    setChoiceMedia(null);
  };

  const handleOpenTopicMaterial = async (mat: StudyMaterial, topicTitle: string, disciplineId: string) => {
    if (mat.pendingDefinition) return;
    let verifiedPage: number | undefined;
    let verifiedChapterId: string | undefined;
    try {
      const hits = await searchDocumentIndexWithFallback({
        query: topicTitle,
        materials: [mat],
        materialId: mat.id,
        disciplineId,
        campusLevel: campus,
        limit: 3,
      });
      const matched = hits.find((h) => h.chunk.materialId === mat.id);
      if (matched) {
        verifiedPage = matched.chunk.pageNumber;
        verifiedChapterId = matched.chunk.chapterId;
      }
    } catch {
      // Fallback safely without inventing page numbers
    }
    setReaderTarget({
      material: mat,
      page: verifiedPage,
      chapterId: verifiedChapterId,
      query: topicTitle,
    });
  };

  const handleOpenApostilaRange = (mat: StudyMaterial, startPage: number) => {
    if (mat.pendingDefinition) return;
    const maxKnownPage = mat.pageCount && mat.pageCount >= 1 ? mat.pageCount : undefined;
    const safePage = maxKnownPage ? Math.min(Math.max(1, startPage), maxKnownPage) : Math.max(1, startPage);
    const matchingChapter = (mat.chapters || []).find((ch) => ch.startPage === safePage);
    setReaderTarget({
      material: mat,
      page: safePage,
      chapterId: matchingChapter?.id,
    });
  };

  const handleToggleApostilaSections = (materialId: string) => {
    setExpandedApostilaIds((prev) => ({
      ...prev,
      [materialId]: !prev[materialId],
    }));
  };

  // Resolve focused topic view data if a topic is selected
  const activeDisciplinesForCampus = useMemo(
    () => getCampusDisciplines(campus, medioCargoGroup),
    [getCampusDisciplines, campus, medioCargoGroup]
  );

  const focusedContext: { discipline: Discipline; topic: SyllabusTopic } | null = useMemo(() => {
    if (!focusedTarget) return null;
    const disc = activeDisciplinesForCampus.find((d) => d.id === focusedTarget.disciplineId);
    const topic = disc?.topics.find((t) => t.id === focusedTarget.topicId);
    if (!disc || !topic) return null;
    return { discipline: disc, topic };
  }, [focusedTarget, activeDisciplinesForCampus]);

  const focusedResources = useMemo(() => {
    if (!focusedContext) {
      return {
        apostilas: [] as Array<{ entry: ApostilaTopicEntry; material: StudyMaterial }>,
        pdfs: [] as StudyMaterial[],
        videos: [] as StudyMaterial[],
        podcasts: [] as StudyMaterial[],
        relatedQuestionsCount: 0,
        recommendations: [] as string[],
      };
    }
    const { discipline, topic } = focusedContext;

    // 6b: Resolve apostilas strictly by (campus, disciplineId, topicId) — never depend on material.disciplineId
    const rawApostilaEntries = getApostilaEntriesForTopic(campus, discipline.id, topic.id);
    const apostilas: Array<{ entry: ApostilaTopicEntry; material: StudyMaterial }> = [];

    for (const rawEntry of rawApostilaEntries) {
      const mat = materials.find((m) => m.id === rawEntry.materialId);
      if (!mat || mat.pendingDefinition) continue;
      if (mat.campusLevel && mat.campusLevel !== 'geral' && mat.campusLevel !== campus) continue;

      const chapterMaxPage = (mat.chapters || []).reduce((mx, ch) => Math.max(mx, ch.endPage || ch.startPage || 0), 0);
      const upperBound = mat.pageCount && mat.pageCount >= 1 ? mat.pageCount : chapterMaxPage > 0 ? chapterMaxPage : undefined;
      const validRanges = rawEntry.ranges.filter(
        (r) => r.startPage >= 1 && (upperBound === undefined || r.startPage <= upperBound)
      );
      if (validRanges.length === 0) continue;

      apostilas.push({
        entry: { ...rawEntry, ranges: validRanges },
        material: mat,
      });
    }

    const mappedApostilaIds = new Set(apostilas.map((a) => a.material.id));

    const topicLower = topic.title.toLowerCase();
    const keywords = topicLower.split(/[\s,()/:;-]+/).filter((w) => w.length > 3);

    const matchingMaterials = materials.filter((m) => {
      if (m.campusLevel && m.campusLevel !== 'geral' && m.campusLevel !== campus) return false;
      if (mappedApostilaIds.has(m.id) || APOSTILA_MATERIAL_IDS.has(m.id)) return false;
      const sameDisc =
        m.disciplineId === discipline.id ||
        (m.disciplineId.startsWith('geral_') &&
          discipline.shortName.toLowerCase().includes(m.disciplineId.replace('geral_', '').replace('_', ' ')));
      if (sameDisc) return true;
      const chapterTitles = (m.chapters || []).map((c) => c.title).join(' ');
      const hay = `${m.title} ${m.editalTopic || ''} ${(m.keywords || []).join(' ')} ${chapterTitles}`.toLowerCase();
      return keywords.some((kw) => hay.includes(kw));
    });

    const pdfs = matchingMaterials.filter((m) => isInAppReadableMaterial(m));
    const videos = matchingMaterials.filter((m) => m.fileType === 'video' || m.resourceType === 'video');
    const podcasts = matchingMaterials.filter((m) => m.resourceType === 'podcast');

    const isMedio = campus === 'medio';
    const relatedQuestionsCount = questions.filter((q) => {
      const sameCampus = isMedio ? isMedioDisciplineId(q.disciplineId) : !isMedioDisciplineId(q.disciplineId);
      return sameCampus && q.disciplineId === discipline.id;
    }).length;

    const recommendations = Array.from(
      new Set(
        [...apostilas.map((a) => a.material), ...matchingMaterials]
          .flatMap((m) => m.studyRecommendations || [])
          .filter((r) => typeof r === 'string' && r.trim().length > 0)
      )
    );

    return { apostilas, pdfs, videos, podcasts, relatedQuestionsCount, recommendations };
  }, [focusedContext, materials, questions, campus]);

  // Render Single-Expand Discipline Accordion immediately below compact Academic Identifier
  const activeMedioCargo = MEDIO_CARGOS.find((c) => c.group === medioCargoGroup) || MEDIO_CARGOS[0];

  const renderCampusDisciplineList = (targetCampus: CampusLevel) => {
    const campusDisciplines = getCampusDisciplines(targetCampus, medioCargoGroup);
    const filteredDisciplines = filterDisciplinesByBlock(campusDisciplines, blockFilter);
    const activeBlockLabel = blockFilter === 'all' ? 'Todos os blocos' : blockFilter;

    return (
      <div className="space-y-3">
        {/* Collapsible block filter (collapsed by default) */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={blockFilterOpen}
            aria-controls="disciplines-block-filter-panel"
            onClick={() => setBlockFilterOpen((prev) => !prev)}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#146C43] text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
            <span>Filtrar disciplinas:</span>
            <span className="text-[#0B3321] dark:text-emerald-300 font-bold">{activeBlockLabel}</span>
            {blockFilterOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </button>

          {blockFilterOpen && (
            <div
              id="disciplines-block-filter-panel"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center gap-1.5"
            >
              {blocks.map((block) => (
                <button
                  key={block}
                  type="button"
                  onClick={() => {
                    setBlockFilter(block);
                    setExpandedDisciplineId(null);
                    setBlockFilterOpen(false);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    blockFilter === block
                      ? 'bg-[#0B3321] text-white border-[#0B3321]'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#146C43]'
                  }`}
                >
                  {block === 'all' ? 'Todos os blocos' : block}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Single-expand Discipline Accordion Cards */}
        <div className="space-y-2" aria-label="Lista expansível de disciplinas">
          {filteredDisciplines.map((disc) => {
            const isDiscExpanded = expandedDisciplineId === disc.id;
            const totalMastery = disc.topics.reduce(
              (acc, t) => acc + (topicProgressMap[t.id]?.masteryLevel ?? 0),
              0
            );
            const avgMastery = disc.topics.length ? Math.round(totalMastery / disc.topics.length) : 0;

            return (
              <div
                key={disc.id}
                className={`rounded-xl border transition-colors overflow-hidden ${
                  isDiscExpanded
                    ? 'border-[#146C43] dark:border-emerald-500 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <div className="w-full px-3.5 py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-expanded={isDiscExpanded}
                    onClick={() => handleToggleDiscipline(disc.id)}
                    className="flex items-center gap-3 min-w-0 text-left flex-1"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isDiscExpanded
                          ? 'bg-[#0B3321] text-white'
                          : 'bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{disc.shortName}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{disc.topics.length} assuntos</span>
                        <span>·</span>
                        <span>{disc.examQuestions} questões</span>
                        <span>·</span>
                        <span className="font-mono font-bold text-[#146C43] dark:text-emerald-400">{avgMastery}% domínio</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#146C43] dark:bg-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, avgMastery))}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const targetTopic =
                          disc.topics.find((t) => !(topicProgressMap[t.id]?.theoryDone && topicProgressMap[t.id]?.questionsDone)) ||
                          disc.topics[0];
                        if (targetTopic) {
                          handleOpenTopicDetail(disc.id, targetTopic.id);
                        }
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#E8F3EC] dark:bg-emerald-950/60 border border-[#146C43]/30 dark:border-emerald-700/50 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#146C43] hover:text-white transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ler apostila</span>
                    </button>
                    <button
                      type="button"
                      aria-expanded={isDiscExpanded}
                      onClick={() => handleToggleDiscipline(disc.id)}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                    >
                      {isDiscExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Progressive Topics List (only visible inside the ONE expanded discipline) */}
                {isDiscExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {disc.topics.map((topic, idx) => {
                      const prog = topicProgressMap[topic.id];
                      const pct = prog?.masteryLevel ?? 0;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleOpenTopicDetail(disc.id, topic.id)}
                          className="w-full min-h-[52px] px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-[#E8F3EC]/50 dark:hover:bg-emerald-950/20 transition-colors"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              <span className="font-bold text-[#146C43] dark:text-emerald-400">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              {topic.highYield && (
                                <span className="text-amber-700 dark:text-amber-400 font-sans font-semibold">
                                  · Alta incidência CETAP
                                </span>
                              )}
                              <span>· {pct}% concluído</span>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                              {topic.title}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // NÍVEL 3: DEDICATED PROGRESSIVE ASSUNTO VIEW (no horizontal tabs, vertical stack, instant Back)
  if (focusedContext) {
    const { discipline, topic } = focusedContext;
    const prog = topicProgressMap[topic.id];
    const noteVal = noteDrafts[topic.id] ?? prog?.notes ?? '';

    const primaryApostila = focusedResources.apostilas[0];
    const readablePdfs = focusedResources.pdfs.filter((m) => isPdfReadableMaterial(m));
    const siteLinks = focusedResources.pdfs.filter((m) => !isPdfReadableMaterial(m));

    const primaryPdf = readablePdfs[0];
    const handleOpenMainReading = () => {
      if (primaryApostila) {
        handleOpenApostilaRange(primaryApostila.material, primaryApostila.entry.ranges[0].startPage);
      } else if (primaryPdf) {
        void handleOpenTopicMaterial(primaryPdf, topic.title, discipline.id);
      }
    };

    const mainButtonText = primaryApostila
      ? `Ler na apostila · p. ${primaryApostila.entry.ranges[0].startPage}`
      : primaryPdf
      ? `Ler material · ${primaryPdf.title}`
      : `Acervo da disciplina`;

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Compact Breadcrumb + Prominent Back Button */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleBackToDisciplines}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0 text-xs text-slate-600 dark:text-slate-400 truncate">
              <span className="font-semibold text-[#146C43] dark:text-emerald-400">
                {campus === 'medio' ? 'Campus 01 (Médio)' : 'Campus 02 (Superior)'}
              </span>
              <span className="mx-1.5">→</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{discipline.shortName}</span>
              <span className="mx-1.5">→</span>
              <span className="truncate">{topic.title}</span>
            </nav>
          </div>

          {onOpenStudyRoom && (
            <button
              type="button"
              onClick={() => onOpenStudyRoom(discipline.id, topic.id)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#146C43] text-[#0B3321] dark:text-emerald-300 bg-[#E8F3EC] dark:bg-emerald-950/40 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Sala de Estudo (IA / Flashcards)</span>
            </button>
          )}
        </div>

        {/* Assunto Header & Nova Ordem */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {discipline.editalBlock} · {topic.highYield ? 'Alta incidência CETAP' : 'Conteúdo Programático'}
            </span>
            <span className="font-mono font-bold text-[#146C43] dark:text-emerald-400">
              {prog?.masteryLevel ?? 0}% domínio
            </span>
          </div>

          <h1 className="font-display text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {topic.title}
          </h1>

          {/* 1. BOTÃO PRINCIPAL: Ler na apostila */}
          <div>
            <button
              type="button"
              onClick={handleOpenMainReading}
              className="w-full sm:w-auto min-h-[50px] px-6 py-3 bg-[#0B3321] hover:bg-[#146C43] text-white text-sm font-bold rounded-xl shadow-md inline-flex items-center justify-center gap-2.5 transition-colors"
            >
              <BookOpen className="w-5 h-5 text-emerald-300" />
              <span>{mainButtonText}</span>
              <ChevronRight className="w-4 h-4 opacity-75" />
            </button>
          </div>

          {/* 2. Atalhos: Teoria · Resumo · Questões */}
          {focusedResources.apostilas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1">Atalhos na apostila:</span>
              {focusedResources.apostilas.map((item, idx) => (
                <button
                  key={`${item.material.id}-${idx}`}
                  type="button"
                  onClick={() => handleOpenApostilaRange(item.material, item.entry.ranges[0].startPage)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#146C43]/30 dark:border-emerald-700/50 bg-[#E8F3EC] dark:bg-emerald-950/50 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <span>{APOSTILA_KIND_LABELS[item.entry.kind]}</span>
                  <span className="font-mono text-[11px] opacity-85">p. {item.entry.ranges[0].startPage}</span>
                </button>
              ))}
            </div>
          )}

          {/* 3. Subtópicos do edital */}
          {topic.subtopics.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Subtópicos do Edital:</p>
              <ul className="space-y-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                {topic.subtopics.map((sub, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#146C43] dark:text-emerald-400 font-bold">•</span>
                    <span>{sub}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Acompanhar progresso (SEMPRE RECOLHIDO por padrão) */}
          {(() => {
            const doneCount = [
              Boolean(prog?.theoryDone),
              Boolean(prog?.questionsDone),
              Boolean(prog?.revisionDone),
            ].filter(Boolean).length;
            return (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  aria-expanded={progressPanelOpen}
                  aria-controls={`topic-progress-panel-${topic.id}`}
                  onClick={() => setProgressPanelOpen((prev) => !prev)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-[#146C43] text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                  <span>Acompanhar progresso</span>
                  {doneCount > 0 && (
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      ({doneCount}/3)
                    </span>
                  )}
                  {progressPanelOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>

                {progressPanelOpen && (
                  <div
                    id={`topic-progress-panel-${topic.id}`}
                    className="mt-2.5 flex flex-wrap gap-2"
                  >
                    {(
                      [
                        { key: 'theoryDone', label: 'Teoria concluída' },
                        { key: 'questionsDone', label: 'Questões resolvidas' },
                        { key: 'revisionDone', label: 'Revisão feita' },
                      ] as const
                    ).map((item) => {
                      const checked = Boolean(prog?.[item.key]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          disabled={savingTopicId === topic.id}
                          onClick={() => void handleToggleProgress(topic.id, discipline.id, item.key)}
                          className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                            checked
                              ? 'bg-[#0B3321] border-[#0B3321] text-white'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#146C43]'
                          }`}
                        >
                          <Check className={`w-4 h-4 ${checked ? 'opacity-100' : 'opacity-30'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        {/* 5. Materiais vinculados: Apostilas & PDFs vs Outros materiais (sites externos) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Apostila e PDFs (Leitor interno) */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                <span>
                  Apostila e PDFs ({focusedResources.apostilas.length + readablePdfs.length})
                </span>
              </h2>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('materials')}
                  className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 hover:underline"
                >
                  Acervo completo
                </button>
              )}
            </div>

            {focusedResources.apostilas.length === 0 && readablePdfs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum PDF ou apostila vinculada especificamente a este assunto. Consulte o acervo da disciplina.
              </p>
            ) : (
              <div className="space-y-2.5">
                {focusedResources.apostilas.map(({ entry, material: mat }) => {
                  const primaryRange = entry.ranges[0];
                  const hasMultipleRanges = entry.ranges.length > 1;
                  const isSectionsOpen = Boolean(expandedApostilaIds[mat.id]);
                  const kindLabel = APOSTILA_KIND_LABELS[entry.kind];

                  return (
                    <div
                      key={mat.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenApostilaRange(mat, primaryRange.startPage)}
                        className="w-full min-h-[56px] p-3 text-left flex items-center justify-between gap-2.5 hover:bg-[#E8F3EC]/60 dark:hover:bg-emerald-950/30 transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md bg-[#E8F3EC] dark:bg-emerald-950/70 text-[#0B3321] dark:text-emerald-300 border border-[#146C43]/20 dark:border-emerald-700/40">
                              {kindLabel}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-[#146C43] dark:text-emerald-400 tabular-nums">
                              p. {primaryRange.startPage}
                              {primaryRange.endPage > primaryRange.startPage ? `–${primaryRange.endPage}` : ''}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {mat.title}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            Ler na apostila: {primaryRange.title}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3321] dark:text-emerald-300 shrink-0">
                          <span className="hidden sm:inline">Ler</span>
                          <BookOpen className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                        </span>
                      </button>

                      {hasMultipleRanges && (
                        <div className="border-t border-slate-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/50">
                          <button
                            type="button"
                            aria-expanded={isSectionsOpen}
                            onClick={() => handleToggleApostilaSections(mat.id)}
                            className="w-full min-h-[38px] px-3 py-1.5 flex items-center justify-between gap-2 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
                          >
                            <span>Seções da apostila ({entry.ranges.length})</span>
                            {isSectionsOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                          </button>

                          {isSectionsOpen && (
                            <ul className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                              {entry.ranges.map((range, rIdx) => (
                                <li key={`${mat.id}-range-${rIdx}`}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApostilaRange(mat, range.startPage)}
                                    className="w-full min-h-[40px] px-3 py-2 text-left flex items-center justify-between gap-2.5 hover:bg-[#E8F3EC]/50 dark:hover:bg-emerald-950/25 transition-colors"
                                  >
                                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
                                      {range.title}
                                    </span>
                                    <span className="text-[11px] font-mono font-semibold text-[#146C43] dark:text-emerald-400 tabular-nums shrink-0">
                                      p. {range.startPage}
                                      {range.endPage > range.startPage ? `–${range.endPage}` : ''}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {readablePdfs.slice(0, 6).map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    disabled={Boolean(mat.pendingDefinition)}
                    onClick={() => void handleOpenTopicMaterial(mat, topic.title, discipline.id)}
                    className="w-full min-h-[52px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[#146C43] disabled:opacity-60 disabled:cursor-not-allowed text-left flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {mat.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mat.pendingDefinition
                          ? 'Definição pendente de confirmação'
                          : mat.subtitle || mat.institution || 'Abrir no Book Reader ALEPA'}
                      </p>
                    </div>
                    <BookOpen className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Vídeos e Podcasts */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Video className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                <span>
                  Videoaulas & Podcasts ({focusedResources.videos.length + focusedResources.podcasts.length})
                </span>
              </h2>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('videos')}
                  className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 hover:underline"
                >
                  Central de mídia
                </button>
              )}
            </div>

            {focusedResources.videos.length === 0 && focusedResources.podcasts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhuma aula em vídeo ou podcast vinculado ainda. Você pode pedir inclusão pela Central de Solicitações.
              </p>
            ) : (
              <div className="space-y-2">
                {[...focusedResources.videos, ...focusedResources.podcasts].slice(0, 6).map((media) => (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => handleOpenMedia(media)}
                    className="w-full min-h-[52px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[#146C43] text-left flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {media.resourceType === 'podcast' ? (
                        <Headphones className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Play className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {media.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {media.subtitle || media.institution || (media.resourceType === 'podcast' ? 'Podcast' : 'Videoaula')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 6. Outros materiais / Sites externos (Recolhidos por padrão, abrindo em nova aba sem PDF reader) */}
        {siteLinks.length > 0 && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <button
              type="button"
              aria-expanded={otherMaterialsExpanded}
              onClick={() => setOtherMaterialsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                <span>Outros materiais & Sites externos ({siteLinks.length})</span>
              </h2>
              {otherMaterialsExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {otherMaterialsExpanded && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {siteLinks.map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => {
                      if (mat.url) {
                        window.open(mat.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="w-full min-h-[52px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[#146C43] text-left flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          site
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {mat.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mat.subtitle || mat.institution || mat.url}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Questões relacionadas & Recomendações de estudo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
              <span>Questões Relacionadas ({focusedResources.relatedQuestionsCount})</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Treine questões comentadas de {discipline.shortName} na Sala de Estudo ou no Banco Geral de Simulados.
            </p>
            <div className="flex flex-wrap gap-2">
              {onOpenStudyRoom && (
                <button
                  type="button"
                  onClick={() => onOpenStudyRoom(discipline.id, topic.id)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold"
                >
                  Resolver questões deste tópico
                </button>
              )}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('simulados')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  Ir para Simulados
                </button>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2.5">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
              <span>Recomendações de Estudo</span>
            </h2>
            {focusedResources.recommendations.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {focusedResources.recommendations.slice(0, 5).map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Leia a base teórica/lei seca do tópico, resolva ao menos 10 questões da banca CETAP e registre seus erros para revisão espaçada (D+1, D+7, D+15).
              </p>
            )}
          </section>
        </div>

        {/* Anotações pessoais do tópico */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <label htmlFor={`topic-note-${topic.id}`} className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            <FileEdit className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
            <span>Anotações Pessoais deste Assunto</span>
          </label>
          <textarea
            id={`topic-note-${topic.id}`}
            rows={3}
            value={noteVal}
            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [topic.id]: e.target.value }))}
            placeholder="Anote artigos importantes, exceções cobradas pela CETAP ou dicas pessoais..."
            className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
          />
          {statusMessage && <p className="text-xs font-medium text-[#146C43] dark:text-emerald-400">{statusMessage}</p>}
          <div className="flex flex-wrap justify-between items-center gap-2">
            {discipline.id.includes('portugues') && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('portuguese_repo')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Repositório Prof. Fabrício Dutra
              </button>
            )}
            <button
              type="button"
              disabled={savingTopicId === topic.id}
              onClick={() => void handleSaveNotes(topic.id, discipline.id)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs sm:text-sm font-semibold ml-auto"
            >
              {savingTopicId === topic.id ? 'Salvando...' : 'Salvar anotações'}
            </button>
          </div>
        </section>

        {readerTarget && (
          <BookReaderModal
            material={readerTarget.material}
            initialPage={readerTarget.page}
            initialChapterId={readerTarget.chapterId}
            initialSearchQuery={readerTarget.query}
            onClose={() => setReaderTarget(null)}
          />
        )}
        {choiceMedia && (
          <PlaybackChoiceModal
            material={choiceMedia}
            currentPreference={preferences.mediaPlaybackPreference || 'ask'}
            onChooseInternal={(pref) => handleChoiceSelection('internal', pref)}
            onChooseExternal={(pref) => handleChoiceSelection('external', pref)}
            onClose={() => setChoiceMedia(null)}
          />
        )}
        {playingMedia && (
          <MediaPlaybackModal
            material={playingMedia.material}
            initialMode={playingMedia.mode}
            onClose={() => setPlayingMedia(null)}
          />
        )}
      </div>
    );
  }

  // NÍVEL 1 & 2: COMPACT COLLAPSED ACADEMIC IDENTIFIER → SINGLE-EXPAND DISCIPLINES → PROGRESSIVE TOPICS
  const compactCargoShort =
    campus === 'medio'
      ? `${activeMedioCargo.cargoNumber} (${activeMedioCargo.code})`
      : 'Cargo 03 · PL.AL.102';
  const compactCampusSummary =
    campus === 'medio'
      ? `Campus 01 · Nível Médio · ${compactCargoShort}`
      : `Campus 02 · Nível Superior · ${compactCargoShort}`;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Título da seção */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Disciplinas e Conteúdo Programático
        </h1>
        <a
          href={campus === 'medio' ? MEDIO_CONCURSO_PROFILE.editalUrl : CONCURSO_PROFILE.anexoIIPdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex min-h-[36px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <span>{campus === 'medio' ? 'Edital 001/2026' : 'Anexo II'}</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>
      </div>

      {/* 2. Identificador acadêmico compacto (SEMPRE RECOLHIDO por padrão) */}
      <section
        aria-label="Identificador acadêmico ativo"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
      >
        <button
          type="button"
          aria-expanded={academicCardExpanded}
          onClick={() => setAcademicCardExpanded((prev) => !prev)}
          className="w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300 flex items-center justify-center shrink-0">
              {campus === 'medio' ? <Layers className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {compactCampusSummary}
            </span>
          </div>
          {academicCardExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {academicCardExpanded && (
          <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 dark:text-slate-300">
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-slate-400">Campus</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {campus === 'medio' ? 'Campus 01' : 'Campus 02'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-slate-400">Edital</dt>
                <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {campus === 'medio' ? MEDIO_CONCURSO_PROFILE.editalNumber : CONCURSO_PROFILE.editalNumber}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-slate-400">Nível</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {campus === 'medio' ? 'Nível Médio' : 'Nível Superior'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500 dark:text-slate-400">Cargo ativo</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {campus === 'medio' ? `${activeMedioCargo.cargoNumber} · ${activeMedioCargo.code}` : 'Cargo 03 · PL.AL.102'}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white font-semibold"
                >
                  Alterar em Meu Perfil Acadêmico
                </button>
              )}
              <button
                type="button"
                onClick={() => onChangeCampus(campus === 'medio' ? 'superior' : 'medio')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
              >
                Trocar para {campus === 'medio' ? 'Campus 02 (Superior)' : 'Campus 01 (Médio)'}
              </button>
              <a
                href={CONCURSO_PROFILE.editalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1"
              >
                <span>Portal CETAP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </section>

      {/* 3. Lista de disciplinas expansíveis logo em seguida */}
      <section aria-label="Lista de disciplinas do edital">
        {renderCampusDisciplineList(campus)}
      </section>

      {/* Collapsible Exam Structure Details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowExamDetails((prev) => !prev)}
          className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Estrutura da Prova Objetiva (50 questões · 10,0 pts)
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {showExamDetails ? 'Recolher quadro do edital' : 'Toque para consultar pesos por bloco'}
            </p>
          </div>
          {showExamDetails ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>

        {showExamDetails && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Bloco do Edital</th>
                  <th className="py-2 px-3 font-medium text-right">Questões</th>
                  <th className="py-2 px-3 font-medium text-right">Pontos</th>
                  <th className="py-2 pl-3 font-medium text-right">Desempate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">Conhecimentos Específicos</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">20</td>
                  <td className="py-2 px-3 text-right font-mono">4,0</td>
                  <td className="py-2 pl-3 text-right font-mono text-[#146C43] dark:text-emerald-400">1º critério</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">Legislação e Ética</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">10</td>
                  <td className="py-2 px-3 text-right font-mono">2,0</td>
                  <td className="py-2 pl-3 text-right font-mono">2º critério</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">Língua Portuguesa</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">10</td>
                  <td className="py-2 px-3 text-right font-mono">2,0</td>
                  <td className="py-2 pl-3 text-right font-mono">3º critério</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">Raciocínio Lógico</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">05</td>
                  <td className="py-2 px-3 text-right font-mono">1,0</td>
                  <td className="py-2 pl-3 text-right font-mono">4º critério</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">Noções de Informática</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">05</td>
                  <td className="py-2 px-3 text-right font-mono">1,0</td>
                  <td className="py-2 pl-3 text-right font-mono">5º critério</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
