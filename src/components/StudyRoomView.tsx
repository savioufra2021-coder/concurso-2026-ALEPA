import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  FlipHorizontal,
  Headphones,
  Loader2,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import { VERIFIED_OFFICIAL_AND_ACADEMIC_SOURCES } from '../data/verifiedSources';
import {
  CampusLevel,
  FlashcardItem,
  MediaPlaybackPreference,
  MedioCargoGroup,
  MindMapData,
  NavSection,
  Question,
  StudyMaterial,
  SyllabusTopic,
} from '../types';
import { addDaysIso, saveLastStudiedContext } from '../utils/mediaUrls';
import { apiFetch } from '../lib/apiClient';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { searchDocumentIndexWithFallback } from '../lib/documentIndexer';
import { BookReaderModal } from './BookReaderModal';
import { MediaPlaybackModal } from './MediaPlaybackModal';
import { PlaybackChoiceModal } from './PlaybackChoiceModal';
import { parseVideoEmbed } from './VideosView';
import { PageHeader, SectionCard } from './ui/CampusPrimitives';

type StudyRoomTabId = 'teoria' | 'pdfs' | 'videos' | 'questoes' | 'revisao' | 'progresso';

interface TopicRoomCache {
  explanation?: string;
  summary?: string;
  flashcards?: FlashcardItem[];
  mindMap?: MindMapData;
}

const ROOM_CACHE_PREFIX = 'alepa_study_room_cache_v1_';

function loadRoomCache(topicId: string): TopicRoomCache {
  try {
    const raw = localStorage.getItem(`${ROOM_CACHE_PREFIX}${topicId}`);
    if (!raw) return {};
    return JSON.parse(raw) as TopicRoomCache;
  } catch {
    return {};
  }
}

