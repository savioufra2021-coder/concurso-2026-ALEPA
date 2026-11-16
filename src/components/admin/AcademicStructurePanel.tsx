import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  Edit3,
  Eye,
  GraduationCap,
  Layers,
  Plus,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ALEPA_DISCIPLINES } from '../../data/alepaSyllabus';
import { getMedioDisciplines } from '../../data/alepaMedioSyllabus';
import {
  CampusLevel,
  Discipline,
  LibraryScope,
  ManagedTopic,
  MedioCargoGroup,
  PublicationStatus,
  formatRoleLabel,
  normalizeUserRole,
} from '../../types';
import { SectionCard } from '../ui/CampusPrimitives';
import { renderAdminStatusBadge } from './adminShared';

interface AcademicStructurePanelProps {
  campus: CampusLevel;
  medioCargoGroup: MedioCargoGroup;
  onNotifyOk: (msg: string) => void;
  onNotifyErr: (err: unknown, fallback: string) => void;
  onPreviewTopic: (topic: Partial<ManagedTopic>, disciplineName: string) => void;
  callAdminAuthoring: (payload: {
    action: 'draft_material_summary' | 'draft_question' | 'draft_topic' | 'draft_notice';
    disciplineName?: string;
    campusLevel?: LibraryScope;
    title?: string;
    topicTitle?: string;
    contextText?: string;
    url?: string;
  }) => Promise<Record<string, unknown>>;
}

