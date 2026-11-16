import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMedioCargoInfo, isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import { apiFetch } from '../lib/apiClient';
import { searchDocumentIndexWithFallback } from '../lib/documentIndexer';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import {
  buildSimuladoDistributionPlan,
  collectTopicsForDisciplines,
  matchesDifficultyFilter,
  matchesOriginFilter as matchesQuestionOriginFilter,
  matchesQuestionTopic,
  type DifficultyFilter,
  type GeneratorStrategy,
  type OriginFilter,
} from '../lib/filterHelpers';
import { BookReaderModal } from './BookReaderModal';
import {
  CampusLevel,
  ErrorReason,
  MedioCargoGroup,
  Question,
  QuestionDifficulty,
  QuestionOriginType,
  SimuladoList,
  StudyMaterial,
} from '../types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

const ORIGIN_LABELS: Record<QuestionOriginType, string> = {
  official_cetap: 'Oficial · Provas Anteriores CETAP',
  official_camara: 'Oficial · Câmara dos Deputados',
  official_alepa: 'Oficial · Banco de Leis ALEPA',
  training_platform: 'Não oficial · Treinamento complementar',
  ai_generated: 'Gerada por IA · Treino Inédito',
};

function shuffleQuestions<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function SimuladosView({
  campus,
  medioCargoGroup = 'cargo_01_04',
}: {
  campus: CampusLevel;
  medioCargoGroup?: MedioCargoGroup;
}) {
  const {
    questions,
    materials,
    simuladoLists,
    preferences,
    toggleFavoriteQuestion,
    saveSimuladoAttempt,
    addErrorEntry,
    addCustomQuestion,
    canPublishShared,
    canAccessTeacherPanel,
    getCampusDisciplines,
    user,
    profile,
  } = useAuth();
  const canCreateQuestion = canPublishShared || canAccessTeacherPanel;
  const uid = user?.uid || profile?.uid || 'guest_local';
  const draftStorageKey = `alepa_simulado_draft_${uid}_${campus}_${medioCargoGroup}`;

  const isMedio = campus === 'medio';
  const activeDisciplines = useMemo(
    () => getCampusDisciplines(campus, medioCargoGroup),
    [getCampusDisciplines, campus, medioCargoGroup]
  );
  const activeDisciplineIds = useMemo(() => new Set(activeDisciplines.map((d) => d.id)), [activeDisciplines]);

  const publishedSimuladoLists = useMemo(
    () => simuladoLists.filter((s) => s.campusLevel === 'geral' || s.campusLevel === campus),
    [simuladoLists, campus]
  );

  const activeCargoInfo = useMemo(() => getMedioCargoInfo(medioCargoGroup), [medioCargoGroup]);
  const activeCargoLabel = useMemo(() => {
    if (!isMedio) return 'Cargo 03 – Técnico Legislativo (PL.AL.102 · Nível Superior)';
    return `${activeCargoInfo.cargoNumber} – ${activeCargoInfo.title} (${activeCargoInfo.code} · Nível Médio)`;
  }, [isMedio, activeCargoInfo]);

  const campusQuestions = useMemo(
    () =>
      questions.filter((q) =>
        isMedio
          ? isMedioDisciplineId(q.disciplineId) && activeDisciplineIds.has(q.disciplineId)
          : !isMedioDisciplineId(q.disciplineId)
      ),
    [questions, isMedio, activeDisciplineIds]
  );

  // Collapsible Sections State (always collapsed by default across desktop and mobile)
  const [cargoOverviewOpen, setCargoOverviewOpen] = useState<boolean>(false);
  const [generatorOpen, setGeneratorOpen] = useState<boolean>(false);
  const [sourcesOpen, setSourcesOpen] = useState<boolean>(false);
  const [bankFiltersOpen, setBankFiltersOpen] = useState<boolean>(false);

  const allPanelsCollapsed = !cargoOverviewOpen && !generatorOpen && !sourcesOpen && !bankFiltersOpen;

  const handleToggleAllPanels = () => {
    const nextState = allPanelsCollapsed;
    setCargoOverviewOpen(nextState);
    setGeneratorOpen(nextState);
    setSourcesOpen(nextState);
    setBankFiltersOpen(nextState);
  };

  const [genSelectedDiscs, setGenSelectedDiscs] = useState<string[]>(() =>
    activeDisciplines.map((d) => d.id)
  );
  const [genSelectedTopics, setGenSelectedTopics] = useState<string[]>([]);
  const [genCount, setGenCount] = useState<number>(15);
  const [genDifficulty, setGenDifficulty] = useState<DifficultyFilter>('all');
  const [genStrategy, setGenStrategy] = useState<GeneratorStrategy>('proportional');
  const [genOrigin, setGenOrigin] = useState<OriginFilter>('all');
  const [genMode, setGenMode] = useState<'simulado' | 'treino'>('simulado');
  const [activeSessionTitle, setActiveSessionTitle] = useState<string | null>(null);

  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [mode, setMode] = useState<'treino' | 'simulado'>('treino');
  const [activeDeck, setActiveDeck] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [addedErrors, setAddedErrors] = useState<Record<string, boolean>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [aiExplainingId, setAiExplainingId] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [generatingAiDeck, setGeneratingAiDeck] = useState(false);

  // Create Question Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qDisc, setQDisc] = useState(activeDisciplines[0].id);
  const [qTopic, setQTopic] = useState('');
  const [qStatement, setQStatement] = useState('');
  const [qOptions, setQOptions] = useState<[string, string, string, string, string]>(['', '', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qLegalBasis, setQLegalBasis] = useState('');
  const [qOriginType, setQOriginType] = useState<QuestionOriginType>('training_platform');
  const [qDifficulty, setQDifficulty] = useState<QuestionDifficulty>('intermediario');
  const [qPublishClass, setQPublishClass] = useState(false);

  const [restoredDraftNotice, setRestoredDraftNotice] = useState(false);
  const [readerTarget, setReaderTarget] = useState<{
    material: StudyMaterial;
    page?: number;
    query?: string;
  } | null>(null);
  const [openingSourceId, setOpeningSourceId] = useState<string | null>(null);
  const hydratedContextKeyRef = useRef<string | null>(null);

  const favoriteQuestionIds = preferences.favoriteQuestionIds || [];

  const matchesOriginFilter = useCallback(
    (q: Question, origin: OriginFilter): boolean => matchesQuestionOriginFilter(q, origin),
    []
  );

  const clearDraftStorage = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    setRestoredDraftNotice(false);
  }, [draftStorageKey]);

  const startSession = useCallback(
    (
      selectedDisc: string,
      selectedOrigin: OriginFilter,
      selectedMode: 'treino' | 'simulado',
      selectedDiff: DifficultyFilter = difficultyFilter,
      favOnly: boolean = onlyFavorites,
      selectedTopic: string = topicFilter
    ) => {
      const pool = campusQuestions.filter((q) => {
        if (selectedDisc !== 'all' && q.disciplineId !== selectedDisc) return false;
        if (!matchesOriginFilter(q, selectedOrigin)) return false;
        if (!matchesDifficultyFilter(q, selectedDiff)) return false;
        if (selectedTopic !== 'all' && !matchesQuestionTopic(q.topicTitle, selectedTopic)) return false;
        if (favOnly && !favoriteQuestionIds.includes(q.id)) return false;
        return true;
      });
      const deck = selectedMode === 'simulado' ? pool.slice(0, 20) : pool;
      setActiveDeck(deck);
      setCurrentIndex(0);
      setAnswers({});
      setSubmitted(false);
      setSecondsElapsed(0);
      setSaveFeedback(null);
      setActiveSessionTitle(null);
      setAddedErrors({});
      setFlaggedIds({});
      clearDraftStorage();
    },
    [campusQuestions, difficultyFilter, onlyFavorites, topicFilter, matchesOriginFilter, favoriteQuestionIds, clearDraftStorage]
  );

  // Restore draft or initialize session ONLY when context (uid/campus/cargo) changes,
  // or when initial deck is empty on first question hydration — never clobbering active progress.
  useEffect(() => {
    const contextKey = `${uid}_${campus}_${medioCargoGroup}`;
    const isContextSwitch = hydratedContextKeyRef.current !== contextKey;
    if (!isContextSwitch && activeDeck.length > 0) return;
    if (campusQuestions.length === 0) return;

    hydratedContextKeyRef.current = contextKey;

    if (isContextSwitch) {
      setDisciplineFilter('all');
      setTopicFilter('all');
      setQDisc(activeDisciplines[0]?.id || (isMedio ? 'nm_portugues' : 'processo_legislativo'));
      setGenSelectedDiscs(activeDisciplines.map((d) => d.id));
      setGenSelectedTopics([]);
    }

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const draft = JSON.parse(raw) as {
          deckIds?: string[];
          currentIndex?: number;
          answers?: Record<string, number>;
          submitted?: boolean;
          secondsElapsed?: number;
          flaggedIds?: Record<string, boolean>;
          mode?: 'treino' | 'simulado';
          activeSessionTitle?: string | null;
        };
        if (Array.isArray(draft.deckIds) && draft.deckIds.length > 0 && !draft.submitted) {
          const questionMap = new Map(campusQuestions.map((q) => [q.id, q]));
          const restoredDeck = draft.deckIds
            .map((id) => questionMap.get(id))
            .filter((q): q is Question => Boolean(q));
          if (restoredDeck.length > 0) {
            setActiveDeck(restoredDeck);
            setCurrentIndex(
              Math.min(Math.max(0, Number(draft.currentIndex) || 0), restoredDeck.length - 1)
            );
            setAnswers(draft.answers || {});
            setSubmitted(false);
            setSecondsElapsed(Math.max(0, Number(draft.secondsElapsed) || 0));
            setFlaggedIds(draft.flaggedIds || {});
            setMode(draft.mode === 'simulado' ? 'simulado' : 'treino');
            setActiveSessionTitle(draft.activeSessionTitle ?? null);
            setRestoredDraftNotice(true);
            return;
          }
        }
      }
    } catch {
      // fall through to clean session start
    }

    startSession('all', originFilter, mode, difficultyFilter, onlyFavorites);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, campus, medioCargoGroup, campusQuestions.length]);

  // Persist active progress automatically whenever answers/index/flags change
  useEffect(() => {
    if (activeDeck.length === 0) return;
    if (submitted) {
      clearDraftStorage();
      return;
    }
    try {
      const hasProgress =
        Object.keys(answers).length > 0 ||
        Object.keys(flaggedIds).length > 0 ||
        currentIndex > 0 ||
        Boolean(activeSessionTitle);
      if (!hasProgress) return;
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          deckIds: activeDeck.map((q) => q.id),
          currentIndex,
          answers,
          submitted,
          secondsElapsed,
          flaggedIds,
          mode,
          activeSessionTitle,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    activeDeck,
    answers,
    flaggedIds,
    currentIndex,
    submitted,
    secondsElapsed,
    mode,
    activeSessionTitle,
    draftStorageKey,
    clearDraftStorage,
  ]);

  const availableGenTopics = useMemo(
    () => collectTopicsForDisciplines(activeDisciplines, genSelectedDiscs, campusQuestions),
    [activeDisciplines, genSelectedDiscs, campusQuestions]
  );

  const availableBankTopics = useMemo(
    () =>
      collectTopicsForDisciplines(
        activeDisciplines,
        disciplineFilter === 'all' ? activeDisciplines.map((d) => d.id) : [disciplineFilter],
        campusQuestions
      ),
    [activeDisciplines, disciplineFilter, campusQuestions]
  );

  const generatorPlan = useMemo(
    () =>
      buildSimuladoDistributionPlan({
        disciplines: activeDisciplines,
        campusQuestions,
        selectedDiscIds: genSelectedDiscs,
        selectedTopics: genSelectedTopics,
        difficultyFilter: genDifficulty,
        originFilter: genOrigin,
        targetCountInput: genCount,
        strategy: genStrategy,
      }),
    [activeDisciplines, campusQuestions, genSelectedDiscs, genSelectedTopics, genDifficulty, genOrigin, genCount, genStrategy]
  );

  const handleToggleGenDiscipline = (discId: string) => {
    setGenSelectedDiscs((prev) => {
      const next = prev.includes(discId) ? prev.filter((id) => id !== discId) : [...prev, discId];
      const nextTopicsSet = new Set(
        collectTopicsForDisciplines(activeDisciplines, next, campusQuestions).map((t) => t.title)
      );
      setGenSelectedTopics((prevTopics) => prevTopics.filter((t) => nextTopicsSet.has(t)));
      return next;
    });
  };

  const handleToggleGenTopic = (topicTitle: string) => {
    setGenSelectedTopics((prev) =>
      prev.includes(topicTitle) ? prev.filter((t) => t !== topicTitle) : [...prev, topicTitle]
    );
  };

  const handleGenerateCustomSimulado = () => {
    if (generatorPlan.targetCount === 0) return;

    const chosenQuestions: Question[] = [];
    generatorPlan.breakdown.forEach((item) => {
      if (item.planned > 0) {
        const shuffled = shuffleQuestions(generatorPlan.poolByDisc.get(item.discipline.id) || []);
        chosenQuestions.push(...shuffled.slice(0, item.planned));
      }
    });

    const finalDeck = shuffleQuestions(chosenQuestions);
    const discNames = generatorPlan.breakdown
      .filter((b) => b.planned > 0)
      .map((b) => `${b.discipline.shortName} (${b.planned})`)
      .join(', ');

    const genTitle = `Simulado Personalizado · ${isMedio ? `Médio ${activeCargoInfo.code}` : 'Superior PL.AL.102'} (${finalDeck.length}q)`;
    setMode(genMode);
    setOriginFilter(genOrigin);
    setDifficultyFilter(genDifficulty);
    setActiveDeck(finalDeck);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setSecondsElapsed(0);
    setAddedErrors({});
    setFlaggedIds({});
    setGeneratorOpen(false);
    setActiveSessionTitle(genTitle);
    setSaveFeedback(
      `Simulado gerado com ${finalDeck.length} questões para ${activeCargoLabel.split('(')[0].trim()}: ${discNames}.`
    );
  };

  const handleStartPublishedSimulado = (list: SimuladoList) => {
    const idSet = new Set(list.questionIds);
    const chosen = questions.filter((q) => idSet.has(q.id));
    if (chosen.length === 0) {
      setSaveFeedback('As questões desta lista oficial ainda não estão disponíveis no banco.');
      return;
    }
    setMode('simulado');
    setOriginFilter('all');
    setActiveDeck(chosen);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setSecondsElapsed(0);
    setAddedErrors({});
    setFlaggedIds({});
    setActiveSessionTitle(`${list.title} (${chosen.length}q · ${list.durationMinutes} min)`);
    setSaveFeedback(`Simulado oficial "${list.title}" iniciado com ${chosen.length} questões.`);
  };

  const handleGenerateAiQuestionsDeck = async () => {
    const targetDiscId =
      disciplineFilter !== 'all' ? disciplineFilter : genSelectedDiscs[0] || activeDisciplines[0]?.id;
    const disc = activeDisciplines.find((d) => d.id === targetDiscId) || activeDisciplines[0];
    if (!disc) return;
    setGeneratingAiDeck(true);
    setSaveFeedback(null);
    try {
      const res = await apiFetch('/api/gemini/professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_questions',
          campus,
          disciplineName: disc.name,
          topicTitle: disc.topics[0]?.title || disc.name,
          subtopics: disc.topics[0]?.subtopics || [],
          questionCount: 3,
        }),
      });
      const json = (await res.json()) as { error?: string; questions?: Question[] };
      if (!res.ok || !Array.isArray(json.questions) || json.questions.length === 0) {
        throw new Error(json.error || 'Não foi possível gerar questões com IA.');
      }
      const mapped = json.questions.map((q) => ({ ...q, disciplineId: disc.id }));
      setMode('treino');
      setActiveDeck(mapped);
      setCurrentIndex(0);
      setAnswers({});
      setSubmitted(false);
      setSecondsElapsed(0);
      setAddedErrors({});
      setFlaggedIds({});
      setRestoredDraftNotice(false);
      setActiveSessionTitle(`Treino IA · ${disc.shortName} (${mapped.length}q inéditas)`);
      setSaveFeedback(`3 questões inéditas de ${disc.shortName} geradas pelo Professor IA (marcadas como treino não oficial).`);
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Erro ao gerar questões com IA.');
    } finally {
      setGeneratingAiDeck(false);
    }
  };

  const handleExplainCurrentWithAi = async (q: Question) => {
    setAiExplainingId(q.id);
    try {
      const res = await apiFetch('/api/gemini/professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explain_question',
          campus,
          disciplineName: getDisciplineShortName(q.disciplineId),
          topicTitle: q.topicTitle,
          questionStatement: q.statement,
          questionOptions: q.options,
          correctIndex: q.correctIndex,
          selectedIndex: answers[q.id],
          legalBasis: q.legalBasis,
        }),
      });
      const json = (await res.json()) as { error?: string; text?: string };
      if (!res.ok || !json.text) {
        throw new Error(json.error || 'Erro ao explicar questão.');
      }
      setAiExplanations((prev) => ({ ...prev, [q.id]: json.text! }));
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Não foi possível explicar com o Professor IA.');
    } finally {
      setAiExplainingId(null);
    }
  };

  const handleOpenSourceMaterial = async (q: Question) => {
    setOpeningSourceId(q.id);
    try {
      if (q.sourceMaterialId) {
        const directMat = materials.find((m) => m.id === q.sourceMaterialId);
        if (directMat && isInAppReadableMaterial(directMat)) {
          setReaderTarget({
            material: directMat,
            page: q.sourcePage,
            query: q.sourceExcerpt || q.topicTitle,
          });
          return;
        }
      }

      const query = `${q.topicTitle} ${q.legalBasis || ''}`.trim();
      const hits = await searchDocumentIndexWithFallback({
        query,
        materials,
        campusLevel: campus,
        disciplineId: q.disciplineId,
        limit: 3,
      });

      for (const hit of hits) {
        const matchedMat = materials.find((m) => m.id === hit.chunk.materialId);
        if (matchedMat && isInAppReadableMaterial(matchedMat)) {
          setReaderTarget({
            material: matchedMat,
            page: hit.chunk.pageNumber,
            query: q.sourceExcerpt || q.topicTitle,
          });
          return;
        }
      }

      const fallbackMat = materials.find(
        (m) => m.disciplineId === q.disciplineId && isInAppReadableMaterial(m)
      );
      if (fallbackMat) {
        setReaderTarget({
          material: fallbackMat,
          query: q.legalBasis || q.topicTitle,
        });
        return;
      }

      setSaveFeedback(
        'Nenhum trecho indexado ou material compatível encontrado para esta questão. Indexe apostilas no Acervo/Admin para vincular páginas automaticamente.'
      );
    } finally {
      setOpeningSourceId(null);
    }
  };

  useEffect(() => {
    if (submitted || activeDeck.length === 0) return;
    const t = window.setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [submitted, activeDeck.length]);

  const currentQuestion = activeDeck[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleSelectOption = async (optionIdx: number) => {
    if (!currentQuestion || submitted) return;
    if (mode === 'treino' && answers[currentQuestion.id] !== undefined) return;

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIdx }));

    if (mode === 'treino' && optionIdx !== currentQuestion.correctIndex) {
      try {
        await addErrorEntry({
          questionId: currentQuestion.id,
          disciplineId: currentQuestion.disciplineId,
          topicTitle: currentQuestion.topicTitle,
          questionStem: currentQuestion.statement,
          correctOption: `${LETTERS[currentQuestion.correctIndex]}) ${currentQuestion.options[currentQuestion.correctIndex]}`,
          selectedOption: `${LETTERS[optionIdx]}) ${currentQuestion.options[optionIdx]}`,
          errorReason: 'teoria',
          improvementNote: currentQuestion.explanation,
        });
        setAddedErrors((prev) => ({ ...prev, [currentQuestion.id]: true }));
      } catch {
        // handled gracefully if email is not verified yet
      }
    }
  };

  const handleFinishSimulado = async () => {
    if (activeDeck.length === 0) return;
    setSubmitted(true);
    let correctCount = 0;
    const wrongQuestions: Question[] = [];

    activeDeck.forEach((q) => {
      if (answers[q.id] === q.correctIndex) {
        correctCount += 1;
      } else if (answers[q.id] !== undefined) {
        wrongQuestions.push(q);
      }
    });

    const ratio = correctCount / activeDeck.length;
    const scoreOutOfTen = Number((ratio * 10).toFixed(2));

    try {
      await saveSimuladoAttempt({
        title:
          activeSessionTitle ||
          (mode === 'simulado'
            ? `Simulado CETAP · ${isMedio ? `Nível Médio (${activeCargoInfo.code})` : 'Nível Superior'} (${disciplineFilter === 'all' ? 'Geral' : getDisciplineShortName(disciplineFilter)})`
            : `Bateria de Treino · ${isMedio ? `Nível Médio (${activeCargoInfo.code})` : 'Nível Superior'} (${disciplineFilter === 'all' ? 'Geral' : getDisciplineShortName(disciplineFilter)})`),
        mode,
        primaryDisciplineId:
          activeSessionTitle
            ? activeDisciplines[0]?.id || (isMedio ? 'nm_geral' : 'processo_legislativo')
            : disciplineFilter === 'all'
              ? isMedio
                ? 'nm_geral'
                : 'processo_legislativo'
              : disciplineFilter,
        totalQuestions: activeDeck.length,
        correctCount,
        score: scoreOutOfTen,
        durationSeconds: secondsElapsed,
      });

      for (const wq of wrongQuestions) {
        const chosenIdx = answers[wq.id];
        await addErrorEntry({
          questionId: wq.id,
          disciplineId: wq.disciplineId,
          topicTitle: wq.topicTitle,
          questionStem: wq.statement,
          correctOption: `${LETTERS[wq.correctIndex]}) ${wq.options[wq.correctIndex]}`,
          selectedOption: `${LETTERS[chosenIdx]}) ${wq.options[chosenIdx]}`,
          errorReason: 'banca_cetap' as ErrorReason,
          improvementNote: wq.explanation,
        });
      }

      setSaveFeedback(
        `Resultado salvo (${correctCount}/${activeDeck.length} · Nota ${scoreOutOfTen.toFixed(1)}/10). Questões erradas enviadas ao Caderno de Erros.`
      );
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Resultado exibido localmente.');
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isOfficial = qOriginType !== 'training_platform' && qOriginType !== 'ai_generated';
      await addCustomQuestion({
        disciplineId: qDisc,
        topicTitle: qTopic,
        statement: qStatement,
        options: qOptions,
        correctIndex: qCorrect,
        explanation: qExplanation,
        legalBasis: qLegalBasis,
        source: ORIGIN_LABELS[qOriginType],
        originType: qOriginType,
        difficulty: qDifficulty,
        isOfficial,
        isPublished: qPublishClass,
      });
      setShowCreateModal(false);
      setQTopic('');
      setQStatement('');
      setQOptions(['', '', '', '', '']);
      setQExplanation('');
      setQLegalBasis('');
      setSaveFeedback('Nova questão adicionada com identificação de origem e dificuldade!');
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Erro ao criar questão.');
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const answeredCount = activeDeck.filter((q) => answers[q.id] !== undefined).length;
  const correctTotal = activeDeck.filter((q) => answers[q.id] === q.correctIndex).length;
  const aiCount = campusQuestions.filter((q) => q.originType === 'ai_generated').length;
  const officialCount = campusQuestions.filter((q) => q.isOfficial && q.originType !== 'ai_generated').length;
  const trainingCount = campusQuestions.length - officialCount - aiCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
            {isMedio
              ? `ALEPA 2026 – Nível Médio · ${activeCargoInfo.shortTitle} (${activeCargoInfo.code}) · Banco Independente`
              : 'ALEPA 2026 – Nível Superior · Cargo 03 – Técnico Legislativo (PL.AL.102) · Banco Independente'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Banco de Questões e Simulados ({isMedio ? 'Nível Médio' : 'Nível Superior'})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleAllPanels}
            className="min-h-[44px] px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            {allPanelsCollapsed ? <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            <span>{allPanelsCollapsed ? 'Expandir painéis' : 'Recolher painéis'}</span>
          </button>

          <button
            type="button"
            disabled={generatingAiDeck}
            onClick={() => void handleGenerateAiQuestionsDeck()}
            className="min-h-[44px] px-3.5 py-2 bg-[#E8F3EC] dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[#0B3321] dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {generatingAiDeck ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{generatingAiDeck ? 'Gerando IA...' : '3 Questões IA'}</span>
          </button>

          {canCreateQuestion && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[44px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar questão</span>
            </button>
          )}
        </div>
      </div>

      {/* Separação de Simulados por Cargo + Quantidade de Questões na Prova */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <button
          type="button"
          aria-expanded={cargoOverviewOpen}
          onClick={() => setCargoOverviewOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left gap-3"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400">
              {isMedio
                ? `Simulado separado por cargo · Nível Médio (${activeCargoInfo.cargoNumber} – ${activeCargoInfo.code})`
                : 'Simulado separado por cargo · Nível Superior (Cargo 03 – PL.AL.102)'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {isMedio
                ? 'Questões e simulados isolados para o Edital 001/2026 (Ensino Médio Completo), respeitando a Fundação CETAP.'
                : 'Questões e simulados isolados para o Edital 002/2026 (Ensino Superior), respeitando o Cargo 03.'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block text-right font-mono tabular-nums">
              <span className="text-sm font-bold text-[#0B3321] dark:text-emerald-300">50 questões</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">10,0 pts (0,20/q)</p>
            </div>
            <div className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500">
              {cargoOverviewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {cargoOverviewOpen && isMedio && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
              <p className="font-mono font-bold text-[#0B3321] dark:text-emerald-300">20 questões</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Conhec. Específicos (4,0 pts)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
              <p className="font-mono font-bold text-[#0B3321] dark:text-emerald-300">10 questões</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Legislação e Ética (2,0 pts)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
              <p className="font-mono font-bold text-[#0B3321] dark:text-emerald-300">10 questões</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Língua Portuguesa (2,0 pts)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
              <p className="font-mono font-bold text-[#0B3321] dark:text-emerald-300">05 questões</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Raciocínio Lógico (1,0 pt)</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
              <p className="font-mono font-bold text-[#0B3321] dark:text-emerald-300">05 questões</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Noções de Informática (1,0 pt)</p>
            </div>
          </div>
        )}
      </section>

      {/* Simulados e Listas Oficiais Publicados pela Coordenação */}
      {publishedSimuladoLists.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400">Listas Oficiais Publicadas</p>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Simulados & Baterias Recomendadas do Campus
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{publishedSimuladoLists.length} disponíveis</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {publishedSimuladoLists.map((list) => (
              <div
                key={list.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#146C43] dark:text-emerald-400 font-semibold">
                    <span>{list.questionIds.length} questões</span>
                    <span>{list.durationMinutes} min recomendados</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{list.title}</h3>
                  {list.description && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{list.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleStartPublishedSimulado(list)}
                  className="min-h-[40px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl w-full sm:w-fit"
                >
                  Iniciar simulado oficial
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gerador Automático de Simulados por Conteúdo Programático do Cargo */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
              <span>Montar Simulado Personalizado</span>
            </h2>
            <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400">
              {isMedio ? activeCargoInfo.shortTitle : 'Cargo 03 · Assessoramento Legislativo'}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {isMedio
                ? `${activeCargoInfo.code} · Nível Médio · Banca CETAP · ${campusQuestions.length} disponíveis · 50 na prova`
                : `PL.AL.102 · Nível Superior · Banca CETAP · ${campusQuestions.length} disponíveis · 50 na prova`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={generatorPlan.targetCount === 0}
              onClick={handleGenerateCustomSimulado}
              className="min-h-[40px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-40 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gerar e iniciar simulado ({generatorPlan.targetCount}q)</span>
            </button>

            <button
              type="button"
              aria-expanded={generatorOpen}
              aria-controls="simulados-custom-generator-panel"
              onClick={() => setGeneratorOpen((v) => !v)}
              className="min-h-[40px] px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:border-[#0B3321] bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{generatorOpen ? 'Recolher opções' : 'Personalizar etapas'}</span>
              {generatorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {generatorOpen && (
          <div id="simulados-custom-generator-panel" className="space-y-5">
            {/* Step 1: Seleção de disciplinas */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  1. Seleção de disciplinas ({genSelectedDiscs.length}/{activeDisciplines.length} marcadas)
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setGenSelectedDiscs(activeDisciplines.map((d) => d.id));
                      setGenSelectedTopics([]);
                    }}
                    className="font-semibold text-[#0B3321] dark:text-emerald-400 hover:underline"
                  >
                    Selecionar todas
                  </button>
                  <span aria-hidden="true" className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGenSelectedDiscs(
                        activeDisciplines
                          .filter((d) => d.editalBlock === 'Conhecimentos Específicos')
                          .map((d) => d.id)
                      );
                      setGenSelectedTopics([]);
                    }}
                    className="font-medium text-slate-700 dark:text-slate-300 hover:underline"
                  >
                    Somente Específicos
                  </button>
                  <span aria-hidden="true" className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGenSelectedDiscs(
                        activeDisciplines
                          .filter((d) => d.editalBlock !== 'Conhecimentos Específicos')
                          .map((d) => d.id)
                      );
                      setGenSelectedTopics([]);
                    }}
                    className="font-medium text-slate-700 dark:text-slate-300 hover:underline"
                  >
                    Somente Básicas
                  </button>
                  <span aria-hidden="true" className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGenSelectedDiscs([]);
                      setGenSelectedTopics([]);
                    }}
                    className="font-medium text-slate-500 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeDisciplines.map((d) => {
                  const checked = genSelectedDiscs.includes(d.id);
                  const availInDisc = campusQuestions.filter((q) => {
                    if (q.disciplineId !== d.id) return false;
                    if (!matchesOriginFilter(q, genOrigin)) return false;
                    if (!matchesDifficultyFilter(q, genDifficulty)) return false;
                    return true;
                  }).length;

                  return (
                    <label
                      key={d.id}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-2.5 ${
                        checked
                          ? 'border-[#0B3321] bg-emerald-50/50 dark:bg-emerald-950/50 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleGenDiscipline(d.id)}
                        className="mt-0.5 accent-[#0B3321]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {d.priorityRank}º · {d.shortName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          {d.topics.length} tópicos · peso {d.examQuestions}q · {availInDisc} no banco
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Seleção de assuntos */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  2. Seleção de assuntos ({genSelectedTopics.length === 0 ? 'Todos os assuntos' : `${genSelectedTopics.length} selecionado(s)`})
                </p>
                {genSelectedTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGenSelectedTopics([])}
                    className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 hover:underline"
                  >
                    Incluir todos os assuntos
                  </button>
                )}
              </div>

              {availableGenTopics.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Marque ao menos uma disciplina na etapa 1 para filtrar assuntos específicos.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {availableGenTopics.map((topic) => {
                    const checked = genSelectedTopics.includes(topic.title);
                    return (
                      <label
                        key={`${topic.disciplineId}-${topic.title}`}
                        className={`px-2.5 py-2 rounded-lg border cursor-pointer flex items-start gap-2 text-xs transition-colors ${
                          checked
                            ? 'border-[#0B3321] bg-emerald-50/50 dark:bg-emerald-950/50 text-slate-900 dark:text-slate-100'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleGenTopic(topic.title)}
                          className="mt-0.5 accent-[#0B3321]"
                        />
                        <span className="min-w-0 leading-snug">
                          <strong className="font-semibold text-[#146C43] dark:text-emerald-400">
                            {topic.disciplineShortName}:
                          </strong>{' '}
                          {topic.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Steps 3, 4 e 5: Quantidade, Dificuldade e Origem */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label htmlFor="gen-count-input" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  3. Quantidade de questões
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[5, 10, 15, 20, 30, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGenCount(preset)}
                      className={`min-h-[34px] px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border ${
                        genCount === preset
                          ? 'border-[#0B3321] bg-[#0B3321] text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <input
                    id="gen-count-input"
                    type="number"
                    min={1}
                    max={50}
                    value={genCount}
                    onChange={(e) => setGenCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    aria-label="Quantidade personalizada de questões"
                    className="w-16 min-h-[34px] px-2 py-1 text-xs font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gen-difficulty-select" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  4. Nível de dificuldade
                </label>
                <select
                  id="gen-difficulty-select"
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as DifficultyFilter)}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">Todos os níveis</option>
                  <option value="basico">Básico</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gen-origin-select" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  5. Origem das questões
                </label>
                <select
                  id="gen-origin-select"
                  value={genOrigin}
                  onChange={(e) => setGenOrigin(e.target.value as OriginFilter)}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">Todas (Oficiais + Treinamento)</option>
                  <option value="official">Somente Oficiais (CETAP / Câmara / ALEPA)</option>
                  <option value="training">Somente Treinamento Complementar</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gen-mode-select" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Distribuição & Modo
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    aria-label="Distribuição pelo edital"
                    value={genStrategy}
                    onChange={(e) => setGenStrategy(e.target.value as GeneratorStrategy)}
                    className="w-full min-h-[38px] px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="proportional">Proporcional CETAP</option>
                    <option value="balanced">Equilibrada</option>
                  </select>
                  <select
                    id="gen-mode-select"
                    value={genMode}
                    onChange={(e) => setGenMode(e.target.value as 'simulado' | 'treino')}
                    className="w-full min-h-[38px] px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="simulado">Simulado (Nota)</option>
                    <option value="treino">Treino (Comentado)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 6: Iniciar simulado & Prévia de Distribuição */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  6. Iniciar simulado · Prévia:{' '}
                  <span className="font-mono text-[#0B3321] dark:text-emerald-300">
                    {generatorPlan.targetCount} {generatorPlan.targetCount === 1 ? 'questão' : 'questões'}
                  </span>{' '}
                  em <span className="font-mono text-[#0B3321] dark:text-emerald-300">{generatorPlan.selectedCount}</span>{' '}
                  {generatorPlan.selectedCount === 1 ? 'disciplina' : 'disciplinas'}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {generatorPlan.breakdown.filter((b) => b.planned > 0).length > 0
                    ? generatorPlan.breakdown
                        .filter((b) => b.planned > 0)
                        .map((b) => `${b.discipline.shortName}: ${b.planned}q`)
                        .join(' · ')
                    : 'Selecione pelo menos uma disciplina e assunto com questões disponíveis.'}
                </p>
                {genCount > generatorPlan.maxAvailable && generatorPlan.maxAvailable > 0 && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Para os filtros atuais há {generatorPlan.maxAvailable} questões únicas no banco (você pediu{' '}
                    {genCount}). Amplie os assuntos ou disciplinas para sortear mais questões.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={generatorPlan.targetCount === 0}
                onClick={handleGenerateCustomSimulado}
                className="min-h-[44px] px-5 py-2.5 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-40 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Gerar e iniciar simulado ({generatorPlan.targetCount}q)</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4 Fontes de Questões & Simulados: Oficiais vs. Treinamento */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <button
          type="button"
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left gap-3"
        >
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Origens de Questões e Simulados (Oficiais × Treinamento Complementar)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Separação explícita entre questões oficiais (CETAP, Câmara e ALEPA) e plataformas não oficiais para treinamento.
            </p>
          </div>
          <div className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 shrink-0">
            {sourcesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {sourcesOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <a
              href="https://www.pciconcursos.com.br/provas/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2 transition-colors"
            >
              <div>
                <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Oficial · Provas Anteriores</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">Fundação CETAP</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Acervo de provas anteriores e gabaritos no PCI Provas.</p>
              </div>
              <span className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 inline-flex items-center gap-1">
                Abrir PCI Provas <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a
              href="https://www2.camara.leg.br/transparencia/servicos-ao-cidadao/educacao-cultura-e-responsabilidade-social"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2 transition-colors"
            >
              <div>
                <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Oficial · Questões Legislativas</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">Câmara dos Deputados</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Educação legislativa e técnica parlamentar oficial.</p>
              </div>
              <span className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 inline-flex items-center gap-1">
                Abrir Câmara <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a
              href="https://bancodeleis.alepa.pa.gov.br/index.php?p=1&tipo=10"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2 transition-colors"
            >
              <div>
                <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Oficial · Legislação Estadual</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">Banco de Leis da ALEPA</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Base normativa estadual para questões de legislação.</p>
              </div>
              <span className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 inline-flex items-center gap-1">
                Abrir Banco de Leis <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a
              href="https://www.pciconcursos.com.br/simulados/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 hover:border-amber-600 dark:hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col justify-between gap-2 transition-colors"
            >
              <div>
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Não oficial · Treinamento complementar</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">PCI Concursos Simulados</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Plataforma externa de treino por disciplina.</p>
              </div>
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-300 inline-flex items-center gap-1">
                Abrir PCI Simulados <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          </div>
        )}
      </section>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('treino');
                  startSession(disciplineFilter, originFilter, 'treino', difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  mode === 'treino'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Modo Treino (Comentado)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('simulado');
                  startSession(disciplineFilter, originFilter, 'simulado', difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  mode === 'simulado'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Simulado Cronometrado
              </button>
            </div>

            <button
              type="button"
              aria-expanded={bankFiltersOpen}
              aria-controls="simulados-bank-filters-panel"
              onClick={() => setBankFiltersOpen((prev) => !prev)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-[#146C43] text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
              <span>Filtrar questões</span>
              {(originFilter !== 'all' ||
                disciplineFilter !== 'all' ||
                topicFilter !== 'all' ||
                difficultyFilter !== 'all' ||
                onlyFavorites) && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#0B3321] text-white text-[10px] font-mono">
                  {[
                    originFilter !== 'all',
                    disciplineFilter !== 'all',
                    topicFilter !== 'all',
                    difficultyFilter !== 'all',
                    onlyFavorites,
                  ].filter(Boolean).length}
                </span>
              )}
              {bankFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {formatDuration(secondsElapsed)}
            </span>
            <span>
              {answeredCount}/{activeDeck.length}
            </span>
            <button
              type="button"
              onClick={() => startSession(disciplineFilter, originFilter, mode, difficultyFilter, onlyFavorites, topicFilter)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-sans font-medium inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {bankFiltersOpen && (
          <div
            id="simulados-bank-filters-panel"
            className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => {
                  setOriginFilter('all');
                  startSession(disciplineFilter, 'all', mode, difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  originFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Todas ({campusQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setOriginFilter('official');
                  startSession(disciplineFilter, 'official', mode, difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  originFilter === 'official'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Oficiais ({officialCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setOriginFilter('training');
                  startSession(disciplineFilter, 'training', mode, difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  originFilter === 'training'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Treino ({trainingCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setOriginFilter('ai');
                  startSession(disciplineFilter, 'ai', mode, difficultyFilter, onlyFavorites, topicFilter);
                }}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  originFilter === 'ai'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Inéditas IA ({aiCount})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Filtrar questões por disciplina"
                value={disciplineFilter}
                onChange={(e) => {
                  const nextDisc = e.target.value;
                  setDisciplineFilter(nextDisc);
                  setTopicFilter('all');
                  startSession(nextDisc, originFilter, mode, difficultyFilter, onlyFavorites, 'all');
                }}
                className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="all">Todas as disciplinas ({campusQuestions.length})</option>
                {activeDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.priorityRank}º · {d.shortName} ({d.examQuestions}q na prova)
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar questões por assunto"
                value={topicFilter}
                onChange={(e) => {
                  const nextTopic = e.target.value;
                  setTopicFilter(nextTopic);
                  startSession(disciplineFilter, originFilter, mode, difficultyFilter, onlyFavorites, nextTopic);
                }}
                className="min-h-[40px] max-w-full sm:max-w-xs px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="all">Todos os assuntos</option>
                {availableBankTopics.map((t) => (
                  <option key={`${t.disciplineId}-${t.title}`} value={t.title}>
                    {t.disciplineShortName} · {t.title}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar questões por dificuldade"
                value={difficultyFilter}
                onChange={(e) => {
                  const nextDiff = e.target.value as DifficultyFilter;
                  setDifficultyFilter(nextDiff);
                  startSession(disciplineFilter, originFilter, mode, nextDiff, onlyFavorites, topicFilter);
                }}
                className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="all">Qualquer dificuldade</option>
                <option value="basico">Nível Básico</option>
                <option value="intermediario">Nível Intermediário</option>
                <option value="avancado">Nível Avançado</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  const nextFav = !onlyFavorites;
                  setOnlyFavorites(nextFav);
                  startSession(disciplineFilter, originFilter, mode, difficultyFilter, nextFav, topicFilter);
                }}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 whitespace-nowrap ${
                  onlyFavorites
                    ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
                <span>Favoritas ({campusQuestions.filter((q) => favoriteQuestionIds.includes(q.id)).length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {restoredDraftNotice && !submitted && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-2">
          <span>
            Sessão anterior restaurada automaticamente ({answeredCount}/{activeDeck.length} respondidas).
          </span>
          <button
            type="button"
            onClick={() => startSession(disciplineFilter, originFilter, mode, difficultyFilter, onlyFavorites)}
            className="px-2.5 py-1 rounded-lg bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800"
          >
            Começar nova sessão
          </button>
        </div>
      )}

      {saveFeedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
          {saveFeedback}
        </div>
      )}

      {/* Summary after finishing */}
      {submitted && activeDeck.length > 0 && (
        <div className="bg-[#0B3321] text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-300 font-medium">Desempenho no simulado</p>
            <h2 className="font-display text-2xl font-bold mt-1">
              {correctTotal} de {activeDeck.length} acertos · Nota{' '}
              <span className="font-mono tabular-nums">{((correctTotal / activeDeck.length) * 10).toFixed(1)}</span> / 10,0
            </h2>
          </div>
          <button
            type="button"
            onClick={() => startSession(disciplineFilter, originFilter, mode, difficultyFilter, onlyFavorites)}
            className="min-h-[44px] px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-xl whitespace-nowrap"
          >
            Novo simulado
          </button>
        </div>
      )}

      {/* Navigator Strip */}
      {activeDeck.length > 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {activeDeck.map((q, idx) => {
            const isCurr = idx === currentIndex;
            const isAns = answers[q.id] !== undefined;
            const isFlag = Boolean(flaggedIds[q.id]);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Ir para questão ${idx + 1}${isFlag ? ' (marcada para revisão)' : ''}`}
                className={`min-w-[36px] min-h-[36px] px-2 rounded-lg text-xs font-mono font-bold transition-colors shrink-0 border ${
                  isCurr
                    ? 'bg-[#0B3321] text-white border-[#0B3321]'
                    : isFlag
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-400'
                      : isAns
                        ? 'bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Question Card */}
      {currentQuestion ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Questão {currentIndex + 1} de {activeDeck.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>{getDisciplineShortName(currentQuestion.disciplineId)}</span>
              <span aria-hidden="true">·</span>
              <span>{currentQuestion.topicTitle}</span>
              <span aria-hidden="true">·</span>
              <span>
                {currentQuestion.difficulty === 'basico'
                  ? 'Básico'
                  : currentQuestion.difficulty === 'avancado'
                    ? 'Avançado'
                    : 'Intermediário'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-medium">
              <button
                type="button"
                onClick={() => void toggleFavoriteQuestion(currentQuestion.id)}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 ${
                  favoriteQuestionIds.includes(currentQuestion.id)
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-800 dark:text-amber-200 font-semibold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Bookmark
                  className={`w-3 h-3 ${favoriteQuestionIds.includes(currentQuestion.id) ? 'fill-current' : ''}`}
                />
                <span>{favoriteQuestionIds.includes(currentQuestion.id) ? 'Favorita' : 'Favoritar'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFlaggedIds((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))
                }
                className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 ${
                  flaggedIds[currentQuestion.id]
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>{flaggedIds[currentQuestion.id] ? 'Marcada' : 'Marcar'}</span>
              </button>

              {currentQuestion.originType === 'ai_generated' ? (
                <span className="text-amber-800 dark:text-amber-300 font-semibold">
                  Gerada por IA (Treino)
                </span>
              ) : currentQuestion.isOfficial ? (
                <span className="inline-flex items-center gap-1 text-[#146C43] dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{currentQuestion.source || 'Fonte Oficial'}</span>
                </span>
              ) : (
                <span className="text-amber-800 dark:text-amber-300">
                  {currentQuestion.source || 'Treinamento Complementar (Não oficial)'}
                </span>
              )}
            </div>
          </div>

          <p className="text-base sm:text-lg text-slate-900 dark:text-slate-100 leading-relaxed font-medium">
            {currentQuestion.statement}
          </p>

          <div className="space-y-2.5">
            {currentQuestion.options.map((optText, idx) => {
              const isSelected = selectedAnswer === idx;
              const showCorrection = submitted || (mode === 'treino' && selectedAnswer !== undefined);
              const isCorrectOption = idx === currentQuestion.correctIndex;

              let btnStyle =
                'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100';
              if (showCorrection) {
                if (isCorrectOption) {
                  btnStyle = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle = 'border-red-500 bg-red-50 dark:bg-red-950/60 text-red-950 dark:text-red-100';
                }
              } else if (isSelected) {
                btnStyle = 'border-[#0B3321] bg-slate-900 dark:bg-[#0B3321] text-white';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full text-left min-h-[50px] p-4 rounded-xl border transition-colors flex items-start gap-3 ${btnStyle}`}
                >
                  <span className="font-mono text-xs font-bold mt-0.5 shrink-0">{LETTERS[idx]})</span>
                  <span className="text-sm leading-relaxed flex-1">{optText}</span>
                  {showCorrection && isCorrectOption && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {showCorrection && isSelected && !isCorrectOption && (
                    <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {(submitted || (mode === 'treino' && selectedAnswer !== undefined)) && (
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Gabarito Comentado · Alternativa {LETTERS[currentQuestion.correctIndex]}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {addedErrors[currentQuestion.id] && (
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      Adicionada ao Caderno de Erros
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={openingSourceId === currentQuestion.id}
                    onClick={() => void handleOpenSourceMaterial(currentQuestion)}
                    className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-[#146C43] text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    {openingSourceId === currentQuestion.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                    )}
                    <span>
                      {currentQuestion.sourcePage
                        ? `Abrir material (pág. ${currentQuestion.sourcePage})`
                        : 'Abrir material na pág./trecho'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={aiExplainingId === currentQuestion.id}
                    onClick={() => void handleExplainCurrentWithAi(currentQuestion)}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#E8F3EC] dark:bg-emerald-950/60 hover:bg-emerald-100 text-[#0B3321] dark:text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    {aiExplainingId === currentQuestion.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Explicar com Professor IA</span>
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{currentQuestion.explanation}</p>
              {currentQuestion.legalBasis && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                  Fundamentação: {currentQuestion.legalBasis}
                </p>
              )}
              {aiExplanations[currentQuestion.id] && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                  {aiExplanations[currentQuestion.id]}
                </div>
              )}
            </div>
          )}

          {/* Pagination & Finish */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={currentIndex >= activeDeck.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(activeDeck.length - 1, i + 1))}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Próxima
              </button>
            </div>

            {!submitted && (
              <button
                type="button"
                onClick={handleFinishSimulado}
                className="min-h-[44px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl"
              >
                Encerrar e salvar desempenho
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-300">
          Nenhuma questão encontrada para os filtros selecionados.
        </div>
      )}

      {/* Modal Cadastrar Nova Questão (apenas perfis autorizados) */}
      {canCreateQuestion && showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-display text-xl font-bold text-slate-900">Cadastrar Questão (Padrão CETAP)</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Fechar modal"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Disciplina</label>
                  <select
                    value={qDisc}
                    onChange={(e) => setQDisc(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  >
                    {activeDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Origem da questão</label>
                  <select
                    value={qOriginType}
                    onChange={(e) => setQOriginType(e.target.value as QuestionOriginType)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl"
                  >
                    <option value="official_cetap">Oficial · Prova Anterior Fundação CETAP</option>
                    <option value="official_camara">Oficial · Questão Legislativa (Câmara)</option>
                    <option value="official_alepa">Oficial · Legislação (Banco de Leis ALEPA)</option>
                    <option value="training_platform">Não oficial · Treinamento complementar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tópico do Edital</label>
                  <input
                    required
                    value={qTopic}
                    onChange={(e) => setQTopic(e.target.value)}
                    placeholder="Ex.: Regimento Interno ALEPA"
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Dificuldade</label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as QuestionDifficulty)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl"
                  >
                    <option value="basico">Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Enunciado da questão</label>
                <textarea
                  required
                  rows={3}
                  value={qStatement}
                  onChange={(e) => setQStatement(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-700">Alternativas (marque a correta)</span>
                {LETTERS.map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctIdx"
                      checked={qCorrect === i}
                      onChange={() => setQCorrect(i)}
                      aria-label={`Alternativa ${letter} correta`}
                    />
                    <span className="font-mono text-xs font-bold w-5">{letter})</span>
                    <input
                      required
                      value={qOptions[i]}
                      onChange={(e) => {
                        const copy = [...qOptions] as [string, string, string, string, string];
                        copy[i] = e.target.value;
                        setQOptions(copy);
                      }}
                      placeholder={`Texto da alternativa ${letter}`}
                      className="flex-1 min-h-[40px] px-3 py-1.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gabarito comentado</label>
                <textarea
                  required
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Base legal (opcional)</label>
                <input
                  value={qLegalBasis}
                  onChange={(e) => setQLegalBasis(e.target.value)}
                  placeholder="Ex.: CF/88, art. 66"
                  className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              {canPublishShared && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={qPublishClass}
                    onChange={(e) => setQPublishClass(e.target.checked)}
                  />
                  <span>Publicar para todos os estudantes da plataforma</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B3321] text-white text-sm font-semibold"
                >
                  Salvar questão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {readerTarget && (
        <BookReaderModal
          material={readerTarget.material}
          initialPage={readerTarget.page}
          initialSearchQuery={readerTarget.query}
          onClose={() => setReaderTarget(null)}
        />
      )}
    </div>
  );
}
