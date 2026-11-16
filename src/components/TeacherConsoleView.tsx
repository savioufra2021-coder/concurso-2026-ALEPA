import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/apiClient';
import {
  Activity,
  ActivitySubmission,
  CampusLevel,
  Classroom,
  Lesson,
  MaterialFileType,
  PublicationStatus,
  Question,
  QuestionDifficulty,
  StudyMaterial,
} from '../types';
import { ContentOrganizerModal } from './ContentOrganizerModal';
import { RequestsCenterView } from './RequestsCenterView';
import { EmptyState, PageHeader, SectionCard, StatTile } from './ui/CampusPrimitives';

type TeacherTab = 'dashboard' | 'classes' | 'lessons' | 'activities' | 'requests' | 'ai';

export function TeacherConsoleView({
  campus,
  onOpenStudentPreview,
}: {
  campus: CampusLevel;
  onOpenStudentPreview?: () => void;
}) {
  const {
    user,
    profile,
    isAdmin,
    allManagedClasses,
    classes,
    enrollments,
    allManagedLessons,
    allManagedActivities,
    submissions,
    allManagedMaterials,
    allManagedQuestions,
    errorNotebook,
    getCampusDisciplines,
    enrollStudentInClass,
    updateEnrollmentStatus,
    removeEnrollment,
    saveLesson,
    updateLessonStatus,
    deleteLesson,
    saveActivity,
    updateActivityStatus,
    deleteActivity,
    gradeSubmission,
    addMaterial,
    addCustomQuestion,
  } = useAuth();

  const [tab, setTab] = useState<TeacherTab>('dashboard');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const myUid = user?.uid || '';

  const allDisciplines = useMemo(
    () => [
      ...getCampusDisciplines('superior').map((d) => ({ ...d, campusTag: 'superior' as const })),
      ...getCampusDisciplines('medio').map((d) => ({ ...d, campusTag: 'medio' as const })),
    ],
    [getCampusDisciplines]
  );

  const disciplineNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    allDisciplines.forEach((d) => {
      m[d.id] = `${d.shortName} (${d.campusTag === 'medio' ? 'Médio' : 'Superior'})`;
    });
    return m;
  }, [allDisciplines]);

  // Turmas vinculadas ao professor (Admins em visão docente também enxergam turmas gerenciadas)
  const myClasses: Classroom[] = useMemo(() => {
    const pool = allManagedClasses.length > 0 ? allManagedClasses : classes;
    if (isAdmin) return pool;
    const assigned = new Set(profile?.assignedClassIds || []);
    return pool.filter((c) => c.teacherIds.includes(myUid) || assigned.has(c.id));
  }, [allManagedClasses, classes, isAdmin, profile?.assignedClassIds, myUid]);

  const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);

  const myEnrollments = useMemo(
    () => enrollments.filter((e) => myClassIds.has(e.classId) || e.teacherId === myUid),
    [enrollments, myClassIds, myUid]
  );

  const myLessons = useMemo(
    () =>
      allManagedLessons
        .filter((l) => l.authorId === myUid || myClassIds.has(l.classId) || isAdmin)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [allManagedLessons, myUid, myClassIds, isAdmin]
  );

  const myActivities = useMemo(
    () =>
      allManagedActivities.filter((a) => a.authorId === myUid || myClassIds.has(a.classId) || isAdmin),
    [allManagedActivities, myUid, myClassIds, isAdmin]
  );

  const myActivityIds = useMemo(() => new Set(myActivities.map((a) => a.id)), [myActivities]);

  const mySubmissions = useMemo(
    () =>
      submissions.filter(
        (s) => s.teacherId === myUid || myClassIds.has(s.classId) || myActivityIds.has(s.activityId) || isAdmin
      ),
    [submissions, myUid, myClassIds, myActivityIds, isAdmin]
  );

  const pendingSubmissions = useMemo(
    () => mySubmissions.filter((s) => s.status === 'submitted'),
    [mySubmissions]
  );

  const myManagedMaterials = useMemo(() => {
    const assignedDiscs = new Set(profile?.assignedDisciplineIds || []);
    return allManagedMaterials.filter((m) => {
      if (isAdmin) return true;
      if (m.ownerId === myUid) return true;
      if (m.classId && myClassIds.has(m.classId)) return true;
      if (assignedDiscs.size > 0 && assignedDiscs.has(m.disciplineId)) return true;
      return false;
    });
  }, [allManagedMaterials, isAdmin, myUid, myClassIds, profile?.assignedDisciplineIds]);

  // --- Form states: Enrollment ---
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const activeClassId = selectedClassId || myClasses[0]?.id || '';
  const [enrollStudentUid, setEnrollStudentUid] = useState('');
  const [enrollStudentName, setEnrollStudentName] = useState('');
  const [enrollStudentEmail, setEnrollStudentEmail] = useState('');

  // --- Form states: Lesson ---
  const [editingLessonId, setEditingLessonId] = useState<string | undefined>(undefined);
  const [lessonClassId, setLessonClassId] = useState<string>('');
  const [lessonDisciplineId, setLessonDisciplineId] = useState<string>(allDisciplines[0]?.id || 'd3_legislacao_especifica');
  const [lessonLevel, setLessonLevel] = useState<CampusLevel>(campus);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSummary, setLessonSummary] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonOrder, setLessonOrder] = useState<number>(1);
  const [lessonMaterialIds, setLessonMaterialIds] = useState<string[]>([]);
  const [lessonStatus, setLessonStatus] = useState<PublicationStatus>('published');

  // --- Form states: Quick Material Authoring (draft / in_review) ---
  const [matTitle, setMatTitle] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [matDisciplineId, setMatDisciplineId] = useState(allDisciplines[0]?.id || 'd3_legislacao_especifica');
  const [matFileType, setMatFileType] = useState<MaterialFileType>('pdf');
  const [matSubmitReview, setMatSubmitReview] = useState(true);

  // --- Form states: Question Authoring ---
  const [qDisciplineId, setQDisciplineId] = useState(allDisciplines[0]?.id || 'd3_legislacao_especifica');
  const [qTopicTitle, setQTopicTitle] = useState('');
  const [qStatement, setQStatement] = useState('');
  const [qOptions, setQOptions] = useState<[string, string, string, string, string]>(['', '', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qDifficulty, setQDifficulty] = useState<QuestionDifficulty>('intermediario');

  // --- Form states: Activity Authoring ---
  const [editingActivityId, setEditingActivityId] = useState<string | undefined>(undefined);
  const [actClassId, setActClassId] = useState('');
  const [actDisciplineId, setActDisciplineId] = useState(allDisciplines[0]?.id || 'd3_legislacao_especifica');
  const [actLevel, setActLevel] = useState<CampusLevel>(campus);
  const [actTitle, setActTitle] = useState('');
  const [actInstructions, setActInstructions] = useState('');
  const [actType, setActType] = useState<'objetiva' | 'discursiva' | 'mista'>('mista');
  const [actDueDate, setActDueDate] = useState('');
  const [actMaxScore, setActMaxScore] = useState<number>(10);
  const [actQuestionIds, setActQuestionIds] = useState<string[]>([]);
  const [actPromptsText, setActPromptsText] = useState('');
  const [actStatus, setActStatus] = useState<PublicationStatus>('published');

  // --- Form states: Grading ---
  const [gradingSubmission, setGradingSubmission] = useState<ActivitySubmission | null>(null);
  const [gradeManualScore, setGradeManualScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeStatus, setGradeStatus] = useState<'graded' | 'returned'>('graded');

  // --- Form states: Teacher AI ---
  const [aiAction, setAiAction] = useState<'draft_lesson' | 'draft_activity_questions' | 'analyze_class_errors'>(
    'draft_lesson'
  );
  const [aiTopic, setAiTopic] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLessonDraft, setAiLessonDraft] = useState<{ title?: string; summary?: string; content?: string } | null>(null);
  const [aiDiscursiveDraft, setAiDiscursiveDraft] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [organizingMaterial, setOrganizingMaterial] = useState<StudyMaterial | null>(null);

  const resetFeedback = () => {
    setFeedback(null);
    setErrorMsg(null);
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId || !enrollStudentUid.trim()) return;
    resetFeedback();
    setBusy(true);
    try {
      await enrollStudentInClass({
        classId: activeClassId,
        studentId: enrollStudentUid.trim(),
        studentName: enrollStudentName.trim() || 'Estudante Matriculado',
        studentEmail: enrollStudentEmail.trim(),
        teacherId: myUid,
      });
      setEnrollStudentUid('');
      setEnrollStudentName('');
      setEnrollStudentEmail('');
      setFeedback('Estudante matriculado na turma com sucesso.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao matricular estudante.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = lessonClassId || activeClassId;
    if (!targetClass || !lessonTitle.trim()) {
      setErrorMsg('Selecione uma turma e informe o título da aula.');
      return;
    }
    resetFeedback();
    setBusy(true);
    try {
      await saveLesson({
        lessonId: editingLessonId,
        classId: targetClass,
        disciplineId: lessonDisciplineId,
        campusLevel: lessonLevel,
        title: lessonTitle.trim(),
        summary: lessonSummary.trim(),
        content: lessonContent.trim(),
        videoUrl: lessonVideoUrl.trim() || undefined,
        materialIds: lessonMaterialIds,
        order: Math.max(1, Number(lessonOrder) || 1),
        status: lessonStatus,
      });
      setEditingLessonId(undefined);
      setLessonTitle('');
      setLessonSummary('');
      setLessonContent('');
      setLessonVideoUrl('');
      setLessonMaterialIds([]);
      setFeedback('Aula salva com sucesso.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar aula.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditLesson = (l: Lesson) => {
    setEditingLessonId(l.id);
    setLessonClassId(l.classId);
    setLessonDisciplineId(l.disciplineId);
    setLessonLevel(l.campusLevel);
    setLessonTitle(l.title);
    setLessonSummary(l.summary);
    setLessonContent(l.content);
    setLessonVideoUrl(l.videoUrl || '');
    setLessonOrder(l.order || 1);
    setLessonMaterialIds(l.materialIds || []);
    setLessonStatus(l.status);
    setTab('lessons');
  };

  const handleSaveTeacherMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim() || !matUrl.trim()) return;
    resetFeedback();
    setBusy(true);
    try {
      await addMaterial({
        title: matTitle.trim(),
        disciplineId: matDisciplineId,
        fileType: matFileType,
        url: matUrl.trim(),
        campusLevel: campus,
        classId: activeClassId || undefined,
        isShared: false,
        status: matSubmitReview ? 'in_review' : 'draft',
      });
      setMatTitle('');
      setMatUrl('');
      setFeedback(
        matSubmitReview
          ? 'Material enviado para revisão editorial (status: Em revisão).'
          : 'Material salvo como rascunho docente.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao cadastrar material.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTeacherQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qStatement.trim() || qOptions.some((o) => !o.trim())) {
      setErrorMsg('Preencha o enunciado e todas as 5 alternativas (A–E).');
      return;
    }
    resetFeedback();
    setBusy(true);
    try {
      await addCustomQuestion({
        disciplineId: qDisciplineId,
        topicTitle: qTopicTitle.trim() || 'Tópico da turma',
        statement: qStatement.trim(),
        options: qOptions.map((o) => o.trim()) as [string, string, string, string, string],
        correctIndex: qCorrectIndex,
        explanation: qExplanation.trim() || 'Questão elaborada pelo docente.',
        originType: 'training_platform',
        source: 'Elaboração Docente · Turma ALEPA 2026',
        difficulty: qDifficulty,
        questionFormat: 'objetiva',
        classId: activeClassId || undefined,
        escolaridade: campus,
        isOfficial: false,
        isPublished: false,
        status: 'in_review',
      });
      setQTopicTitle('');
      setQStatement('');
      setQOptions(['', '', '', '', '']);
      setQExplanation('');
      setFeedback('Questão registrada no banco docente e enviada para revisão editorial.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar questão.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = actClassId || activeClassId;
    if (!targetClass || !actTitle.trim()) {
      setErrorMsg('Selecione uma turma e informe o título da atividade.');
      return;
    }
    resetFeedback();
    setBusy(true);
    try {
      const prompts = actPromptsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await saveActivity({
        activityId: editingActivityId,
        classId: targetClass,
        disciplineId: actDisciplineId,
        campusLevel: actLevel,
        title: actTitle.trim(),
        instructions: actInstructions.trim(),
        activityType: actType,
        dueDate: actDueDate || undefined,
        maxScore: Math.max(1, Math.min(100, Number(actMaxScore) || 10)),
        questionIds: actQuestionIds,
        prompts,
        status: actStatus,
      });
      setEditingActivityId(undefined);
      setActTitle('');
      setActInstructions('');
      setActQuestionIds([]);
      setActPromptsText('');
      setFeedback('Atividade salva e vinculada à turma.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar atividade.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenGrading = (sub: ActivitySubmission) => {
    setGradingSubmission(sub);
    setGradeManualScore(sub.manualScore ?? 0);
    setGradeFeedback(sub.feedback || '');
    setGradeStatus(sub.status === 'returned' ? 'returned' : 'graded');
  };

  const handleSubmitGrading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;
    resetFeedback();
    setBusy(true);
    try {
      const finalScore = Number((gradingSubmission.objectiveScore + (Number(gradeManualScore) || 0)).toFixed(2));
      await gradeSubmission(gradingSubmission.id, {
        manualScore: Number(gradeManualScore) || 0,
        finalScore,
        feedback: gradeFeedback.trim(),
        status: gradeStatus,
      });
      setGradingSubmission(null);
      setFeedback('Correção registrada com histórico de revisão.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registrar correção.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunTeacherAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) {
      setErrorMsg('Informe a disciplina ou tema para o Assistente Docente.');
      return;
    }
    resetFeedback();
    setAiLoading(true);
    setAiLessonDraft(null);
    setAiDiscursiveDraft(null);
    try {
      const res = await apiFetch('/api/ai/teacher-assistant', {
        method: 'POST',
        body: JSON.stringify({
          action: aiAction,
          campusLevel: campus,
          disciplineName: aiTopic.trim(),
          topicTitle: aiTopic.trim(),
          contextText:
            aiAction === 'analyze_class_errors'
              ? `${aiNotes.trim()} | Erros registrados na base: ${errorNotebook
                  .slice(0, 8)
                  .map((er) => `${er.topicTitle} (${er.errorReason})`)
                  .join('; ')}`
              : aiNotes.trim(),
        }),
      });
      const data = (await res.json()) as {
        text?: string;
        draft?: { title?: string; summary?: string; content?: string };
        questions?: Array<{
          statement?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
          legalBasis?: string;
        }>;
        discursivePrompt?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Falha no Assistente Docente IA.');
      }
      if (data.draft) {
        setAiLessonDraft(data.draft);
        const formatted = [
          data.draft.title ? `# ${data.draft.title}` : '',
          data.draft.summary ? `Resumo: ${data.draft.summary}` : '',
          data.draft.content || '',
        ]
          .filter(Boolean)
          .join('\n\n');
        setAiResult(formatted || data.text || '');
      } else if (Array.isArray(data.questions) && data.questions.length > 0) {
        if (typeof data.discursivePrompt === 'string' && data.discursivePrompt.trim()) {
          setAiDiscursiveDraft(data.discursivePrompt.trim());
        }
        const letters = ['A', 'B', 'C', 'D', 'E'];
        const formattedQuestions = data.questions
          .map((q, idx) => {
            const opts = (q.options || [])
              .map((o, oi) => `  ${letters[oi] || oi + 1}) ${o}`)
              .join('\n');
            const corr = typeof q.correctIndex === 'number' ? letters[q.correctIndex] || 'A' : '?';
            return `Questão ${idx + 1}: ${q.statement || ''}\n${opts}\nGabarito: ${corr}${
              q.explanation ? `\nComentário: ${q.explanation}` : ''
            }${q.legalBasis ? `\nBase legal: ${q.legalBasis}` : ''}`;
          })
          .join('\n\n---\n\n');
        const fullText = data.discursivePrompt
          ? `${formattedQuestions}\n\nProposta Discursiva:\n${data.discursivePrompt}`
          : formattedQuestions;
        setAiResult(fullText || data.text || '');
      } else {
        setAiResult(data.text || '');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao consultar Assistente IA.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ambiente do Professor · Docência & Correção"
        title="Console do Professor"
        subtitle="Gerencie suas turmas, publique aulas e roteiros, crie atividades objetivas/discursivas e acompanhe envios com histórico de correção."
        actions={
          onOpenStudentPreview && (
            <button
              type="button"
              onClick={onOpenStudentPreview}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#146C43]"
            >
              Ver Área do Estudante
            </button>
          )
        }
      />

      {feedback && (
        <div className="bg-[#E8F3EC] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Teacher Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        {(
          [
            { id: 'dashboard', label: 'Painel Docente', icon: GraduationCap },
            { id: 'classes', label: `Turmas & Alunos (${myClasses.length})`, icon: Users },
            { id: 'lessons', label: `Aulas & Materiais (${myLessons.length})`, icon: BookOpen },
            { id: 'activities', label: `Atividades & Correções (${pendingSubmissions.length})`, icon: ClipboardCheck },
            { id: 'requests', label: 'Solicitações', icon: MessageSquare },
            { id: 'ai', label: 'Assistente IA Docente', icon: Sparkles },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-[#0B3321] text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Turmas vinculadas" value={myClasses.length} accent="brand" hint="Turmas sob sua docência" />
            <StatTile
              label="Estudantes matriculados"
              value={myEnrollments.filter((e) => e.status === 'active').length}
              hint="Matrículas ativas"
            />
            <StatTile
              label="Aulas cadastradas"
              value={myLessons.length}
              accent="success"
              hint={`${myLessons.filter((l) => l.status === 'published').length} publicadas`}
            />
            <StatTile
              label="Aguardando correção"
              value={pendingSubmissions.length}
              accent={pendingSubmissions.length > 0 ? 'warning' : 'default'}
              hint={`${mySubmissions.length} envios totais`}
            />
          </div>

          <SectionCard
            title="Resumo Rápido de Turmas & Pendências"
            subtitle="Visão direta das entregas pendentes e aulas em andamento"
          >
            {myClasses.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhuma turma atribuída ainda"
                description="Peça ao Administrador Principal para criar uma turma e vincular seu usuário docente, ou aguarde a designação da sua disciplina."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myClasses.map((cls) => {
                  const classCount = myEnrollments.filter((e) => e.classId === cls.id && e.status === 'active').length;
                  const clsLessons = myLessons.filter((l) => l.classId === cls.id).length;
                  const clsPending = pendingSubmissions.filter((s) => s.classId === cls.id).length;
                  return (
                    <div
                      key={cls.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <p className="text-[11px] font-mono text-[#146C43] dark:text-emerald-400 font-semibold">
                          {cls.code} · {cls.campusLevel === 'medio' ? 'Nível Médio' : 'Nível Superior'}
                        </p>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                          {cls.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono tabular-nums">
                          {classCount} alunos · {clsLessons} aulas · {clsPending} correções pendentes
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setLessonClassId(cls.id);
                            setTab('lessons');
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B3321] text-white text-xs font-semibold"
                        >
                          Gerenciar aulas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setActClassId(cls.id);
                            setTab('activities');
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        >
                          Atividades ({clsPending})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 2: CLASSES & ENROLLMENTS */}
      {tab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Matricular Estudante em Turma"
            subtitle="Vincule um estudante usando o UID da conta ou gerencie matrículas ativas"
          >
            {myClasses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhuma turma vinculada ao seu perfil docente.
              </p>
            ) : (
              <form onSubmit={handleEnrollStudent} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Turma de destino
                  </label>
                  <select
                    value={activeClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {myClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    UID do Estudante (Firebase Auth)
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollStudentUid}
                    onChange={(e) => setEnrollStudentUid(e.target.value)}
                    placeholder="Ex: aB1cD2eF3..."
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={enrollStudentName}
                    onChange={(e) => setEnrollStudentName(e.target.value)}
                    placeholder="Nome do estudante"
                    className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="email"
                    value={enrollStudentEmail}
                    onChange={(e) => setEnrollStudentEmail(e.target.value)}
                    placeholder="E-mail (opcional)"
                    className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Matricular estudante</span>
                </button>
              </form>
            )}
          </SectionCard>

          <SectionCard
            title="Lista de Matrículas"
            subtitle="Estudantes inscritos nas suas turmas"
          >
            {myEnrollments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum estudante matriculado até o momento.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {myEnrollments.map((enr) => {
                  const cls = myClasses.find((c) => c.id === enr.classId);
                  return (
                    <div
                      key={enr.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {enr.studentName || enr.studentId}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                          {cls?.code || enr.classId} · {enr.studentEmail || enr.studentId} ·{' '}
                          {enr.status === 'active' ? 'Ativo' : 'Pausado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void updateEnrollmentStatus(enr.id, enr.status === 'active' ? 'inactive' : 'active')
                          }
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                        >
                          {enr.status === 'active' ? 'Pausar' : 'Reativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeEnrollment(enr.id)}
                          aria-label="Remover matrícula"
                          className="min-h-[34px] min-w-[34px] rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 3: LESSONS & MATERIALS */}
      {tab === 'lessons' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title={editingLessonId ? 'Editar Aula' : 'Nova Aula / Roteiro de Estudo'}
              subtitle="Organize aulas por turma e disciplina vinculando materiais da biblioteca"
            >
              <form onSubmit={handleSaveLesson} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Turma
                    </label>
                    <select
                      value={lessonClassId || activeClassId}
                      onChange={(e) => setLessonClassId(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Selecione a turma</option>
                      {myClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Disciplina
                    </label>
                    <select
                      value={lessonDisciplineId}
                      onChange={(e) => setLessonDisciplineId(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    >
                      {allDisciplines.map((d) => (
                        <option key={`${d.campusTag}_${d.id}`} value={d.id}>
                          {d.shortName} ({d.campusTag === 'medio' ? 'Médio' : 'Superior'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Título da aula
                    </label>
                    <input
                      type="text"
                      required
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="Ex: Regimento Interno ALEPA — Arts. 1º a 35"
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ordem
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={lessonOrder}
                      onChange={(e) => setLessonOrder(Number(e.target.value) || 1)}
                      className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={lessonSummary}
                  onChange={(e) => setLessonSummary(e.target.value)}
                  placeholder="Resumo curto dos objetivos de aprendizagem"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <textarea
                  rows={5}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Conteúdo estruturado da aula, pontos-chave de edital, jurisprudência ou orientações de estudo..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="url"
                    value={lessonVideoUrl}
                    onChange={(e) => setLessonVideoUrl(e.target.value)}
                    placeholder="URL da videoaula (opcional)"
                    className="sm:col-span-2 min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={lessonStatus}
                    onChange={(e) => setLessonStatus(e.target.value as PublicationStatus)}
                    className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="published">Publicada na turma</option>
                    <option value="draft">Rascunho</option>
                    <option value="in_review">Enviar para revisão</option>
                  </select>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Vincular PDFs / Materiais da biblioteca ({lessonMaterialIds.length} selecionados)
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                    {(myManagedMaterials.length > 0 ? myManagedMaterials : allManagedMaterials)
                      .slice(0, 40)
                      .map((m) => {
                      const checked = lessonMaterialIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setLessonMaterialIds((prev) =>
                                checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              )
                            }
                          />
                          <span className="truncate">{m.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    {editingLessonId ? 'Atualizar aula' : 'Salvar aula'}
                  </button>
                  {editingLessonId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLessonId(undefined);
                        setLessonTitle('');
                        setLessonSummary('');
                        setLessonContent('');
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard
                title="Sugerir Material de Apoio para Revisão"
                subtitle="Materiais enviados por professores passam por aprovação editorial antes do acervo institucional"
              >
                <form onSubmit={handleSaveTeacherMaterial} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    placeholder="Título do material / apostila"
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="url"
                    required
                    value={matUrl}
                    onChange={(e) => setMatUrl(e.target.value)}
                    placeholder="https://... (PDF, Drive, Artigo ou Vídeo)"
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <select
                      value={matDisciplineId}
                      onChange={(e) => setMatDisciplineId(e.target.value)}
                      className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    >
                      {allDisciplines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.shortName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={matFileType}
                      onChange={(e) => setMatFileType(e.target.value as MaterialFileType)}
                      className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    >
                      <option value="pdf">PDF</option>
                      <option value="drive">Link / Legislação / Drive</option>
                      <option value="video">Vídeo</option>
                      <option value="pptx">Slides (PPTX)</option>
                      <option value="xlsx">Planilha / Cronograma (XLSX)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={matSubmitReview}
                      onChange={(e) => setMatSubmitReview(e.target.checked)}
                    />
                    <span>Enviar diretamente para revisão editorial (Editor / Admin)</span>
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{matSubmitReview ? 'Enviar para revisão' : 'Salvar rascunho'}</span>
                  </button>
                </form>
              </SectionCard>

              <SectionCard
                title={`Materiais Sob Sua Autoria / Disciplina (${myManagedMaterials.length})`}
                subtitle="Organize subtítulo, recomendações de estudo e capítulos antes de enviar para revisão"
              >
                {myManagedMaterials.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhum material cadastrado no seu escopo docente ainda.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {myManagedMaterials.slice(0, 20).map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {m.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {disciplineNameMap[m.disciplineId] || m.disciplineId} · {m.status || 'draft'}
                            {m.chapters?.length ? ` · ${m.chapters.length} cap.` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrganizingMaterial(m)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-[#0B3321] dark:text-emerald-300 inline-flex items-center gap-1 shrink-0"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Organizar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Aulas Criadas" subtitle={`${myLessons.length} aula(s) registradas`}>
                {myLessons.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma aula cadastrada ainda.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {myLessons.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Aula {l.order} · {disciplineNameMap[l.disciplineId] || l.disciplineId} · {l.status}
                          </p>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{l.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditLesson(l)}
                            aria-label="Editar aula"
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void updateLessonStatus(l.id, l.status === 'published' ? 'draft' : 'published')
                            }
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-800 dark:text-slate-200"
                          >
                            {l.status === 'published' ? 'Despublicar' : 'Publicar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteLesson(l.id)}
                            aria-label="Excluir aula"
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUESTIONS, ACTIVITIES & GRADING */}
      {tab === 'activities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Activity */}
            <SectionCard
              title={editingActivityId ? 'Editar Atividade' : 'Nova Atividade Avaliativa'}
              subtitle="Combine questões objetivas com correção automática e comandos discursivos"
            >
              <form onSubmit={handleSaveActivity} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={actClassId || activeClassId}
                    onChange={(e) => setActClassId(e.target.value)}
                    className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Turma...</option>
                    {myClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={actDisciplineId}
                    onChange={(e) => setActDisciplineId(e.target.value)}
                    className="min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {allDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.shortName}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  required
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="Título da atividade / simulado da turma"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <textarea
                  rows={2}
                  value={actInstructions}
                  onChange={(e) => setActInstructions(e.target.value)}
                  placeholder="Instruções gerais e critérios de avaliação..."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value as 'objetiva' | 'discursiva' | 'mista')}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="objetiva">Objetiva</option>
                    <option value="discursiva">Discursiva</option>
                    <option value="mista">Mista</option>
                  </select>
                  <input
                    type="date"
                    value={actDueDate}
                    onChange={(e) => setActDueDate(e.target.value)}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={actMaxScore}
                    onChange={(e) => setActMaxScore(Number(e.target.value) || 10)}
                    placeholder="Nota máx"
                    className="min-h-[40px] px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={actStatus}
                    onChange={(e) => setActStatus(e.target.value as PublicationStatus)}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="published">Publicada</option>
                    <option value="draft">Rascunho</option>
                  </select>
                </div>

                {actType !== 'discursiva' && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Questões objetivas vinculadas ({actQuestionIds.length} selecionadas)
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                      {allManagedQuestions
                        .filter((q) => !actDisciplineId || q.disciplineId === actDisciplineId)
                        .slice(0, 30)
                        .map((q) => {
                          const checked = actQuestionIds.includes(q.id);
                          return (
                            <label
                              key={q.id}
                              className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setActQuestionIds((prev) =>
                                    checked ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                                  )
                                }
                              />
                              <span className="line-clamp-1">{q.statement}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                {actType !== 'objetiva' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Enunciados discursivos (um por linha)
                    </label>
                    <textarea
                      rows={3}
                      value={actPromptsText}
                      onChange={(e) => setActPromptsText(e.target.value)}
                      placeholder="Ex: Explique a competência privativa da ALEPA segundo o art. 92 da Constituição Estadual."
                      className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {editingActivityId ? 'Atualizar atividade' : 'Publicar atividade'}
                </button>
              </form>
            </SectionCard>

            {/* Author Question */}
            <SectionCard
              title="Criar Questão Inédita (Banco Docente)"
              subtitle="Questões autorais são submetidas para revisão editorial antes do simulado oficial"
            >
              <form onSubmit={handleSaveTeacherQuestion} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={qDisciplineId}
                    onChange={(e) => setQDisciplineId(e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    {allDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.shortName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as QuestionDifficulty)}
                    className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="basico">Nível Básico</option>
                    <option value="intermediario">Nível Intermediário</option>
                    <option value="avancado">Nível Avançado</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={qTopicTitle}
                  onChange={(e) => setQTopicTitle(e.target.value)}
                  placeholder="Tópico do edital"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <textarea
                  rows={2}
                  required
                  value={qStatement}
                  onChange={(e) => setQStatement(e.target.value)}
                  placeholder="Enunciado da questão..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <div className="space-y-1.5">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((letter, idx) => (
                    <div key={letter} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="teacher-q-correct"
                        checked={qCorrectIndex === idx}
                        onChange={() => setQCorrectIndex(idx)}
                      />
                      <input
                        type="text"
                        required
                        value={qOptions[idx]}
                        onChange={(e) => {
                          const next = [...qOptions] as [string, string, string, string, string];
                          next[idx] = e.target.value;
                          setQOptions(next);
                        }}
                        placeholder={`Alternativa ${letter}`}
                        className="flex-1 min-h-[36px] px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  ))}
                </div>

                <input
                  type="text"
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Comentário / fundamentação legal do gabarito"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold"
                >
                  Enviar questão para revisão
                </button>
              </form>
            </SectionCard>
          </div>

          {/* Activities List & Student Submissions Grading */}
          <SectionCard
            title="Envios de Estudantes & Correção com Histórico"
            subtitle="Confira notas objetivas automáticas, atribua pontuação discursiva e registre devolutivas"
          >
            {mySubmissions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhuma entrega registrada nas suas atividades até o momento.
              </p>
            ) : (
              <div className="space-y-3">
                {mySubmissions.map((sub) => {
                  const act = myActivities.find((a) => a.id === sub.activityId);
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono text-[#146C43] dark:text-emerald-400 font-semibold">
                            {act?.title || sub.activityId} · {sub.status}
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {sub.studentName || sub.studentId}
                          </p>
                          <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            Obj: {sub.objectiveScore.toFixed(1)} · Manual: {(sub.manualScore ?? 0).toFixed(1)} · Final:{' '}
                            {(sub.finalScore ?? sub.objectiveScore).toFixed(1)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenGrading(sub)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold shrink-0"
                        >
                          Corrigir / Editar nota
                        </button>
                      </div>

                      {Object.entries(sub.discursiveResponses || {}).map(([key, resp]) => (
                        <div
                          key={key}
                          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
                        >
                          <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{key}</p>
                          <p className="whitespace-pre-wrap mt-0.5">{resp}</p>
                        </div>
                      ))}

                      {sub.revisionHistory && sub.revisionHistory.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Histórico: {sub.revisionHistory.length} revisão(ões) registrada(s)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {gradingSubmission && (
              <form
                onSubmit={handleSubmitGrading}
                className="mt-4 rounded-xl border border-[#146C43] bg-[#E8F3EC]/60 dark:bg-emerald-950/30 p-4 space-y-3"
              >
                <p className="text-xs font-bold text-[#0B3321] dark:text-emerald-200">
                  Corrigindo entrega de {gradingSubmission.studentName || gradingSubmission.studentId} (Objetiva:{' '}
                  {gradingSubmission.objectiveScore.toFixed(1)} pts)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nota discursiva / manual
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={gradeManualScore}
                      onChange={(e) => setGradeManualScore(Number(e.target.value) || 0)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Situação da correção
                    </label>
                    <select
                      value={gradeStatus}
                      onChange={(e) => setGradeStatus(e.target.value as 'graded' | 'returned')}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="graded">Corrigida / Nota Finalizada</option>
                      <option value="returned">Devolvida para ajustes do aluno</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Devolutiva pedagógica para o estudante..."
                  className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B3321] text-white text-xs font-semibold"
                  >
                    Salvar correção
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 5: SOLICITAÇÕES ACADÊMICAS */}
      {tab === 'requests' && <RequestsCenterView campus={campus} mode="teacher" />}

      {/* TAB 6: TEACHER AI ASSISTANT */}
      {tab === 'ai' && (
        <SectionCard
          title="Assistente Pedagógico IA do Professor"
          subtitle="Rascunhos gerados por IA são apresentados para revisão docente antes de qualquer publicação"
        >
          <form onSubmit={handleRunTeacherAi} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ação desejada
                </label>
                <select
                  value={aiAction}
                  onChange={(e) =>
                    setAiAction(
                      e.target.value as 'draft_lesson' | 'draft_activity_questions' | 'analyze_class_errors'
                    )
                  }
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  <option value="draft_lesson">Gerar roteiro estruturado de aula</option>
                  <option value="draft_activity_questions">Sugerir questões inéditas para atividade</option>
                  <option value="analyze_class_errors">Analisar erros recorrentes e plano de reforço</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disciplina e tópico
                </label>
                <input
                  type="text"
                  required
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="Ex: Regimento Interno ALEPA — Processo Legislativo"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <textarea
              rows={3}
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder="Foco da banca CETAP, dificuldades observadas na turma ou orientações adicionais..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            />

            <button
              type="submit"
              disabled={aiLoading}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{aiLoading ? 'Gerando rascunho...' : 'Gerar rascunho docente'}</span>
            </button>
          </form>

          {aiResult && (
            <div className="mt-5 space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#146C43] dark:text-emerald-400">
                  Rascunho gerado por IA — revise antes de salvar ou publicar
                </p>
                {aiAction === 'draft_lesson' && (
                  <button
                    type="button"
                    onClick={() => {
                      setLessonTitle(aiLessonDraft?.title?.trim() || aiTopic.trim());
                      setLessonSummary(aiLessonDraft?.summary?.trim() || '');
                      setLessonContent(aiLessonDraft?.content?.trim() || aiResult);
                      setLessonStatus('draft');
                      setTab('lessons');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0B3321] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar para editor de aula</span>
                  </button>
                )}
                {aiAction === 'draft_activity_questions' && aiDiscursiveDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      setActPromptsText((prev) =>
                        prev.trim() ? `${prev.trim()}\n${aiDiscursiveDraft}` : aiDiscursiveDraft
                      );
                      setActType('mista');
                      setTab('activities');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0B3321] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Usar discursiva na atividade</span>
                  </button>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiResult}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {organizingMaterial && (
        <ContentOrganizerModal
          material={organizingMaterial}
          campus={campus}
          onClose={() => setOrganizingMaterial(null)}
          onSaved={() => {
            setFeedback('Organização de conteúdo salva.');
          }}
        />
      )}
    </div>
  );
}