function saveRoomCache(topicId: string, patch: Partial<TopicRoomCache>): TopicRoomCache {
  const next = { ...loadRoomCache(topicId), ...patch };
  try {
    localStorage.setItem(`${ROOM_CACHE_PREFIX}${topicId}`, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export function StudyRoomView({
  campus,
  medioCargoGroup = 'cargo_01_04',
  selectedDisciplineId,
  selectedTopicId,
  onSelectTopic,
  onNavigate,
  onStartFocusTimer,
}: {
  campus: CampusLevel;
  medioCargoGroup?: MedioCargoGroup;
  selectedDisciplineId?: string;
  selectedTopicId?: string;
  onSelectTopic: (disciplineId: string, topicId: string) => void;
  onNavigate: (section: NavSection) => void;
  onStartFocusTimer: (disciplineId: string, topicTitle: string) => void;
}) {
  const {
    topicProgressMap,
    saveTopicProgress,
    materials,
    questions,
    errorNotebook,
    addErrorEntry,
    getCampusDisciplines,
    preferences,
    updateStudentPreferences,
    mediaProgressMap,
    saveMediaProgress,
  } = useAuth();
  const isMedio = campus === 'medio';
  const disciplines = useMemo(
    () => getCampusDisciplines(campus, medioCargoGroup),
    [getCampusDisciplines, campus, medioCargoGroup]
  );

  const activeDiscipline = useMemo(() => {
    return disciplines.find((d) => d.id === selectedDisciplineId) || disciplines[0];
  }, [disciplines, selectedDisciplineId]);

  const activeTopic: SyllabusTopic | undefined = useMemo(() => {
    if (!activeDiscipline) return undefined;
    return activeDiscipline.topics.find((t) => t.id === selectedTopicId) || activeDiscipline.topics[0];
  }, [activeDiscipline, selectedTopicId]);

  const progress = activeTopic ? topicProgressMap[activeTopic.id] : undefined;

  const [noteDraft, setNoteDraft] = useState(progress?.notes || '');
  const [savingProg, setSavingProg] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [roomCache, setRoomCache] = useState<TopicRoomCache>(() =>
    activeTopic ? loadRoomCache(activeTopic.id) : {}
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Interactive Flashcards state
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [cardRatings, setCardRatings] = useState<Record<string, 'facil' | 'revisar'>>({});

  // Quick Quiz & Media/Reader state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [activeBookMaterial, setActiveBookMaterial] = useState<StudyMaterial | null>(null);
  const [readerInitialPage, setReaderInitialPage] = useState<number | undefined>(undefined);
  const [readerInitialChapterId, setReaderInitialChapterId] = useState<string | undefined>(undefined);
  const [readerInitialSearchQuery, setReaderInitialSearchQuery] = useState<string | undefined>(undefined);
  const [activeRoomTab, setActiveRoomTab] = useState<StudyRoomTabId>('teoria');
  const [activeVideoMaterial, setActiveVideoMaterial] = useState<StudyMaterial | null>(null);
  const [playbackChoiceTarget, setPlaybackChoiceTarget] = useState<{
    material: StudyMaterial;
    startSeconds?: number;
  } | null>(null);
  const [modalMediaPlayer, setModalMediaPlayer] = useState<{
    material: StudyMaterial;
    mode: 'internal' | 'external';
    startSeconds?: number;
  } | null>(null);

  const launchMediaPlayback = (mat: StudyMaterial, mode: 'internal' | 'external', startSeconds?: number) => {
    setModalMediaPlayer({ material: mat, mode, startSeconds });
    if (mode === 'external') {
      void saveMediaProgress(mat.id, {
        materialTitle: mat.title,
        mediaType: mat.resourceType === 'podcast' ? 'audio' : 'video',
        preferredMode: 'external',
        openedExternallyAt: new Date().toISOString(),
      });
    }
  };

  const handleOpenMedia = (mat: StudyMaterial, startSeconds?: number) => {
    const pref = preferences.mediaPlaybackPreference || 'ask';
    if (pref === 'ask') {
      setPlaybackChoiceTarget({ material: mat, startSeconds });
      return;
    }
    launchMediaPlayback(mat, pref === 'external' ? 'external' : 'internal', startSeconds);
  };

  const handlePlaybackChoice = (mode: 'internal' | 'external', savePreference?: MediaPlaybackPreference) => {
    if (!playbackChoiceTarget) return;
    const { material, startSeconds } = playbackChoiceTarget;
    if (savePreference) {
      void updateStudentPreferences({ mediaPlaybackPreference: savePreference });
    }
    setPlaybackChoiceTarget(null);
    launchMediaPlayback(material, mode, startSeconds);
  };

  useEffect(() => {
    if (!activeTopic || !activeDiscipline) return;
    setNoteDraft(topicProgressMap[activeTopic.id]?.notes || '');
    setRoomCache(loadRoomCache(activeTopic.id));
    setFlippedCards({});
    setQuizAnswers({});
    setActiveVideoMaterial(null);
    setAiError(null);
    saveLastStudiedContext({
      campus,
      section: 'study_room',
      disciplineId: activeDiscipline.id,
      topicId: activeTopic.id,
      topicTitle: activeTopic.title,
      label: `${activeDiscipline.shortName} · ${activeTopic.title}`,
    });
  }, [activeTopic?.id, activeDiscipline?.id, campus]);

  const topicMaterials = useMemo(() => {
    if (!activeDiscipline || !activeTopic) return { pdfs: [], videos: [], audios: [] };
    const topicLower = activeTopic.title.toLowerCase();
    const discMaterials = materials.filter((m) => {
      if (m.campusLevel && m.campusLevel !== 'geral' && m.campusLevel !== campus) return false;
      if (m.disciplineId === activeDiscipline.id) return true;
      if (m.disciplineId.startsWith('geral_') && activeDiscipline.shortName.toLowerCase().includes(m.disciplineId.replace('geral_', '').replace('_', ' '))) {
        return true;
      }
      return (m.editalTopic || '').toLowerCase().includes(topicLower.slice(0, 12));
    });

    const pdfs = discMaterials.filter((m) => isInAppReadableMaterial(m));
    const videos = discMaterials.filter(
      (m) => m.fileType === 'video' || m.resourceType === 'video'
    );
    const audios = discMaterials.filter((m) => m.resourceType === 'podcast');
    return { pdfs: pdfs.slice(0, 6), videos: videos.slice(0, 6), audios: audios.slice(0, 4) };
  }, [materials, activeDiscipline, activeTopic, campus]);

  const topicVerifiedSources = useMemo(() => {
    if (!activeDiscipline) return [];
    return VERIFIED_OFFICIAL_AND_ACADEMIC_SOURCES.filter(
      (s) => s.disciplines.includes('all') || s.disciplines.includes(activeDiscipline.id)
    ).slice(0, 6);
  }, [activeDiscipline]);

  const topicQuestions = useMemo(() => {
    if (!activeDiscipline || !activeTopic) return [] as Question[];
    const keywords = activeTopic.title
      .toLowerCase()
      .split(/[\s,()/:;-]+/)
      .filter((w) => w.length > 3);
    const discPool = questions.filter((q) =>
      isMedio
        ? isMedioDisciplineId(q.disciplineId) && q.disciplineId === activeDiscipline.id
        : !isMedioDisciplineId(q.disciplineId) && q.disciplineId === activeDiscipline.id
    );
    const matched = discPool.filter((q) => {
      const target = `${q.topicTitle} ${q.statement}`.toLowerCase();
      return keywords.some((kw) => target.includes(kw));
    });
    return (matched.length > 0 ? matched : discPool).slice(0, 4);
  }, [questions, activeDiscipline, activeTopic, isMedio]);

  const topicErrors = useMemo(() => {
    if (!activeDiscipline || !activeTopic) return [];
    return errorNotebook.filter(
      (e) =>
        e.disciplineId === activeDiscipline.id &&
        e.topicTitle.toLowerCase().includes(activeTopic.title.toLowerCase().slice(0, 10))
    );
  }, [errorNotebook, activeDiscipline, activeTopic]);

  const fallbackMindMap: MindMapData = useMemo(() => {
    const subs = activeTopic?.subtopics || [];
    return {
      centralTopic: activeTopic?.title || 'Assunto do Edital',
      branches: [
        {
          title: 'Subtópicos do Edital',
          items: subs.length > 0 ? subs.slice(0, 5) : ['Conceitos fundamentais', 'Estrutura normativa'],
        },
        {
          title: 'Foco Fundação CETAP',
          items: [
            activeTopic?.highYield ? 'Tema de alta incidência em prova' : 'Cobrança objetiva conceitual',
            'Atenção às exceções legais e prazos',
            'Leitura atenta do enunciado (correta × incorreta)',
          ],
        },
        {
          title: 'Ciclo de Memorização',
          items: [
            progress?.theoryDone ? 'Teoria concluída' : 'Ler base teórica / lei seca',
            progress?.questionsDone ? 'Questões resolvidas' : 'Resolver bateria do assunto',
            progress?.revisionDone ? 'Revisão feita' : 'Agendar revisão D+1 / D+7',
          ],
        },
      ],
    };
  }, [activeTopic, progress]);

  const defaultFlashcards: FlashcardItem[] = useMemo(() => {
    if (!activeTopic || !activeDiscipline) return [];
    const baseCards: FlashcardItem[] = [
      {
        id: 'fc_default_1',
        front: `Qual é o foco principal de "${activeTopic.title}" em ${activeDiscipline.shortName}?`,
        back:
          activeTopic.subtopics.length > 0
            ? `Subtópicos do edital: ${activeTopic.subtopics.join('; ')}.`
            : `Domínio dos conceitos e aplicação prática conforme o Anexo II da ALEPA.`,
        tip: activeTopic.highYield ? 'Prioridade alta na Banca CETAP.' : 'Estude com resolução de questões.',
      },
    ];
    activeTopic.subtopics.slice(0, 3).forEach((sub, idx) => {
      baseCards.push({
        id: `fc_default_${idx + 2}`,
        front: `Subtópico ${idx + 1}: o que devo revisar sobre "${sub}"?`,
        back: 'Verifique a definição principal, a base normativa/teórica e as exceções mais cobradas em questões objetivas.',
        tip: 'Use o Professor IA abaixo para gerar flashcards aprofundados com exemplos.',
      });
    });
    return baseCards;
  }, [activeTopic, activeDiscipline]);

  const activeMindMap = roomCache.mindMap || fallbackMindMap;
  const activeFlashcards = roomCache.flashcards && roomCache.flashcards.length > 0 ? roomCache.flashcards : defaultFlashcards;

  const handleToggleStage = async (field: 'theoryDone' | 'questionsDone' | 'revisionDone') => {
    if (!activeTopic || !activeDiscipline) return;
    setSavingProg(true);
    setFeedback(null);
    try {
      const nextVal = !(progress?.[field] ?? false);
      await saveTopicProgress(activeTopic.id, activeDiscipline.id, { [field]: nextVal });
      setFeedback('Progresso da Sala de Estudo atualizado.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível salvar progresso.');
    } finally {
      setSavingProg(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeTopic || !activeDiscipline) return;
    setSavingProg(true);
    setFeedback(null);
    try {
      await saveTopicProgress(activeTopic.id, activeDiscipline.id, { notes: noteDraft });
      setFeedback('Anotações pessoais salvas.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar anotações.');
    } finally {
      setSavingProg(false);
    }
  };

  const handleRunProfessorAction = async (
    action: 'explain_topic' | 'generate_flashcards' | 'generate_mindmap'
  ) => {
    if (!activeTopic || !activeDiscipline) return;
    setLoadingAction(action);
    setAiError(null);
    try {
      const res = await apiFetch('/api/gemini/professor', {
        method: 'POST',
        body: JSON.stringify({
          action,
          campus,
          disciplineName: activeDiscipline.name,
          topicTitle: activeTopic.title,
          subtopics: activeTopic.subtopics,
          studentNotes: noteDraft,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        text?: string;
        flashcards?: Array<{ front: string; back: string; tip?: string }>;
        mindMap?: MindMapData;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível consultar o Professor IA.');
      }
      if (action === 'explain_topic' && json.text) {
        setRoomCache(saveRoomCache(activeTopic.id, { explanation: json.text }));
      } else if (action === 'generate_flashcards' && Array.isArray(json.flashcards)) {
        const mapped: FlashcardItem[] = json.flashcards.map((fc, idx) => ({
          id: `fc_ai_${Date.now()}_${idx}`,
          front: fc.front,
          back: fc.back,
          tip: fc.tip,
        }));
        setRoomCache(saveRoomCache(activeTopic.id, { flashcards: mapped }));
        setFlippedCards({});
      } else if (action === 'generate_mindmap' && json.mindMap?.branches) {
        setRoomCache(saveRoomCache(activeTopic.id, { mindMap: json.mindMap }));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao conectar com o Professor IA.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSelectQuickAnswer = async (q: Question, idx: number) => {
    if (quizAnswers[q.id] !== undefined) return;
    setQuizAnswers((prev) => ({ ...prev, [q.id]: idx }));
    if (idx !== q.correctIndex) {
      try {
        await addErrorEntry({
          questionId: q.id,
          disciplineId: q.disciplineId,
          topicTitle: q.topicTitle,
          questionStem: q.statement,
          correctOption: `${LETTERS[q.correctIndex]}) ${q.options[q.correctIndex]}`,
          selectedOption: `${LETTERS[idx]}) ${q.options[idx]}`,
          errorReason: 'teoria',
          improvementNote: q.explanation,
        });
      } catch {
        // non-blocking
      }
    }
  };

  const handleOpenBookAtTopic = async (
    mat: StudyMaterial,
    queryText?: string,
    explicitPage?: number,
    explicitChapterId?: string
  ) => {
    if (mat.pendingDefinition) return;
    let page = explicitPage;
    let chapterId = explicitChapterId;
    if (page === undefined && activeDiscipline) {
      try {
        const hits = await searchDocumentIndexWithFallback({
          query: queryText || activeTopic?.title || mat.title,
          materials: [mat],
          materialId: mat.id,
          disciplineId: activeDiscipline.id,
          campusLevel: campus,
          limit: 3,
        });
        const matched = hits.find((h) => h.chunk.materialId === mat.id);
        if (matched) {
          page = matched.chunk.pageNumber;
          if (!chapterId) chapterId = matched.chunk.chapterId;
        }
      } catch {
        // Keep undefined page cleanly
      }
    }
    setReaderInitialPage(page);
    setReaderInitialChapterId(chapterId);
    setReaderInitialSearchQuery(queryText || activeTopic?.title);
    setActiveBookMaterial(mat);
  };

  const handleOpenQuestionSource = async (q: Question) => {
    if (q.sourceMaterialId) {
      const targetMat = materials.find((m) => m.id === q.sourceMaterialId && !m.pendingDefinition);
      if (targetMat && isInAppReadableMaterial(targetMat)) {
        await handleOpenBookAtTopic(targetMat, q.topicTitle, q.sourcePage);
        return;
      }
    }
    const readablePool = materials.filter(
      (m) => !m.pendingDefinition && isInAppReadableMaterial(m) && (m.disciplineId === q.disciplineId || m.campusLevel === 'geral' || m.campusLevel === campus)
    );
    const hits = await searchDocumentIndexWithFallback({
      query: `${q.topicTitle} ${q.legalBasis || ''}`.trim(),
      materials: readablePool,
      disciplineId: q.disciplineId,
      campusLevel: campus,
      limit: 5,
    });
    const bestHit = hits.find((h) => readablePool.some((m) => m.id === h.chunk.materialId));
    if (bestHit) {
      const targetMat = readablePool.find((m) => m.id === bestHit.chunk.materialId);
      if (targetMat) {
        await handleOpenBookAtTopic(targetMat, q.topicTitle, bestHit.chunk.pageNumber, bestHit.chunk.chapterId);
        return;
      }
    }
    if (topicMaterials.pdfs[0] && !topicMaterials.pdfs[0].pendingDefinition) {
      await handleOpenBookAtTopic(topicMaterials.pdfs[0], q.topicTitle);
      return;
    }
    setFeedback('Nenhum material indexado correspondente encontrado para este trecho.');
  };

  if (!activeDiscipline || !activeTopic) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Sala de Estudo por Assunto · ${isMedio ? 'Nível Médio (001/2026)' : 'Nível Superior (002/2026)'}`}
        title={activeTopic.title}
        subtitle={`${activeDiscipline.name} · ${activeTopic.highYield ? 'Alta incidência CETAP' : 'Conteúdo programático oficial'}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => onNavigate('disciplines')}
              className="min-h-[42px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Edital</span>
            </button>
            <button
              type="button"
              onClick={() => onStartFocusTimer(activeDiscipline.id, activeTopic.title)}
              className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#146C43] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <Target className="w-4 h-4" />
              <span>Estudar 2h neste assunto</span>
            </button>
          </>
        }
      />

      {/* Seletor rápido de disciplina e tópico dentro da Sala */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="room-disc-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Disciplina
          </label>
          <select
            id="room-disc-select"
            value={activeDiscipline.id}
            onChange={(e) => {
              const nextDisc = disciplines.find((d) => d.id === e.target.value);
              if (nextDisc && nextDisc.topics[0]) {
                onSelectTopic(nextDisc.id, nextDisc.topics[0].id);
              }
            }}
            className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.priorityRank}º · {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="room-topic-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Assunto / Tópico do Edital
          </label>
          <select
            id="room-topic-select"
            value={activeTopic.id}
            onChange={(e) => onSelectTopic(activeDiscipline.id, e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {activeDiscipline.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.highYield ? '★ ' : ''}
                {t.title} ({topicProgressMap[t.id]?.masteryLevel ?? 0}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className="bg-[#E8F3EC] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium">
          {feedback}
        </div>
      )}
      {aiError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 rounded-xl px-4 py-3 text-xs font-medium">
          {aiError}
        </div>
      )}

      {/* 6 Independent Study Room Tabs */}
      <nav
        aria-label="Abas da Sala de Estudo"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex sm:grid sm:grid-cols-6 gap-1.5 overflow-x-auto no-scrollbar"
      >
        {(
          [
            { id: 'teoria', label: 'Teoria', icon: BookOpen },
            { id: 'pdfs', label: `Leitura (${topicMaterials.pdfs.length})`, icon: FileText },
            {
              id: 'videos',
              label: `Vídeos (${topicMaterials.videos.length + topicMaterials.audios.length})`,
              icon: Video,
            },
            { id: 'questoes', label: `Questões (${topicQuestions.length})`, icon: ClipboardList },
            { id: 'revisao', label: 'Revisão', icon: RotateCcw },
            { id: 'progresso', label: `Progresso (${progress?.masteryLevel ?? 0}%)`, icon: Target },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeRoomTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRoomTab(tab.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#0B3321] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ABA 1: TEORIA */}
      {activeRoomTab === 'teoria' && (
        <div className="space-y-5">
          <SectionCard
            title="Explicação Teórica & Resumo Orientado (Professor IA)"
            subtitle="Aula objetiva focada nos subtópicos do edital e pegadinhas da Fundação CETAP"
            rightSlot={
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => handleRunProfessorAction('explain_topic')}
                className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                {loadingAction === 'explain_topic' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{roomCache.explanation ? 'Atualizar explicação IA' : 'Gerar explicação do assunto'}</span>
              </button>
            }
          >
            {roomCache.explanation ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#F5F7F6] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 text-sm">
                {roomCache.explanation}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Guia de estudo do assunto:</p>
                <p>
                  Clique em <strong>"Gerar explicação do assunto"</strong> para o Professor IA estruturar os conceitos
                  centrais de <strong>{activeTopic.title}</strong> com foco na Banca CETAP e pontos de revisão rápida.
                </p>
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard
              title="Conteúdo Programático do Tópico"
              subtitle="Subtópicos oficiais previstos no Anexo II"
            >
              <ul className="space-y-2">
                {activeTopic.subtopics.map((sub, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[#146C43] dark:bg-emerald-400 shrink-0" />
                    <span>{sub}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Anotações Pessoais de Lei Seca & Resumo"
              subtitle="Sincronizado com seu progresso do edital"
            >
              <div className="space-y-3">
                <textarea
                  rows={5}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Anote artigos importantes, prazos, exceções da banca CETAP e dúvidas para revisar..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={savingProg}
                    onClick={() => handleToggleStage('theoryDone')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                      progress?.theoryDone
                        ? 'bg-[#E8F3EC] dark:bg-emerald-950/50 border-[#146C43] text-[#0B3321] dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{progress?.theoryDone ? 'Teoria concluída' : 'Marcar teoria concluída'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingProg}
                    onClick={handleSaveNotes}
                    className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                  >
                    Salvar anotações
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ABA 2: PDFs */}
      {activeRoomTab === 'pdfs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard
            title="Apostilas, PDFs e Legislação"
            subtitle={`${topicMaterials.pdfs.length} materiais relacionados a ${activeDiscipline.shortName}`}
          >
            {topicMaterials.pdfs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum PDF cadastrado especificamente nesta disciplina ainda. Você pode adicionar na Central de Materiais.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topicMaterials.pdfs.map((mat) => {
                  const openInBookReader = !mat.pendingDefinition && isInAppReadableMaterial(mat);
                  const allowDownload = mat.allowDownload !== false;
                  if (mat.pendingDefinition) {
                    return (
                      <div
                        key={mat.id}
                        className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1 opacity-80"
                      >
                        <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{mat.title}</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                          Definição pendente de confirmação administrativa
                        </p>
                      </div>
                    );
                  }
                  if (openInBookReader) {
                    return (
                      <div
                        key={mat.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/70 space-y-2 text-xs transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => void handleOpenBookAtTopic(mat, activeTopic.title)}
                          className="w-full text-left flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{mat.title}</p>
                            {mat.subtitle && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{mat.subtitle}</p>
                            )}
                            <p className="text-[11px] text-[#146C43] dark:text-emerald-400 font-medium mt-0.5">
                              Ler no Book Reader · {mat.institution || 'Biblioteca ALEPA'}
                            </p>
                          </div>
                          <BookOpen className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0 mt-0.5" />
                        </button>
                        {mat.chapters && mat.chapters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            {mat.chapters.slice(0, 4).map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => void handleOpenBookAtTopic(mat, ch.title, ch.startPage, ch.id)}
                                className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                              >
                                {ch.title}
                                {ch.startPage ? ` (p. ${ch.startPage})` : ''}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <a
                      key={mat.id}
                      href={mat.url.startsWith('local://') || !allowDownload ? '#' : mat.url}
                      target={mat.url.startsWith('local://') || !allowDownload ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (mat.url.startsWith('local://') || !allowDownload) {
                          e.preventDefault();
                          onNavigate('materials');
                        }
                      }}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/70 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{mat.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{mat.institution || 'Biblioteca ALEPA'}</p>
                      </div>
                      <FileText className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0 mt-0.5" />
                    </a>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('materials')}
              className="mt-4 min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B3321] dark:text-emerald-400 hover:border-[#0B3321] inline-flex items-center gap-1.5"
            >
              <span>Abrir Central de Materiais</span>
            </button>
          </SectionCard>

          <SectionCard
            title="Fontes Oficiais & Legislação Verificada"
            subtitle="Portais oficiais para consulta direta da lei seca"
          >
            <div className="space-y-2.5">
              {topicVerifiedSources.map((src) => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/70 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{src.title}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{src.description}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ABA 3: VÍDEOS */}
      {activeRoomTab === 'videos' && (
        <div className="space-y-5">
          {activeVideoMaterial && (() => {
            const parsed = parseVideoEmbed(activeVideoMaterial.url, activeVideoMaterial.institution);
            return (
              <div className="bg-white dark:bg-slate-900 border border-[#146C43] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">
                      Player Integrado · {parsed.platformLabel}
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeVideoMaterial.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveVideoMaterial(null)}
                    aria-label="Fechar player"
                    className="min-w-[36px] min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {parsed.embedUrl ? (
                  parsed.platform === 'direct' ? (
                    <video
                      src={parsed.embedUrl}
                      controls
                      className="w-full rounded-xl bg-black max-h-[380px]"
                    />
                  ) : (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950">
                      <iframe
                        src={parsed.embedUrl}
                        title={activeVideoMaterial.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  )
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <p className="text-slate-700 dark:text-slate-300">
                      Esta plataforma requer abertura em nova guia para reprodução completa.
                    </p>
                    <a
                      href={activeVideoMaterial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3.5 py-1.5 bg-[#0B3321] text-white font-semibold rounded-xl inline-flex items-center gap-1.5 shrink-0"
                    >
                      <span>Abrir vídeo</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard
              title="Videoaulas Relacionadas"
              subtitle={`Aulas vinculadas a ${activeDiscipline.shortName}`}
              rightSlot={
                <button
                  type="button"
                  onClick={() => onNavigate('videos')}
                  className="min-h-[36px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0B3321] dark:text-emerald-300 hover:border-[#0B3321]"
                >
                  Abrir Central de Vídeos
                </button>
              }
            >
              {topicMaterials.videos.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma videoaula vinculada especificamente a esta disciplina ainda. Adicione na área Vídeos e Podcasts.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topicMaterials.videos.map((v) => {
                    const parsed = parseVideoEmbed(v.url, v.institution);
                    const prog = mediaProgressMap[v.id];
                    return (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{v.title}</p>
                            {v.subtitle && (
                              <p className="text-[11px] text-[#146C43] dark:text-emerald-400 mt-0.5">{v.subtitle}</p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {parsed.platformLabel} · {v.institution || 'Aula'}
                              {prog && prog.progressPercent > 0 ? ` · ${prog.progressPercent}%` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenMedia(v)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B3321] hover:bg-[#146C43] text-white font-semibold inline-flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{prog && prog.currentTimeSeconds > 0 ? 'Continuar' : 'Assistir'}</span>
                            </button>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Abrir vídeo em nova guia"
                              className="min-w-[36px] min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                        {v.chapters && v.chapters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            {v.chapters.slice(0, 4).map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => handleOpenMedia(v, ch.startSeconds)}
                                className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                              >
                                {ch.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Podcasts & Áudios de Revisão"
              subtitle="Conteúdos em áudio ligados à disciplina"
              rightSlot={
                <button
                  type="button"
                  onClick={() => onNavigate('podcasts')}
                  className="min-h-[36px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#0B3321] dark:text-emerald-300 hover:border-[#0B3321]"
                >
                  Abrir Podcasts
                </button>
              }
            >
              {topicMaterials.audios.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhum podcast ou áudio cadastrado nesta disciplina ainda.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topicMaterials.audios.map((a) => {
                    const prog = mediaProgressMap[a.id];
                    return (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{a.title}</p>
                            {a.subtitle && (
                              <p className="text-[11px] text-[#146C43] dark:text-emerald-400 mt-0.5">{a.subtitle}</p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Podcast / Áudio{prog && prog.progressPercent > 0 ? ` · ${prog.progressPercent}%` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenMedia(a)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B3321] hover:bg-[#146C43] text-white font-semibold inline-flex items-center gap-1"
                            >
                              <Headphones className="w-3.5 h-3.5" />
                              <span>{prog && prog.currentTimeSeconds > 0 ? 'Continuar' : 'Ouvir'}</span>
                            </button>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Abrir áudio em nova guia"
                              className="min-w-[36px] min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                        {a.chapters && a.chapters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            {a.chapters.slice(0, 4).map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => handleOpenMedia(a, ch.startSeconds)}
                                className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                              >
                                {ch.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ABA 4: QUESTÕES */}
      {activeRoomTab === 'questoes' && (
        <SectionCard
          title="Questões Relacionadas & Prática do Assunto"
          subtitle="Resolva questões do banco oficial ligadas a este tópico (erros vão direto ao Caderno de Erros)"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('simulados')}
              className="min-h-[38px] px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Abrir Simulado Completo</span>
            </button>
          }
        >
          {topicQuestions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma questão vinculada a {getDisciplineShortName(activeDiscipline.id)} neste filtro. Use o Banco de
              Questões completo ou o Professor IA para gerar questões inéditas.
            </p>
          ) : (
            <div className="space-y-5">
              {topicQuestions.map((q, qIdx) => {
                const selected = quizAnswers[q.id];
                const answered = selected !== undefined;
                return (
                  <div key={q.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Questão {qIdx + 1} · {q.topicTitle}
                      </span>
                      <span className={q.isOfficial ? 'text-[#146C43] dark:text-emerald-400 font-semibold' : 'text-amber-800 dark:text-amber-400 font-medium'}>
                        {q.source || (q.isOfficial ? 'Fonte Oficial' : 'Treinamento')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">{q.statement}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, idx) => {
                        const isCorrect = idx === q.correctIndex;
                        const isChosen = selected === idx;
                        let cls = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800';
                        if (answered) {
                          if (isCorrect) cls = 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-950 dark:text-emerald-200 font-medium';
                          else if (isChosen) cls = 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-950 dark:text-red-200';
                        }
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectQuickAnswer(q, idx)}
                            className={`w-full text-left min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 transition-colors ${cls}`}
                          >
                            <span className="font-mono font-bold shrink-0">{LETTERS[idx]})</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {answered && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> Comentário:
                        </p>
                        <p>{q.explanation}</p>
                        {q.legalBasis && <p className="text-[#146C43] dark:text-emerald-400 font-medium">Base: {q.legalBasis}</p>}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => void handleOpenQuestionSource(q)}
                            className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#146C43] text-[11px] font-semibold text-[#0B3321] dark:text-emerald-300 inline-flex items-center gap-1.5"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>
                              {q.sourcePage ? `Abrir material na pág. ${q.sourcePage}` : 'Abrir material no trecho'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ABA 5: REVISÃO */}
      {activeRoomTab === 'revisao' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard
              title="Mapa Mental do Assunto"
              subtitle="Estrutura hierárquica para revisão visual rápida"
              rightSlot={
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => handleRunProfessorAction('generate_mindmap')}
                  className="min-h-[38px] px-3 py-1.5 bg-[#E8F3EC] dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  {loadingAction === 'generate_mindmap' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Network className="w-3.5 h-3.5" />
                  )}
                  <span>Gerar com IA</span>
                </button>
              }
            >
              <div className="mindmap-zoom-stage pinch-zoom-surface space-y-3">
                <div className="px-4 py-2.5 rounded-xl bg-[#0B3321] text-white text-sm font-display font-bold text-center">
                  {activeMindMap.centralTopic}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeMindMap.branches.map((branch, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="text-xs font-bold text-[#0B3321] dark:text-emerald-400">{branch.title}</p>
                      <ul className="space-y-1">
                        {branch.items.map((item, i) => (
                          <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                            <span className="text-[#146C43] dark:text-emerald-400 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Flashcards de Memorização Ativa"
              subtitle="Toque no cartão para virar e avaliar sua fixação"
              rightSlot={
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => handleRunProfessorAction('generate_flashcards')}
                  className="min-h-[38px] px-3 py-1.5 bg-[#E8F3EC] dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  {loadingAction === 'generate_flashcards' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  <span>Gerar flashcards IA</span>
                </button>
              }
            >
              <div className="space-y-3">
                {activeFlashcards.map((card) => {
                  const isFlipped = Boolean(flippedCards[card.id]);
                  const rating = cardRatings[card.id];
                  return (
                    <div
                      key={card.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 space-y-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => setFlippedCards((prev) => ({ ...prev, [card.id]: !isFlipped }))}
                        className="w-full text-left space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">
                          <span>{isFlipped ? 'VERSO · RESPOSTA' : 'FRENTE · PERGUNTA'}</span>
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <FlipHorizontal className="w-3.5 h-3.5" /> Virar cartão
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                          {isFlipped ? card.back : card.front}
                        </p>
                        {isFlipped && card.tip && (
                          <p className="text-xs text-[#0B3321] dark:text-emerald-200 bg-[#E8F3EC] dark:bg-emerald-950/50 px-2.5 py-1.5 rounded-lg">
                            Dica: {card.tip}
                          </p>
                        )}
                      </button>

                      {isFlipped && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setCardRatings((prev) => ({ ...prev, [card.id]: 'facil' }))}
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border ${
                              rating === 'facil'
                                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            Dominei
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardRatings((prev) => ({ ...prev, [card.id]: 'revisar' }))}
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border ${
                              rating === 'revisar'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            Revisar depois
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Caderno de Erros & Revisão Programada do Assunto"
            subtitle={`Próximo ciclo sugerido: ${addDaysIso(7).split('-').reverse().join('/')}`}
            rightSlot={
              <button
                type="button"
                onClick={() => onNavigate('revisions')}
                className="min-h-[38px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Abrir Revisões</span>
              </button>
            }
          >
            {topicErrors.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Nenhum erro pendente registrado neste tópico. Se você errar alguma questão na aba Questões ou nos
                  simulados, ela aparecerá aqui para revisão espaçada automática.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topicErrors.slice(0, 6).map((err) => (
                  <div key={err.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Status: {err.status === 'mastered' ? 'Dominada' : 'Pendente'}</span>
                      <span>Próx. revisão: {err.nextReviewDate.split('-').reverse().join('/')}</span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{err.questionStem}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ABA 6: PROGRESSO */}
      {activeRoomTab === 'progresso' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SectionCard
            title="Objetivos de Aprendizagem"
            subtitle="O que você precisa dominar neste tópico do Anexo II"
            className="lg:col-span-2"
          >
            <ul className="space-y-2">
              {activeTopic.subtopics.map((sub, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-[#146C43] dark:bg-emerald-400 shrink-0" />
                  <span>{sub}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono font-semibold text-[#0B3321] dark:text-emerald-400">
                Peso na disciplina: {activeDiscipline.examQuestions}q · {activeDiscipline.examPoints.toFixed(1)} pts
              </span>
              <span aria-hidden="true">·</span>
              <span>Ciclo recomendado: {activeDiscipline.recommendedMinutesPerCycle} min</span>
            </div>
          </SectionCard>

          <SectionCard
            title="Controle de Progresso"
            subtitle={`Domínio atual: ${progress?.masteryLevel ?? 0}%`}
          >
            <div className="space-y-3">
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#146C43] rounded-full transition-all"
                  style={{ width: `${progress?.masteryLevel ?? 0}%` }}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    { key: 'theoryDone', label: 'Teoria & Lei Seca concluída (40%)' },
                    { key: 'questionsDone', label: 'Bateria de Questões feita (40%)' },
                    { key: 'revisionDone', label: 'Revisão Espaçada registrada (20%)' },
                  ] as const
                ).map((step) => {
                  const done = Boolean(progress?.[step.key]);
                  return (
                    <button
                      key={step.key}
                      type="button"
                      disabled={savingProg}
                      onClick={() => handleToggleStage(step.key)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                        done
                          ? 'bg-[#E8F3EC] dark:bg-emerald-950/50 border-[#146C43] dark:border-emerald-600 text-[#0B3321] dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{step.label}</span>
                      <Check className={`w-4 h-4 shrink-0 ${done ? 'text-[#146C43] dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeBookMaterial && (
        <BookReaderModal
          material={activeBookMaterial}
          initialPage={readerInitialPage}
          initialChapterId={readerInitialChapterId}
          initialSearchQuery={readerInitialSearchQuery}
          onClose={() => {
            setActiveBookMaterial(null);
            setReaderInitialPage(undefined);
            setReaderInitialChapterId(undefined);
            setReaderInitialSearchQuery(undefined);
          }}
        />
      )}

      {playbackChoiceTarget && (
        <PlaybackChoiceModal
          material={playbackChoiceTarget.material}
          currentPreference={preferences.mediaPlaybackPreference || 'ask'}
          onChooseInternal={(savePref) => handlePlaybackChoice('internal', savePref)}
          onChooseExternal={(savePref) => handlePlaybackChoice('external', savePref)}
          onClose={() => setPlaybackChoiceTarget(null)}
        />
      )}

      {modalMediaPlayer && (
        <MediaPlaybackModal
          material={modalMediaPlayer.material}
          initialMode={modalMediaPlayer.mode}
          initialStartSeconds={modalMediaPlayer.startSeconds}
          onClose={() => setModalMediaPlayer(null)}
        />
      )}
    </div>
  );
}
