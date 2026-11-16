import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  LogIn,
  Send,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isMaterialPendingDefinition } from '../data/libraryCatalogUtils';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { Activity, CampusLevel, Classroom, Lesson, Question, StudyMaterial } from '../types';
import { isSafeHttpUrl } from '../utils/mediaUrls';
import { BookReaderModal } from './BookReaderModal';
import { EmptyState, PageHeader, SectionCard } from './ui/CampusPrimitives';

export function StudentClassroomView({
  campus,
  onSummarizeWithGemini,
}: {
  campus: CampusLevel;
  onSummarizeWithGemini?: (target: {
    mode: 'pdf';
    materialId?: string;
    url?: string;
    title?: string;
    disciplineId?: string;
  }) => void;
}) {
  const {
    user,
    isGuest,
    profile,
    classes,
    enrollments,
    lessons,
    activities,
    submissions,
    materials,
    questions,
    getCampusDisciplines,
    enrollStudentInClass,
    removeEnrollment,
    submitActivity,
    exitGuestMode,
  } = useAuth();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classCodeInput, setClassCodeInput] = useState('');
  const [innerTab, setInnerTab] = useState<'lessons' | 'activities'>('lessons');
  const [readerMaterial, setReaderMaterial] = useState<StudyMaterial | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [objectiveAnswers, setObjectiveAnswers] = useState<Record<string, number>>({});
  const [discursiveResponses, setDiscursiveResponses] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disciplines = useMemo(() => {
    return [...getCampusDisciplines('superior'), ...getCampusDisciplines('medio')];
  }, [getCampusDisciplines]);

  const disciplineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    disciplines.forEach((d) => {
      map[d.id] = d.shortName;
    });
    return map;
  }, [disciplines]);

  const myUid = user?.uid || 'guest_local';
  const myActiveEnrollments = useMemo(
    () => enrollments.filter((e) => e.studentId === myUid && e.status === 'active'),
    [enrollments, myUid]
  );
  const enrolledClassIds = useMemo(() => new Set(myActiveEnrollments.map((e) => e.classId)), [myActiveEnrollments]);

  const campusClasses = useMemo(
    () => classes.filter((c) => c.active && (c.campusLevel === campus || enrolledClassIds.has(c.id))),
    [classes, campus, enrolledClassIds]
  );

  const activeClass: Classroom | null = useMemo(() => {
    if (selectedClassId) {
      const found = classes.find((c) => c.id === selectedClassId);
      if (found) return found;
    }
    const firstEnrolled = campusClasses.find((c) => enrolledClassIds.has(c.id));
    return firstEnrolled || campusClasses[0] || null;
  }, [selectedClassId, classes, campusClasses, enrolledClassIds]);

  const isEnrolledInActiveClass = Boolean(activeClass && enrolledClassIds.has(activeClass.id));

  const classLessons: Lesson[] = useMemo(() => {
    if (!activeClass) return [];
    return lessons
      .filter((l) => l.classId === activeClass.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [lessons, activeClass]);

  const classActivities: Activity[] = useMemo(() => {
    if (!activeClass) return [];
    return activities.filter((a) => a.classId === activeClass.id);
  }, [activities, activeClass]);

  const handleEnrollByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = classCodeInput.trim().toLowerCase();
    if (!code) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    const matched = classes.find((c) => c.code.trim().toLowerCase() === code && c.active);
    if (!matched) {
      setErrorMsg('Nenhuma turma ativa encontrada com esse código.');
      return;
    }
    if (isGuest && !user) {
      setErrorMsg('Faça login com sua conta Google/E-mail para ingressar em turmas sincronizadas.');
      return;
    }
    setBusyAction(true);
    try {
      await enrollStudentInClass({
        classId: matched.id,
        studentId: user?.uid,
        studentName: profile?.displayName || user?.displayName || 'Estudante',
        studentEmail: profile?.email || user?.email || '',
        teacherId: matched.teacherIds[0] || '',
      });
      setSelectedClassId(matched.id);
      setClassCodeInput('');
      setFeedbackMsg(`Matrícula confirmada na turma "${matched.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível concluir a matrícula.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleEnrollClass = async (classroom: Classroom) => {
    if (isGuest && !user) {
      setErrorMsg('Entre com sua conta Google/E-mail para se matricular em turmas e enviar atividades.');
      return;
    }
    setErrorMsg(null);
    setFeedbackMsg(null);
    setBusyAction(true);
    try {
      await enrollStudentInClass({
        classId: classroom.id,
        studentId: user?.uid,
        studentName: profile?.displayName || user?.displayName || 'Estudante',
        studentEmail: profile?.email || user?.email || '',
        teacherId: classroom.teacherIds[0] || '',
      });
      setSelectedClassId(classroom.id);
      setFeedbackMsg(`Você ingressou na turma "${classroom.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao ingressar na turma.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleLeaveClass = async (classId: string) => {
    const enr = myActiveEnrollments.find((e) => e.classId === classId);
    if (!enr) return;
    setBusyAction(true);
    setErrorMsg(null);
    try {
      await removeEnrollment(enr.id);
      setFeedbackMsg('Matrícula encerrada nesta turma.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao sair da turma.');
    } finally {
      setBusyAction(false);
    }
  };

  const openActivityForm = (activity: Activity) => {
    const existing = submissions.find((s) => s.activityId === activity.id && s.studentId === myUid);
    setActiveActivityId(activity.id);
    setObjectiveAnswers(existing?.objectiveAnswers || {});
    setDiscursiveResponses(existing?.discursiveResponses || {});
    setErrorMsg(null);
    setFeedbackMsg(null);
  };

  const handleSubmitActivity = async (activity: Activity) => {
    if (isGuest && !user) {
      setErrorMsg('Entre com sua conta para enviar respostas ao professor.');
      return;
    }
    setBusyAction(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const linkedQuestions = activity.questionIds
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is Question => Boolean(q));

      let objectiveScore = 0;
      if (linkedQuestions.length > 0) {
        const correct = linkedQuestions.reduce(
          (sum, q) => (objectiveAnswers[q.id] === q.correctIndex ? sum + 1 : sum),
          0
        );
        const objectiveWeight =
          activity.activityType === 'objetiva'
            ? activity.maxScore
            : activity.prompts.length > 0
              ? activity.maxScore * 0.5
              : activity.maxScore;
        objectiveScore = Number(((correct / linkedQuestions.length) * objectiveWeight).toFixed(2));
      }

      const existing = submissions.find((s) => s.activityId === activity.id && s.studentId === myUid);
      const classObj = classes.find((c) => c.id === activity.classId);

      await submitActivity({
        submissionId: existing?.id,
        activityId: activity.id,
        classId: activity.classId,
        teacherId: activity.authorId || classObj?.teacherIds[0] || '',
        objectiveAnswers,
        discursiveResponses,
        objectiveScore,
      });
      setActiveActivityId(null);
      setFeedbackMsg(
        linkedQuestions.length > 0
          ? `Atividade enviada! Pontuação objetiva automática: ${objectiveScore.toFixed(1)} pts.`
          : 'Atividade enviada ao professor para correção.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar atividade.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ambiente do Estudante · Turmas & Docentes"
        title="Minhas Turmas, Aulas & Atividades"
        subtitle="Acesse aulas organizadas por professores, leia os materiais PDF no Book Reader e acompanhe correções e notas das suas atividades."
      />

      {feedbackMsg && (
        <div className="bg-[#E8F3EC] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {isGuest && !user && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-200">
            Você está no modo visitante. Faça login para se matricular nas turmas, abrir aulas exclusivas e enviar
            atividades para correção docente.
          </p>
          <button
            type="button"
            onClick={exitGuestMode}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
        </div>
      )}

      {/* Código de Turma + Seleção */}
      <SectionCard
        title="Turmas Disponíveis & Matrículas"
        subtitle="Entre em uma turma por código ou selecione abaixo para acessar aulas e avaliações"
        rightSlot={
          <form onSubmit={handleEnrollByCode} className="flex items-center gap-2">
            <input
              type="text"
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value)}
              placeholder="Código da turma (ex: ALEPA-LEG)"
              className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#146C43]"
            />
            <button
              type="submit"
              disabled={busyAction || !classCodeInput.trim()}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
            >
              Ingressar
            </button>
          </form>
        }
      >
        {campusClasses.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhuma turma ativa publicada ainda"
            description="Quando a coordenação ou um professor publicar uma turma para este nível de ensino, ela aparecerá aqui para matrícula."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campusClasses.map((cls) => {
              const enrolled = enrolledClassIds.has(cls.id);
              const selected = activeClass?.id === cls.id;
              return (
                <div
                  key={cls.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    selected
                      ? 'border-[#146C43] bg-[#E8F3EC]/60 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className="text-left space-y-1 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-[#146C43] dark:text-emerald-400">{cls.code}</span>
                      <span>{cls.campusLevel === 'medio' ? 'Nível Médio' : 'Nível Superior'}</span>
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {cls.name}
                    </h3>
                    {cls.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{cls.description}</p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      {cls.disciplineIds.length} disciplina(s) · {enrolled ? 'Matriculado' : 'Aberta'}
                    </p>
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setSelectedClassId(cls.id)}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {selected ? 'Turma aberta' : 'Ver conteúdo'}
                    </button>

                    {enrolled ? (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => void handleLeaveClass(cls.id)}
                        className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400"
                      >
                        Sair da turma
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => void handleEnrollClass(cls)}
                        className="min-h-[36px] px-3 py-1 rounded-lg bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold"
                      >
                        Matricular
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Conteúdo da Turma Selecionada */}
      {activeClass && (
        <SectionCard
          title={activeClass.name}
          subtitle={`${activeClass.code} · ${
            isEnrolledInActiveClass
              ? 'Matrícula ativa — acesso completo a aulas e envios'
              : 'Visualize o cronograma da turma e clique em Matricular para enviar atividades'
          }`}
          rightSlot={
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setInnerTab('lessons')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  innerTab === 'lessons'
                    ? 'bg-white dark:bg-slate-900 text-[#0B3321] dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Aulas ({classLessons.length})
              </button>
              <button
                type="button"
                onClick={() => setInnerTab('activities')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  innerTab === 'activities'
                    ? 'bg-white dark:bg-slate-900 text-[#0B3321] dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Atividades ({classActivities.length})
              </button>
            </div>
          }
        >
          {innerTab === 'lessons' ? (
            classLessons.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhuma aula publicada nesta turma"
                description="O professor desta turma ainda está preparando as aulas e roteiros de estudo."
              />
            ) : (
              <div className="space-y-3">
                {classLessons.map((lesson, idx) => {
                  const isExpanded = expandedLessonId === lesson.id || idx === 0;
                  const attachedMaterials = lesson.materialIds
                    .map((id) => materials.find((m) => m.id === id))
                    .filter((m): m is StudyMaterial => Boolean(m));

                  return (
                    <article
                      key={lesson.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <span className="font-bold text-[#146C43] dark:text-emerald-400">
                              Aula {String(lesson.order || idx + 1).padStart(2, '0')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{disciplineNameMap[lesson.disciplineId] || lesson.disciplineId}</span>
                          </div>
                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                            {lesson.title}
                          </h3>
                          {lesson.summary && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{lesson.summary}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedLessonId(isExpanded && expandedLessonId === lesson.id ? null : lesson.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0 self-start sm:self-center"
                        >
                          {isExpanded ? 'Recolher roteiro' : 'Abrir aula'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                          {lesson.content && (
                            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
                              {lesson.content}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            {lesson.videoUrl && isSafeHttpUrl(lesson.videoUrl) && (
                              <a
                                href={lesson.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#146C43] text-xs font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5"
                              >
                                <Video className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                                <span>Assistir videoaula</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {attachedMaterials.map((mat) => {
                              if (isMaterialPendingDefinition(mat)) {
                                return (
                                  <span
                                    key={mat.id}
                                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5"
                                    title="Material com definição pendente no acervo"
                                  >
                                    <Clock className="w-4 h-4 shrink-0" />
                                    <span className="truncate max-w-[240px]">Pendente: {mat.title}</span>
                                  </span>
                                );
                              }
                              if (isInAppReadableMaterial(mat)) {
                                return (
                                  <button
                                    key={mat.id}
                                    type="button"
                                    onClick={() => setReaderMaterial(mat)}
                                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                  >
                                    <FileText className="w-4 h-4 text-emerald-300" />
                                    <span className="truncate max-w-[240px]">Ler: {mat.title}</span>
                                  </button>
                                );
                              }
                              if (isSafeHttpUrl(mat.url)) {
                                return (
                                  <a
                                    key={mat.id}
                                    href={mat.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#146C43] text-slate-900 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5"
                                  >
                                    <ExternalLink className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
                                    <span className="truncate max-w-[240px]">Abrir: {mat.title}</span>
                                  </a>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )
          ) : classActivities.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhuma atividade avaliativa publicada"
              description="Quando o professor publicar listas objetivas ou questões discursivas para esta turma, você poderá responder e acompanhar a correção aqui."
            />
          ) : (
            <div className="space-y-4">
              {classActivities.map((act) => {
                const sub = submissions.find((s) => s.activityId === act.id && s.studentId === myUid);
                const isOpen = activeActivityId === act.id;
                const linkedQuestions = act.questionIds
                  .map((id) => questions.find((q) => q.id === id))
                  .filter((q): q is Question => Boolean(q));

                return (
                  <div
                    key={act.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-[#146C43] dark:text-emerald-400">
                            {act.activityType === 'objetiva'
                              ? 'Objetiva'
                              : act.activityType === 'discursiva'
                                ? 'Discursiva'
                                : 'Mista'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Nota máx: {act.maxScore}</span>
                          {act.dueDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Entrega: {act.dueDate.split('-').reverse().join('/')}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {act.title}
                        </h3>
                        {act.instructions && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{act.instructions}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sub && (
                          <div className="text-right font-mono tabular-nums text-xs">
                            <p className="font-bold text-[#0B3321] dark:text-emerald-300">
                              {sub.status === 'graded'
                                ? `Nota final: ${(sub.finalScore ?? sub.objectiveScore).toFixed(1)}`
                                : sub.status === 'returned'
                                  ? 'Devolvida para revisão'
                                  : `Enviada · Obj: ${sub.objectiveScore.toFixed(1)}`}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => (isOpen ? setActiveActivityId(null) : openActivityForm(act))}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold"
                        >
                          {isOpen ? 'Fechar' : sub ? 'Ver / Reenviar' : 'Responder'}
                        </button>
                      </div>
                    </div>

                    {sub?.feedback && (
                      <div className="rounded-xl bg-[#E8F3EC] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-[#0B3321] dark:text-emerald-200">
                        <p className="font-bold flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4" />
                          <span>Devolutiva do Professor</span>
                        </p>
                        <p className="mt-1 leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
                      </div>
                    )}

                    {isOpen && (
                      <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                        {linkedQuestions.map((q, qIdx) => (
                          <div
                            key={q.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5"
                          >
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              Questão {qIdx + 1} · {q.topicTitle}
                            </p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                              {q.statement}
                            </p>
                            <div className="space-y-1.5">
                              {q.options.map((opt, optIdx) => {
                                const selected = objectiveAnswers[q.id] === optIdx;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() =>
                                      setObjectiveAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: optIdx,
                                      }))
                                    }
                                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors ${
                                      selected
                                        ? 'border-[#146C43] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200 font-semibold'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {act.prompts.map((promptText, pIdx) => {
                          const key = `prompt_${pIdx}`;
                          return (
                            <div
                              key={key}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2"
                            >
                              <p className="text-xs font-mono text-[#146C43] dark:text-emerald-400 font-semibold">
                                Questão Discursiva {pIdx + 1}
                              </p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{promptText}</p>
                              <textarea
                                rows={4}
                                value={discursiveResponses[key] || ''}
                                onChange={(e) =>
                                  setDiscursiveResponses((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="Redija sua resposta fundamentada..."
                                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#146C43]"
                              />
                            </div>
                          );
                        })}

                        {linkedQuestions.length === 0 && act.prompts.length === 0 && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Resposta livre da atividade
                            </p>
                            <textarea
                              rows={4}
                              value={discursiveResponses.geral || ''}
                              onChange={(e) =>
                                setDiscursiveResponses((prev) => ({
                                  ...prev,
                                  geral: e.target.value,
                                }))
                              }
                              placeholder="Digite sua entrega ou comentários para o professor..."
                              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#146C43]"
                            />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={busyAction || !isEnrolledInActiveClass}
                            onClick={() => void handleSubmitActivity(act)}
                            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            <span>
                              {!isEnrolledInActiveClass
                                ? 'Matricule-se na turma para enviar'
                                : busyAction
                                  ? 'Enviando...'
                                  : 'Enviar respostas'}
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

      {readerMaterial && (
        <BookReaderModal
          material={readerMaterial}
          onClose={() => setReaderMaterial(null)}
          onSummarizeWithGemini={onSummarizeWithGemini}
        />
      )}
    </div>
  );
}