export function AcademicStructurePanel({
  campus,
  medioCargoGroup,
  onNotifyOk,
  onNotifyErr,
  onPreviewTopic,
  callAdminAuthoring,
}: AcademicStructurePanelProps) {
  const {
    canManageUsers,
    allUsers,
    allManagedExams,
    allManagedClasses,
    enrollments,
    allManagedDisciplines,
    allManagedTopics,
    getCampusDisciplines,
    saveExamConcurso,
    updateExamStatus,
    saveClassroom,
    updateClassroomStatus,
    saveManagedDiscipline,
    updateManagedDisciplineStatus,
    saveManagedTopic,
    updateManagedTopicStatus,
    writeAuditLog,
  } = useAuth();

  // Exam / Concurso form
  const [editingExamId, setEditingExamId] = useState<string | undefined>(undefined);
  const [examTitle, setExamTitle] = useState('');
  const [examInstitution, setExamInstitution] = useState('ALEPA · Assembleia Legislativa do Pará');
  const [examCode, setExamCode] = useState('ALEPA-2026');
  const [examYear, setExamYear] = useState(2026);
  const [examLevels, setExamLevels] = useState<CampusLevel[]>(['superior', 'medio']);
  const [examPositionsText, setExamPositionsText] = useState(
    'Técnico Legislativo, Analista Legislativo, Auxiliar Legislativo'
  );
  const [examDate, setExamDate] = useState('');

  // Classroom / Turma form
  const [editingClassId, setEditingClassId] = useState<string | undefined>(undefined);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [classExamId, setClassExamId] = useState('');
  const [classCampus, setClassCampus] = useState<CampusLevel>(campus);
  const [classDiscIds, setClassDiscIds] = useState<string[]>([]);
  const [classTeacherIds, setClassTeacherIds] = useState<string[]>([]);
  const [classDesc, setClassDesc] = useState('');
  const [classActive, setClassActive] = useState(true);

  // Discipline form
  const [editingDiscId, setEditingDiscId] = useState<string | undefined>(undefined);
  const [discName, setDiscName] = useState('');
  const [discShortName, setDiscShortName] = useState('');
  const [discCampus, setDiscCampus] = useState<CampusLevel>(campus);
  const [discBlock, setDiscBlock] = useState<Discipline['editalBlock']>('Conhecimentos Específicos');
  const [discPriority, setDiscPriority] = useState(1);
  const [discQuestions, setDiscQuestions] = useState(10);
  const [discPoints, setDiscPoints] = useState(20);
  const [discMinutes, setDiscMinutes] = useState(60);

  // Topic form
  const [editingTopicId, setEditingTopicId] = useState<string | undefined>(undefined);
  const [topicCampus, setTopicCampus] = useState<CampusLevel>(campus);
  const [topicDisciplineId, setTopicDisciplineId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicSubtopicsText, setTopicSubtopicsText] = useState('');
  const [topicHighYield, setTopicHighYield] = useState(true);
  const [topicOrder, setTopicOrder] = useState(1);
  const [aiBusyTopic, setAiBusyTopic] = useState(false);

  const staffTeachers = useMemo(
    () =>
      allUsers.filter((u) => {
        const r = normalizeUserRole(u.role);
        return r === 'teacher' || r === 'admin' || r === 'editor' || r === 'dev';
      }),
    [allUsers]
  );

  const classCampusDisciplines = useMemo(
    () => getCampusDisciplines(classCampus, medioCargoGroup),
    [getCampusDisciplines, classCampus, medioCargoGroup]
  );

  const topicCampusDisciplines = useMemo(
    () => getCampusDisciplines(topicCampus, medioCargoGroup),
    [getCampusDisciplines, topicCampus, medioCargoGroup]
  );

  const effectiveDiscForTopic =
    topicDisciplineId ||
    (topicCampus === 'medio' ? getMedioDisciplines(medioCargoGroup)[0]?.id : ALEPA_DISCIPLINES[0]?.id) ||
    '';

  const allAvailableDisciplines = useMemo(() => {
    const sup = getCampusDisciplines('superior');
    const med = getCampusDisciplines('medio', medioCargoGroup);
    const map = new Map<string, Discipline>();
    sup.forEach((d) => map.set(d.id, d));
    med.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
  }, [getCampusDisciplines, medioCargoGroup]);

  const handleSaveExam = async (status: PublicationStatus) => {
    if (!examTitle.trim() || !examInstitution.trim() || !examCode.trim()) {
      onNotifyErr(null, 'Preencha título, instituição/banca e código do concurso.');
      return;
    }
    try {
      const positions = examPositionsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const id = await saveExamConcurso({
        examId: editingExamId,
        title: examTitle.trim(),
        institution: examInstitution.trim(),
        code: examCode.trim().toUpperCase(),
        year: Number(examYear) || 2026,
        levels: examLevels.length > 0 ? examLevels : ['superior'],
        positions,
        examDate: examDate || undefined,
        status,
      });
      await writeAuditLog({
        action: editingExamId ? 'update_exam' : 'create_exam',
        targetCollection: 'exams',
        targetId: id,
        summary: `Concurso ${examCode.trim().toUpperCase()} (${status})`,
      });
      setEditingExamId(undefined);
      setExamTitle('');
      onNotifyOk(
        status === 'published'
          ? 'Concurso publicado no catálogo institucional.'
          : 'Concurso salvo para revisão editorial.'
      );
    } catch (err) {
      onNotifyErr(err, 'Erro ao salvar concurso.');
    }
  };

  const handleSaveClassroom = async (status: PublicationStatus) => {
    if (!className.trim() || !classCode.trim()) {
      onNotifyErr(null, 'Informe o nome e o código da turma.');
      return;
    }
    try {
      const id = await saveClassroom({
        classId: editingClassId,
        name: className.trim(),
        code: classCode.trim().toUpperCase(),
        examId: classExamId || allManagedExams[0]?.examId || 'alepa-2026',
        campusLevel: classCampus,
        disciplineIds: classDiscIds,
        teacherIds: classTeacherIds,
        description: classDesc.trim(),
        active: classActive,
        status,
      });
      await writeAuditLog({
        action: editingClassId ? 'update_class' : 'create_class',
        targetCollection: 'classes',
        targetId: id,
        summary: `Turma ${className.trim()} (${classCode.trim().toUpperCase()}) · ${status}`,
      });
      setEditingClassId(undefined);
      setClassName('');
      setClassCode('');
      setClassDesc('');
      setClassDiscIds([]);
      setClassTeacherIds([]);
      onNotifyOk(
        status === 'published'
          ? 'Turma publicada para professores e estudantes.'
          : 'Turma salva no painel editorial.'
      );
    } catch (err) {
      onNotifyErr(err, 'Erro ao salvar turma.');
    }
  };

  const handleSaveDiscipline = async (status: PublicationStatus) => {
    if (!discName.trim() || !discShortName.trim()) {
      onNotifyErr(null, 'Preencha nome completo e sigla/nome curto da disciplina.');
      return;
    }
    try {
      await saveManagedDiscipline({
        id: editingDiscId,
        name: discName.trim(),
        shortName: discShortName.trim(),
        campusLevel: discCampus,
        editalBlock: discBlock,
        priorityRank: discPriority,
        examQuestions: discQuestions,
        examPoints: discPoints,
        tieBreakerOrder: discPriority,
        recommendedMinutesPerCycle: discMinutes,
        status,
      });
      setEditingDiscId(undefined);
      setDiscName('');
      setDiscShortName('');
      onNotifyOk(
        status === 'published'
          ? 'Disciplina publicada no ambiente dos estudantes.'
          : 'Disciplina salva em fluxo editorial.'
      );
    } catch (err) {
      onNotifyErr(err, 'Erro ao salvar disciplina.');
    }
  };

  const handleSaveTopic = async (status: PublicationStatus) => {
    if (!effectiveDiscForTopic || !topicTitle.trim()) {
      onNotifyErr(null, 'Selecione a disciplina e informe o título do assunto.');
      return;
    }
    try {
      const subtopics = topicSubtopicsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await saveManagedTopic({
        topicId: editingTopicId,
        disciplineId: effectiveDiscForTopic,
        campusLevel: topicCampus,
        title: topicTitle.trim(),
        subtopics,
        highYield: topicHighYield,
        order: topicOrder,
        status,
      });
      setEditingTopicId(undefined);
      setTopicTitle('');
      setTopicSubtopicsText('');
      onNotifyOk(
        status === 'published'
          ? 'Assunto publicado no edital do estudante.'
          : 'Assunto salvo para revisão.'
      );
    } catch (err) {
      onNotifyErr(err, 'Erro ao salvar assunto.');
    }
  };

  const handleAiDraftTopic = async () => {
    setAiBusyTopic(true);
    try {
      const discObj = allAvailableDisciplines.find((d) => d.id === effectiveDiscForTopic);
      const draft = await callAdminAuthoring({
        action: 'draft_topic',
        disciplineName: discObj?.name,
        campusLevel: topicCampus,
        topicTitle,
        contextText: topicSubtopicsText,
      });
      if (typeof draft.title === 'string') setTopicTitle(draft.title);
      if (Array.isArray(draft.subtopics)) {
        setTopicSubtopicsText(draft.subtopics.map((s) => String(s)).join('\n'));
      }
      if (typeof draft.highYield === 'boolean') setTopicHighYield(draft.highYield);
      onNotifyOk('Estrutura de tópico gerada em rascunho pela IA. Revise antes de publicar.');
    } catch (err) {
      onNotifyErr(err, 'Erro ao estruturar tópico com IA.');
    } finally {
      setAiBusyTopic(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Multi-Concursos & Turmas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title={editingExamId ? 'Editar Concurso / Curso' : 'Concursos & Cursos (Arquitetura Escalável)'}
          subtitle="Cadastre ALEPA 2026 e futuros concursos ou instituições sem alterar a estrutura base"
          rightSlot={<Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome do Concurso / Curso
                </label>
                <input
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Ex.: Concurso Público ALEPA 2026"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Código
                </label>
                <input
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value)}
                  placeholder="ALEPA-2026"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Instituição / Banca
                </label>
                <input
                  value={examInstitution}
                  onChange={(e) => setExamInstitution(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ano
                </label>
                <input
                  type="number"
                  min={2024}
                  max={2035}
                  value={examYear}
                  onChange={(e) => setExamYear(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Níveis Contemplados
                </span>
                <div className="flex flex-wrap gap-3 pt-1">
                  {(['superior', 'medio'] as const).map((lvl) => (
                    <label
                      key={lvl}
                      className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={examLevels.includes(lvl)}
                        onChange={(e) =>
                          setExamLevels((prev) =>
                            e.target.checked ? [...prev, lvl] : prev.filter((item) => item !== lvl)
                          )
                        }
                        className="h-4 w-4 rounded"
                      />
                      {lvl === 'superior' ? 'Superior' : 'Médio'}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data Prevista da Prova
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cargos previstos (separados por vírgula)
              </label>
              <input
                value={examPositionsText}
                onChange={(e) => setExamPositionsText(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSaveExam('draft')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Rascunho
              </button>
              <button
                type="button"
                onClick={() => void handleSaveExam('published')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
              >
                <Send className="h-3.5 w-3.5" />
                Publicar Concurso
              </button>
              {editingExamId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExamId(undefined);
                    setExamTitle('');
                  }}
                  className="min-h-[40px] px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancelar
                </button>
              )}
            </div>

            {allManagedExams.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Concursos cadastrados ({allManagedExams.length})
                </p>
                {allManagedExams.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{ex.title}</span>
                        {renderAdminStatusBadge(ex.status)}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        {ex.code} · {ex.institution} · {ex.year}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExamId(ex.examId || ex.id);
                          setExamTitle(ex.title);
                          setExamInstitution(ex.institution);
                          setExamCode(ex.code);
                          setExamYear(ex.year);
                          setExamLevels(ex.levels || ['superior']);
                          setExamPositionsText((ex.positions || []).join(', '));
                          setExamDate(ex.examDate || '');
                        }}
                        className="min-h-[34px] rounded border border-slate-200 px-2.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        Editar
                      </button>
                      {ex.status !== 'published' ? (
                        <button
                          type="button"
                          onClick={() => void updateExamStatus(ex.id, 'published')}
                          className="min-h-[34px] rounded bg-emerald-700 px-2.5 font-semibold text-white"
                        >
                          Publicar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void updateExamStatus(ex.id, 'archived')}
                          className="min-h-[34px] rounded border border-slate-200 px-2.5 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          Arquivar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Turmas / Classrooms */}
        <SectionCard
          title={editingClassId ? 'Editar Turma' : 'Turmas & Vínculo Docente'}
          subtitle="Crie turmas vinculando edital, escolaridade, disciplinas e professores responsáveis"
          rightSlot={<GraduationCap className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome da Turma
                </label>
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ex.: Turma Intensiva PL.AL.102 — Manhã"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Código
                </label>
                <input
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="TURMA-SUP-01"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Concurso / Edital
                </label>
                <select
                  value={classExamId}
                  onChange={(e) => setClassExamId(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="alepa-2026">ALEPA 2026 (Padrão)</option>
                  {allManagedExams.map((ex) => (
                    <option key={ex.id} value={ex.examId || ex.id}>
                      {ex.code} — {ex.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Escolaridade
                </label>
                <select
                  value={classCampus}
                  onChange={(e) => {
                    setClassCampus(e.target.value as CampusLevel);
                    setClassDiscIds([]);
                  }}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="superior">Nível Superior (PL.AL.102)</option>
                  <option value="medio">Nível Médio (PL.AL.060)</option>
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Disciplinas da Turma ({classDiscIds.length} selecionada(s))
              </p>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                {classCampusDisciplines.map((d) => (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={classDiscIds.includes(d.id)}
                      onChange={(e) =>
                        setClassDiscIds((prev) =>
                          e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)
                        )
                      }
                      className="h-3.5 w-3.5 rounded"
                    />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {canManageUsers && staffTeachers.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Professores / Equipe Pedagógica ({classTeacherIds.length})
                </p>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                  {staffTeachers.map((t) => (
                    <label
                      key={t.uid}
                      className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={classTeacherIds.includes(t.uid)}
                        onChange={(e) =>
                          setClassTeacherIds((prev) =>
                            e.target.checked ? [...prev, t.uid] : prev.filter((id) => id !== t.uid)
                          )
                        }
                        className="h-3.5 w-3.5 rounded"
                      />
                      <span className="truncate">
                        {t.displayName} · {formatRoleLabel(t.role)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <input
              value={classDesc}
              onChange={(e) => setClassDesc(e.target.value)}
              placeholder="Descrição / orientações da turma para os estudantes..."
              className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={classActive}
                onChange={(e) => setClassActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Turma aberta para matrículas
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSaveClassroom('draft')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Rascunho
              </button>
              <button
                type="button"
                onClick={() => void handleSaveClassroom('published')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
              >
                <Plus className="h-3.5 w-3.5" />
                Publicar Turma
              </button>
              {editingClassId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingClassId(undefined);
                    setClassName('');
                    setClassCode('');
                  }}
                  className="min-h-[40px] px-3 text-xs font-semibold text-slate-500"
                >
                  Cancelar
                </button>
              )}
            </div>

            {allManagedClasses.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Turmas cadastradas ({allManagedClasses.length})
                </p>
                {allManagedClasses.map((cls) => {
                  const activeStudents = enrollments.filter(
                    (e) => e.classId === cls.id && e.status === 'active'
                  ).length;
                  return (
                    <div
                      key={cls.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {cls.name}
                          </span>
                          {renderAdminStatusBadge(cls.status)}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                          {cls.code} · {cls.campusLevel === 'medio' ? 'Médio' : 'Superior'} ·{' '}
                          {activeStudents} aluno(s) · {cls.disciplineIds.length} disc.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClassId(cls.classId || cls.id);
                            setClassName(cls.name);
                            setClassCode(cls.code);
                            setClassExamId(cls.examId);
                            setClassCampus(cls.campusLevel);
                            setClassDiscIds(cls.disciplineIds || []);
                            setClassTeacherIds(cls.teacherIds || []);
                            setClassDesc(cls.description || '');
                            setClassActive(cls.active);
                          }}
                          className="min-h-[34px] rounded border border-slate-200 px-2.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Editar
                        </button>
                        {cls.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => void updateClassroomStatus(cls.id, 'published')}
                            className="min-h-[34px] rounded bg-emerald-700 px-2.5 font-semibold text-white"
                          >
                            Publicar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updateClassroomStatus(cls.id, 'archived')}
                            className="min-h-[34px] rounded border border-slate-200 px-2.5 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Arquivar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Disciplinas & Tópicos do Edital (preserved + 5-status + dark mode) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title={editingDiscId ? 'Editar Disciplina' : 'Nova Disciplina Institucional'}
          subtitle="Organiza a grade de Superior ou Médio"
          rightSlot={<Layers className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Escolaridade
                </label>
                <select
                  value={discCampus}
                  onChange={(e) => setDiscCampus(e.target.value as CampusLevel)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="superior">Nível Superior (PL.AL.102)</option>
                  <option value="medio">Nível Médio (PL.AL.060)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bloco do Edital
                </label>
                <select
                  value={discBlock}
                  onChange={(e) => setDiscBlock(e.target.value as Discipline['editalBlock'])}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Conhecimentos Específicos">Conhecimentos Específicos</option>
                  <option value="Legislação e Ética">Legislação e Ética</option>
                  <option value="Língua Portuguesa">Língua Portuguesa</option>
                  <option value="Raciocínio Lógico">Raciocínio Lógico</option>
                  <option value="Noções de Informática">Noções de Informática</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome completo da disciplina
                </label>
                <input
                  value={discName}
                  onChange={(e) => setDiscName(e.target.value)}
                  placeholder="Ex.: Regimento Interno da ALEPA"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome curto
                </label>
                <input
                  value={discShortName}
                  onChange={(e) => setDiscShortName(e.target.value)}
                  placeholder="Ex.: Regimento"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Prioridade
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={discPriority}
                  onChange={(e) => setDiscPriority(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Questões
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={discQuestions}
                  onChange={(e) => setDiscQuestions(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pontos
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={0.5}
                  value={discPoints}
                  onChange={(e) => setDiscPoints(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ciclo (min)
                </label>
                <input
                  type="number"
                  min={15}
                  max={360}
                  value={discMinutes}
                  onChange={(e) => setDiscMinutes(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSaveDiscipline('draft')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Salvar Rascunho
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDiscipline('published')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
              >
                <Send className="h-4 w-4" />
                Publicar Disciplina
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={editingTopicId ? 'Editar Tópico do Edital' : 'Cadastrar Assunto / Tópico do Edital'}
          subtitle="Inclui assistência da IA para organizar subtópicos"
          rightSlot={
            <button
              type="button"
              onClick={() => void handleAiDraftTopic()}
              disabled={aiBusyTopic}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-[#0B3321] hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusyTopic ? 'Gerando...' : 'Estruturar com IA'}
            </button>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Escolaridade
                </label>
                <select
                  value={topicCampus}
                  onChange={(e) => {
                    setTopicCampus(e.target.value as CampusLevel);
                    setTopicDisciplineId('');
                  }}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="superior">Nível Superior</option>
                  <option value="medio">Nível Médio</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Disciplina
                </label>
                <select
                  value={effectiveDiscForTopic}
                  onChange={(e) => setTopicDisciplineId(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {topicCampusDisciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="Ex.: Processo Legislativo Estadual e Espécies Normativas"
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <textarea
              rows={3}
              value={topicSubtopicsText}
              onChange={(e) => setTopicSubtopicsText(e.target.value)}
              placeholder={'Iniciativa das leis\nEmendas parlamentares\nSanção e veto'}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={topicHighYield}
                  onChange={(e) => setTopicHighYield(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Alta incidência CETAP
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ordem:</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={topicOrder}
                  onChange={(e) => setTopicOrder(Number(e.target.value))}
                  className="min-h-[38px] w-20 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const discObj = topicCampusDisciplines.find((d) => d.id === effectiveDiscForTopic);
                  onPreviewTopic(
                    {
                      title: topicTitle || 'Prévia de Tópico',
                      subtopics: topicSubtopicsText.split('\n').map((s) => s.trim()).filter(Boolean),
                      highYield: topicHighYield,
                      campusLevel: topicCampus,
                    },
                    discObj?.name || effectiveDiscForTopic
                  );
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Eye className="h-4 w-4" />
                Pré-visualizar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTopic('draft')}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Rascunho
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTopic('published')}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
              >
                <Send className="h-4 w-4" />
                Publicar Tópico
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Disciplinas Cadastradas"
          subtitle={`${allManagedDisciplines.length} disciplina(s) personalizada(s)`}
        >
          {allManagedDisciplines.length === 0 ? (
            <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
              Nenhuma disciplina adicional cadastrada ainda (as disciplinas base do edital permanecem ativas).
            </p>
          ) : (
            <div className="space-y-2">
              {allManagedDisciplines.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{d.name}</span>
                      {renderAdminStatusBadge(d.status)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {d.campusLevel === 'superior' ? 'Superior' : 'Médio'} · {d.editalBlock} ·{' '}
                      {d.examQuestions}q
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDiscId(d.id);
                        setDiscName(d.name);
                        setDiscShortName(d.shortName);
                        setDiscCampus(d.campusLevel);
                        setDiscBlock(d.editalBlock);
                        setDiscPriority(d.priorityRank);
                        setDiscQuestions(d.examQuestions);
                        setDiscPoints(d.examPoints);
                        setDiscMinutes(d.recommendedMinutesPerCycle);
                      }}
                      className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Edit3 className="inline h-3.5 w-3.5 mr-1" />
                      Editar
                    </button>
                    {d.status !== 'published' ? (
                      <button
                        type="button"
                        onClick={() => void updateManagedDisciplineStatus(d.id, 'published')}
                        className="min-h-[34px] rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white"
                      >
                        Publicar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateManagedDisciplineStatus(d.id, 'archived')}
                        className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        Arquivar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Tópicos Customizados do Edital"
          subtitle={`${allManagedTopics.length} tópico(s) gerenciado(s)`}
        >
          {allManagedTopics.length === 0 ? (
            <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
              Nenhum assunto extra cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {allManagedTopics.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</span>
                      {renderAdminStatusBadge(t.status)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.campusLevel === 'superior' ? 'Superior' : 'Médio'} · {t.subtopics.length} subtópico(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTopicId(t.topicId || t.id);
                        setTopicCampus(t.campusLevel);
                        setTopicDisciplineId(t.disciplineId);
                        setTopicTitle(t.title);
                        setTopicSubtopicsText(t.subtopics.join('\n'));
                        setTopicHighYield(t.highYield);
                        setTopicOrder(t.order);
                      }}
                      className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Editar
                    </button>
                    {t.status !== 'published' ? (
                      <button
                        type="button"
                        onClick={() => void updateManagedTopicStatus(t.id, 'published')}
                        className="min-h-[34px] rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white"
                      >
                        Publicar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateManagedTopicStatus(t.id, 'archived')}
                        className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        Arquivar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
