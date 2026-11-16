import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Eye,
  FolderOpen,
  HardDrive,
  Layers,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ALEPA_DISCIPLINES } from '../data/alepaSyllabus';
import { getMedioDisciplines, isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import {
  CampusLevel,
  Discipline,
  LibraryScope,
  ManagedTopic,
  MedioCargoGroup,
  NavSection,
  PlatformNotice,
  PublicationStatus,
  Question,
  QuestionDifficulty,
  QuestionOriginType,
  SimuladoList,
  StudyMaterial,
  formatRoleLabel,
} from '../types';
import { PageHeader, SectionCard } from './ui/CampusPrimitives';
import { getVideoEmbedInfo } from '../utils/mediaUrls';
import { apiFetch } from '../lib/apiClient';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { BookReaderModal } from './BookReaderModal';
import { ADMIN_STATUS_BADGE, renderAdminStatusBadge } from './admin/adminShared';
import { AcademicStructurePanel } from './admin/AcademicStructurePanel';
import { DocumentIntelligencePanel } from './admin/DocumentIntelligencePanel';
import { StorageCenterPanel } from './admin/StorageCenterPanel';
import { UsersGovernancePanel } from './admin/UsersGovernancePanel';
import { AuditReportsPanel } from './admin/AuditReportsPanel';
import { ContentOrganizerModal } from './ContentOrganizerModal';
import { RequestsCenterView } from './RequestsCenterView';

type AdminSubTab =
  | 'estatisticas'
  | 'estrutura'
  | 'documentos'
  | 'questoes'
  | 'avisos'
  | 'solicitacoes'
  | 'armazenamento'
  | 'usuarios';

interface AdminConsoleViewProps {
  campus: CampusLevel;
  onChangeCampus: (campus: CampusLevel) => void;
  medioCargoGroup: MedioCargoGroup;
  onOpenStudentPreview?: (section: NavSection) => void;
}

export function AdminConsoleView({
  campus,
  onChangeCampus,
  medioCargoGroup,
  onOpenStudentPreview,
}: AdminConsoleViewProps) {
  const {
    user,
    effectiveRole,
    canAccessAdminPanel,
    canManageUsers,
    setActiveWorkspaceMode,
    allManagedQuestions,
    questions,
    allManagedSimuladoLists,
    allManagedNotices,
    getCampusDisciplines,
    addCustomQuestion,
    updateCustomQuestion,
    updateQuestionStatus,
    saveSimuladoList,
    updateSimuladoListStatus,
    savePlatformNotice,
    updatePlatformNoticeStatus,
    writeAuditLog,
  } = useAuth();

  const [subTab, setSubTab] = useState<AdminSubTab>('estatisticas');
  const [statusFilter, setStatusFilter] = useState<'all' | PublicationStatus>('all');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [backendCheckMsg, setBackendCheckMsg] = useState<string | null>(null);
  const [adminReaderPreview, setAdminReaderPreview] = useState<StudyMaterial | null>(null);
  const [organizingMaterial, setOrganizingMaterial] = useState<StudyMaterial | null>(null);

  const [previewModal, setPreviewModal] = useState<
    | { kind: 'material'; item: Partial<StudyMaterial> }
    | { kind: 'question'; item: Partial<Question> }
    | { kind: 'notice'; item: Partial<PlatformNotice> }
    | { kind: 'topic'; item: Partial<ManagedTopic>; disciplineName: string }
    | null
  >(null);

  // Question form state
  const [editingQId, setEditingQId] = useState<string | undefined>(undefined);
  const [qCampus, setQCampus] = useState<CampusLevel>(campus);
  const [qDisciplineId, setQDisciplineId] = useState('');
  const [qTopicTitle, setQTopicTitle] = useState('');
  const [qOriginType, setQOriginType] = useState<QuestionOriginType>('training_platform');
  const [qDifficulty, setQDifficulty] = useState<QuestionDifficulty>('intermediario');
  const [qSource, setQSource] = useState('Equipe Pedagógica ALEPA 2026');
  const [qStatement, setQStatement] = useState('');
  const [qOptions, setQOptions] = useState<[string, string, string, string, string]>(['', '', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qLegalBasis, setQLegalBasis] = useState('');

  // Simulado List form state
  const [editingSimId, setEditingSimId] = useState<string | undefined>(undefined);
  const [simTitle, setSimTitle] = useState('');
  const [simDesc, setSimDesc] = useState('');
  const [simCampus, setSimCampus] = useState<LibraryScope>('superior');
  const [simDuration, setSimDuration] = useState(60);
  const [simQuestionIds, setSimQuestionIds] = useState<string[]>([]);
  const [simSearch, setSimSearch] = useState('');
  const [simDiscFilter, setSimDiscFilter] = useState('all');
  const [simOriginFilter, setSimOriginFilter] = useState<'all' | QuestionOriginType>('all');

  // Notice form state
  const [editingNoticeId, setEditingNoticeId] = useState<string | undefined>(undefined);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeCampus, setNoticeCampus] = useState<LibraryScope>('geral');
  const [noticePriority, setNoticePriority] = useState<'normal' | 'importante' | 'urgente'>('importante');
  const [noticeDate, setNoticeDate] = useState('');

  const allAvailableDisciplines = useMemo(() => {
    const sup = getCampusDisciplines('superior');
    const med = getCampusDisciplines('medio', medioCargoGroup);
    const map = new Map<string, Discipline & { campusTag: CampusLevel }>();
    sup.forEach((d) => map.set(d.id, { ...d, campusTag: 'superior' }));
    med.forEach((d) => map.set(d.id, { ...d, campusTag: 'medio' }));
    return Array.from(map.values());
  }, [getCampusDisciplines, medioCargoGroup]);

  const effectiveDiscForQ =
    qDisciplineId ||
    (qCampus === 'medio' ? getMedioDisciplines(medioCargoGroup)[0]?.id : ALEPA_DISCIPLINES[0]?.id) ||
    '';

  const filteredQuestionsList = useMemo(() => {
    if (statusFilter === 'all') return allManagedQuestions;
    return allManagedQuestions.filter(
      (q) => (q.status || (q.isPublished ? 'published' : 'draft')) === statusFilter
    );
  }, [allManagedQuestions, statusFilter]);

  const filteredSimQuestions = useMemo(() => {
    const term = simSearch.trim().toLowerCase();
    return questions.filter((q) => {
      if (simDiscFilter !== 'all' && q.disciplineId !== simDiscFilter) return false;
      if (simOriginFilter !== 'all' && q.originType !== simOriginFilter) return false;
      if (simCampus !== 'geral') {
        const isMedioQ = isMedioDisciplineId(q.disciplineId) || q.escolaridade === 'medio';
        if (simCampus === 'medio' && !isMedioQ) return false;
        if (simCampus === 'superior' && isMedioQ) return false;
      }
      if (!term) return true;
      return (
        q.statement.toLowerCase().includes(term) ||
        q.topicTitle.toLowerCase().includes(term) ||
        (q.source || '').toLowerCase().includes(term)
      );
    });
  }, [questions, simSearch, simDiscFilter, simOriginFilter, simCampus]);

  if (!canAccessAdminPanel) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SectionCard title="Acesso Restrito" subtitle="Ambiente administrativo protegido por RBAC">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Lock className="h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apenas contas verificadas com perfil Administrador Principal, Administrador de Conteúdo ou Desenvolvedor podem acessar este ambiente.
            </p>
          </div>
        </SectionCard>
      </div>
    );
  }

  const notifyOk = (text: string) => setFeedback({ type: 'ok', text });
  const notifyErr = (err: unknown, fallback: string) =>
    setFeedback({ type: 'err', text: err instanceof Error ? err.message : fallback });

  const callAdminAuthoring = async (payload: {
    action: 'draft_material_summary' | 'draft_question' | 'draft_topic' | 'draft_notice';
    disciplineName?: string;
    campusLevel?: LibraryScope;
    title?: string;
    topicTitle?: string;
    contextText?: string;
    url?: string;
  }) => {
    const res = await apiFetch('/api/admin/authoring', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: string; draft?: Record<string, unknown> };
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao gerar rascunho com IA.');
    }
    return json.draft || {};
  };

  const handleVerifyBackendRbac = async () => {
    setAiBusy('auth-check');
    setBackendCheckMsg(null);
    try {
      const res = await apiFetch('/api/admin/auth-check');
      const data = (await res.json()) as { ok?: boolean; role?: string; email?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha na verificação backend.');
      setBackendCheckMsg(`Backend RBAC validado: ${data.role} (${data.email})`);
    } catch (err) {
      setBackendCheckMsg(err instanceof Error ? err.message : 'Erro na validação.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleSaveQuestion = async (status: PublicationStatus) => {
    if (!qStatement.trim() || qOptions.some((o) => !o.trim()) || !qExplanation.trim()) {
      notifyErr(null, 'Preencha enunciado, todas as 5 alternativas (A–E) e o comentário explicativo.');
      return;
    }
    try {
      const isOfficial = qOriginType !== 'training_platform' && qOriginType !== 'ai_generated';
      if (editingQId) {
        await updateCustomQuestion(editingQId, {
          disciplineId: effectiveDiscForQ,
          escolaridade: qCampus,
          topicTitle: qTopicTitle.trim() || 'Questão de Concurso CETAP',
          originType: qOriginType,
          difficulty: qDifficulty,
          source: qSource.trim(),
          statement: qStatement.trim(),
          options: qOptions.map((o) => o.trim()) as [string, string, string, string, string],
          correctIndex: qCorrectIndex,
          explanation: qExplanation.trim(),
          legalBasis: qLegalBasis.trim(),
          isOfficial,
          status,
          isPublished: status === 'published',
        });
        await writeAuditLog({
          action: 'update_question',
          targetCollection: 'sharedQuestions',
          targetId: editingQId,
          summary: `Questão atualizada (${status})`,
        });
      } else {
        await addCustomQuestion({
          disciplineId: effectiveDiscForQ,
          escolaridade: qCampus,
          topicTitle: qTopicTitle.trim() || 'Questão de Concurso CETAP',
          originType: qOriginType,
          difficulty: qDifficulty,
          source: qSource.trim(),
          statement: qStatement.trim(),
          options: qOptions.map((o) => o.trim()) as [string, string, string, string, string],
          correctIndex: qCorrectIndex,
          explanation: qExplanation.trim(),
          legalBasis: qLegalBasis.trim(),
          isOfficial,
          status,
          isPublished: status === 'published',
        });
        await writeAuditLog({
          action: 'create_question',
          targetCollection: 'sharedQuestions',
          targetId: qTopicTitle.trim().slice(0, 60) || 'nova_questao',
          summary: `Nova questão criada (${status})`,
        });
      }
      setEditingQId(undefined);
      setQStatement('');
      setQOptions(['', '', '', '', '']);
      setQExplanation('');
      setQLegalBasis('');
      notifyOk(
        status === 'published'
          ? 'Questão publicada no banco do estudante.'
          : `Questão salva com status "${ADMIN_STATUS_BADGE[status].label}".`
      );
    } catch (err) {
      notifyErr(err, 'Erro ao salvar questão.');
    }
  };

  const handleAiDraftQuestion = async () => {
    setAiBusy('question');
    try {
      const discObj = allAvailableDisciplines.find((d) => d.id === effectiveDiscForQ);
      const draft = await callAdminAuthoring({
        action: 'draft_question',
        disciplineName: discObj?.name,
        campusLevel: qCampus,
        topicTitle: qTopicTitle,
        contextText: qStatement,
      });
      if (typeof draft.topicTitle === 'string') setQTopicTitle(draft.topicTitle);
      if (typeof draft.statement === 'string') setQStatement(draft.statement);
      if (Array.isArray(draft.options) && draft.options.length === 5) {
        setQOptions(draft.options.map((o) => String(o)) as [string, string, string, string, string]);
      }
      if (typeof draft.correctIndex === 'number') setQCorrectIndex(draft.correctIndex);
      if (typeof draft.explanation === 'string') setQExplanation(draft.explanation);
      if (typeof draft.legalBasis === 'string') setQLegalBasis(draft.legalBasis);
      setQOriginType('ai_generated');
      setQSource('Elaborada com Apoio IA · Revisão Docente');
      notifyOk('Questão rascunhada com IA. Confira gabarito e comentário antes de publicar.');
    } catch (err) {
      notifyErr(err, 'Erro ao elaborar questão com IA.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleSaveSimuladoList = async (status: PublicationStatus) => {
    if (!simTitle.trim() || simQuestionIds.length === 0) {
      notifyErr(null, 'Informe o título da lista e selecione ao menos 1 questão.');
      return;
    }
    try {
      await saveSimuladoList({
        listId: editingSimId,
        title: simTitle.trim(),
        description: simDesc.trim(),
        campusLevel: simCampus,
        durationMinutes: simDuration,
        questionIds: simQuestionIds,
        status,
      });
      setEditingSimId(undefined);
      setSimTitle('');
      setSimDesc('');
      setSimQuestionIds([]);
      notifyOk(
        status === 'published'
          ? 'Simulado publicado na aba Simulados dos estudantes.'
          : 'Lista salva para revisão.'
      );
    } catch (err) {
      notifyErr(err, 'Erro ao salvar simulado.');
    }
  };

  const handleSaveNotice = async (status: PublicationStatus) => {
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      notifyErr(null, 'Preencha título e conteúdo do aviso.');
      return;
    }
    try {
      await savePlatformNotice({
        noticeId: editingNoticeId,
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        campusLevel: noticeCampus,
        priority: noticePriority,
        eventDate: noticeDate || undefined,
        status,
      });
      setEditingNoticeId(undefined);
      setNoticeTitle('');
      setNoticeBody('');
      setNoticeDate('');
      notifyOk(
        status === 'published'
          ? 'Aviso publicado no Painel e Cronograma dos estudantes.'
          : 'Aviso salvo para revisão.'
      );
    } catch (err) {
      notifyErr(err, 'Erro ao salvar aviso.');
    }
  };

  const handleAiDraftNotice = async () => {
    setAiBusy('notice');
    try {
      const draft = await callAdminAuthoring({
        action: 'draft_notice',
        campusLevel: noticeCampus,
        title: noticeTitle,
        contextText: noticeBody,
      });
      if (typeof draft.title === 'string') setNoticeTitle(draft.title);
      if (typeof draft.body === 'string') setNoticeBody(draft.body);
      if (
        draft.priority === 'normal' ||
        draft.priority === 'importante' ||
        draft.priority === 'urgente'
      ) {
        setNoticePriority(draft.priority);
      }
      notifyOk('Aviso redigido com IA em rascunho. Pré-visualize antes de publicar.');
    } catch (err) {
      notifyErr(err, 'Erro ao redigir aviso com IA.');
    } finally {
      setAiBusy(null);
    }
  };

  const tabs: Array<{
    id: AdminSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hidden?: boolean;
  }> = [
    { id: 'estatisticas', label: 'Relatórios & IA Admin', icon: BarChart3 },
    { id: 'estrutura', label: 'Concursos, Turmas & Edital', icon: Layers },
    { id: 'documentos', label: 'Central de Documentos', icon: FolderOpen },
    { id: 'questoes', label: 'Questões & Simulados', icon: ClipboardList },
    { id: 'avisos', label: 'Avisos & Cronograma', icon: Bell },
    { id: 'solicitacoes', label: 'Solicitações', icon: MessageSquare },
    {
      id: 'armazenamento',
      label: 'Armazenamento Nuvem',
      icon: HardDrive,
      hidden: !canManageUsers,
    },
    {
      id: 'usuarios',
      label: 'Usuários & Governança',
      icon: Users,
      hidden: !canManageUsers,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow={`Ambiente Administrativo · ${formatRoleLabel(effectiveRole)}`}
        title="Gestão Institucional · Concurso -ALEPA 2026"
        subtitle={
          canManageUsers
            ? 'Controle completo de usuários, turmas, armazenamento na nuvem, auditoria e publicação segura.'
            : 'Curadoria e revisão editorial de disciplinas, documentos, questões e avisos. Ações administrativas de usuários, storage e auditoria são exclusivas do Administrador Principal.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleVerifyBackendRbac()}
              disabled={aiBusy === 'auth-check'}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              {aiBusy === 'auth-check' ? 'Validando...' : 'Validar RBAC Servidor'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveWorkspaceMode('student');
                onOpenStudentPreview?.('dashboard');
              }}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 py-2 text-xs font-semibold text-white hover:bg-[#146C43]"
            >
              <Eye className="h-4 w-4" />
              Visão do Estudante
            </button>
          </div>
        }
      />

      {backendCheckMsg && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <span>{backendCheckMsg}</span>
          <button type="button" onClick={() => setBackendCheckMsg(null)} className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="shrink-0 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-tabs + Campus filter */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-[#0B3321] bg-[#0B3321] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Campus alvo:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            {(['superior', 'medio'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  onChangeCampus(lvl);
                  setQCampus(lvl);
                }}
                className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition ${
                  campus === lvl
                    ? 'bg-emerald-50 text-[#0B3321] dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {lvl === 'superior' ? 'Superior (PL.AL.102)' : 'Médio (PL.AL.060)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: RELATÓRIOS, IA & AUDITORIA */}
      {subTab === 'estatisticas' && (
        <AuditReportsPanel onNotifyOk={notifyOk} onNotifyErr={notifyErr} />
      )}

      {/* TAB 2: CONCURSOS, TURMAS, DISCIPLINAS & TÓPICOS */}
      {subTab === 'estrutura' && (
        <AcademicStructurePanel
          campus={campus}
          medioCargoGroup={medioCargoGroup}
          onNotifyOk={notifyOk}
          onNotifyErr={notifyErr}
          onPreviewTopic={(topic, disciplineName) =>
            setPreviewModal({ kind: 'topic', item: topic, disciplineName })
          }
          callAdminAuthoring={callAdminAuthoring}
        />
      )}

      {/* TAB 3: CENTRAL INTELIGENTE DE DOCUMENTOS */}
      {subTab === 'documentos' && (
        <DocumentIntelligencePanel
          campus={campus}
          medioCargoGroup={medioCargoGroup}
          onNotifyOk={notifyOk}
          onNotifyErr={notifyErr}
          onPreviewMaterial={(mat) => setPreviewModal({ kind: 'material', item: mat })}
          onOpenBookReader={(mat) => setAdminReaderPreview(mat)}
          onOrganizeMaterial={(mat) => setOrganizingMaterial(mat)}
          callAdminAuthoring={callAdminAuthoring}
        />
      )}

      {/* TAB: SOLICITAÇÕES ACADÊMICAS (RESPOSTAS HUMANAS ADMIN/STAFF) */}
      {subTab === 'solicitacoes' && <RequestsCenterView campus={campus} mode="admin" />}

      {/* TAB 4: QUESTÕES & SIMULADOS */}
      {subTab === 'questoes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard
              title={editingQId ? 'Editar Questão' : 'Cadastrar Questão (5 Alternativas · CETAP)'}
              subtitle="Com suporte a IA, nível de dificuldade e fluxo editorial completo"
              rightSlot={
                <button
                  type="button"
                  onClick={() => void handleAiDraftQuestion()}
                  disabled={aiBusy === 'question'}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-[#0B3321] hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiBusy === 'question' ? 'Elaborando...' : 'Elaborar com IA'}
                </button>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Escolaridade
                    </label>
                    <select
                      value={qCampus}
                      onChange={(e) => {
                        setQCampus(e.target.value as CampusLevel);
                        setQDisciplineId('');
                      }}
                      className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="superior">Nível Superior</option>
                      <option value="medio">Nível Médio</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Disciplina
                    </label>
                    <select
                      value={effectiveDiscForQ}
                      onChange={(e) => setQDisciplineId(e.target.value)}
                      className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {getCampusDisciplines(qCampus, medioCargoGroup).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={qTopicTitle}
                    onChange={(e) => setQTopicTitle(e.target.value)}
                    placeholder="Assunto do edital"
                    className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <select
                    value={qOriginType}
                    onChange={(e) => setQOriginType(e.target.value as QuestionOriginType)}
                    className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="official_cetap">Oficial Fundação CETAP</option>
                    <option value="official_alepa">Oficial ALEPA</option>
                    <option value="training_platform">Treinamento Editorial</option>
                    <option value="ai_generated">Inédita com IA (Revisada)</option>
                  </select>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as QuestionDifficulty)}
                    className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="basico">Nível Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={qStatement}
                  onChange={(e) => setQStatement(e.target.value)}
                  placeholder="Enunciado da questão..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />

                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((letter, idx) => (
                    <div key={letter} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQCorrectIndex(idx)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                          qCorrectIndex === idx
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title="Marcar como gabarito correto"
                      >
                        {letter}
                      </button>
                      <input
                        value={qOptions[idx]}
                        onChange={(e) => {
                          const next = [...qOptions] as [string, string, string, string, string];
                          next[idx] = e.target.value;
                          setQOptions(next);
                        }}
                        placeholder={`Alternativa ${letter}`}
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Comentário explicativo do gabarito..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <input
                  value={qLegalBasis}
                  onChange={(e) => setQLegalBasis(e.target.value)}
                  placeholder="Fundamentação legal / doutrinária (opcional)"
                  className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewModal({
                        kind: 'question',
                        item: {
                          topicTitle: qTopicTitle || 'Prévia de Questão',
                          statement: qStatement || 'Enunciado de teste',
                          options: qOptions,
                          correctIndex: qCorrectIndex,
                          explanation: qExplanation,
                          legalBasis: qLegalBasis,
                        },
                      })
                    }
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Eye className="h-4 w-4" />
                    Pré-visualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQuestion('draft')}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQuestion('approved')}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3.5 text-xs font-semibold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQuestion('published')}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
                  >
                    <Send className="h-4 w-4" />
                    Publicar Questão
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Simulado List Builder */}
            <SectionCard
              title="Organizar Simulados & Listas de Exercícios"
              subtitle="Monte cadernos selecionando questões do banco"
            >
              <div className="space-y-3">
                <input
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  placeholder="Ex.: Simulado Geral CETAP #01 — Legislação + Português"
                  className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    value={simCampus}
                    onChange={(e) => setSimCampus(e.target.value as LibraryScope)}
                    className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="geral">Geral (Todos)</option>
                    <option value="superior">Nível Superior</option>
                    <option value="medio">Nível Médio</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Duração (min):
                    </span>
                    <input
                      type="number"
                      min={5}
                      max={360}
                      value={simDuration}
                      onChange={(e) => setSimDuration(Number(e.target.value))}
                      className="min-h-[42px] w-24 rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={simDesc}
                  onChange={(e) => setSimDesc(e.target.value)}
                  placeholder="Orientações do caderno de simulado..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Selecione questões ({simQuestionIds.length} selecionada(s) · {filteredSimQuestions.length} compatíveis):
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const visibleIds = filteredSimQuestions.slice(0, 50).map((q) => q.id);
                          setSimQuestionIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                        }}
                        className="min-h-[30px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        + Selecionar até 50 filtradas
                      </button>
                      {simQuestionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSimQuestionIds([])}
                          className="min-h-[30px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      value={simSearch}
                      onChange={(e) => setSimSearch(e.target.value)}
                      placeholder="Buscar assunto ou enunciado..."
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <select
                      value={simDiscFilter}
                      onChange={(e) => setSimDiscFilter(e.target.value)}
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="all">Todas disciplinas</option>
                      {allAvailableDisciplines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.shortName} ({d.campusTag === 'medio' ? 'Méd.' : 'Sup.'})
                        </option>
                      ))}
                    </select>
                    <select
                      value={simOriginFilter}
                      onChange={(e) => setSimOriginFilter(e.target.value as 'all' | QuestionOriginType)}
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="all">Todas origens</option>
                      <option value="official_cetap">Oficial CETAP</option>
                      <option value="official_alepa">Oficial ALEPA</option>
                      <option value="training_platform">Treinamento</option>
                      <option value="ai_generated">IA Revisada</option>
                    </select>
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                    {filteredSimQuestions.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Nenhuma questão encontrada para os filtros aplicados.
                      </p>
                    ) : (
                      filteredSimQuestions.slice(0, 120).map((q) => {
                        const checked = simQuestionIds.includes(q.id);
                        return (
                          <label
                            key={q.id}
                            className="flex cursor-pointer items-start gap-2 rounded p-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSimQuestionIds((prev) =>
                                  e.target.checked
                                    ? [...prev, q.id]
                                    : prev.filter((id) => id !== q.id)
                                )
                              }
                              className="mt-0.5 h-4 w-4 rounded"
                            />
                            <span className="line-clamp-2 text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                [{q.topicTitle}]
                              </strong>{' '}
                              {q.statement}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveSimuladoList('draft')}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Salvar Rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveSimuladoList('published')}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
                  >
                    <Plus className="h-4 w-4" />
                    Publicar Lista
                  </button>
                </div>

                {allManagedSimuladoLists.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Listas cadastradas
                    </p>
                    {allManagedSimuladoLists.map((list: SimuladoList) => (
                      <div
                        key={list.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {list.title}
                            </span>
                            {renderAdminStatusBadge(list.status)}
                          </div>
                          <p className="text-slate-500 dark:text-slate-400">
                            {list.questionIds.length} questões · {list.durationMinutes} min
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          {list.status !== 'published' ? (
                            <button
                              type="button"
                              onClick={() => void updateSimuladoListStatus(list.id, 'published')}
                              className="min-h-[34px] rounded bg-emerald-700 px-2.5 font-semibold text-white"
                            >
                              Publicar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void updateSimuladoListStatus(list.id, 'archived')}
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
          </div>

          <SectionCard
            title="Questões Autorais & Revisão Docente"
            subtitle={`${filteredQuestionsList.length} questão(ões)`}
            rightSlot={
              <div className="flex flex-wrap gap-1">
                {(['all', 'draft', 'in_review', 'approved', 'published', 'archived'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`min-h-[34px] rounded-md border px-2 text-[11px] font-semibold ${
                        statusFilter === st
                          ? 'border-[#0B3321] bg-[#0B3321] text-white'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {st === 'all' ? 'Todas' : ADMIN_STATUS_BADGE[st].label}
                    </button>
                  )
                )}
              </div>
            }
          >
            {filteredQuestionsList.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                Nenhuma questão encontrada neste filtro.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredQuestionsList.map((q) => {
                  const st: PublicationStatus = q.status || (q.isPublished ? 'published' : 'draft');
                  return (
                    <div
                      key={q.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#0B3321] dark:text-emerald-400">
                            {q.topicTitle}
                          </span>
                          {renderAdminStatusBadge(st)}
                          {q.needsReview && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                              Revisão pendente
                            </span>
                          )}
                          {q.sourcePage && (
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              · pág. {q.sourcePage}
                            </span>
                          )}
                          {q.difficulty && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              · {q.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
                          {q.statement}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ kind: 'question', item: q })}
                          className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Prévia
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQId(q.id);
                            setQCampus(q.escolaridade || 'superior');
                            setQDisciplineId(q.disciplineId);
                            setQTopicTitle(q.topicTitle);
                            setQOriginType(q.originType || 'training_platform');
                            setQDifficulty(q.difficulty || 'intermediario');
                            setQSource(q.source || '');
                            setQStatement(q.statement);
                            setQOptions(q.options);
                            setQCorrectIndex(q.correctIndex);
                            setQExplanation(q.explanation);
                            setQLegalBasis(q.legalBasis || '');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Editar
                        </button>
                        {st === 'in_review' && (
                          <button
                            type="button"
                            onClick={() => void updateQuestionStatus(q.id, 'approved')}
                            className="min-h-[34px] rounded bg-indigo-700 px-2.5 text-xs font-semibold text-white"
                          >
                            Aprovar
                          </button>
                        )}
                        {st !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => void updateQuestionStatus(q.id, 'published')}
                            className="min-h-[34px] rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white"
                          >
                            Publicar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updateQuestionStatus(q.id, 'archived')}
                            className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
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
          </SectionCard>
        </div>
      )}

      {/* TAB 5: AVISOS & CRONOGRAMA */}
      {subTab === 'avisos' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard
            title={editingNoticeId ? 'Editar Aviso Institucional' : 'Novo Aviso / Atualização de Cronograma'}
            subtitle="Exibido no Painel Inicial e no Cronograma dos estudantes"
            rightSlot={
              <button
                type="button"
                onClick={() => void handleAiDraftNotice()}
                disabled={aiBusy === 'notice'}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-[#0B3321] dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiBusy === 'notice' ? 'Redigindo...' : 'Redigir com IA'}
              </button>
            }
          >
            <div className="space-y-3">
              <input
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="Ex.: Simulado Oficial da Semana liberado!"
                className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={noticeCampus}
                  onChange={(e) => setNoticeCampus(e.target.value as LibraryScope)}
                  className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="geral">Todos os Níveis</option>
                  <option value="superior">Nível Superior</option>
                  <option value="medio">Nível Médio</option>
                </select>
                <select
                  value={noticePriority}
                  onChange={(e) => setNoticePriority(e.target.value as 'normal' | 'importante' | 'urgente')}
                  className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="normal">Prioridade Normal</option>
                  <option value="importante">Importante</option>
                  <option value="urgente">Urgente</option>
                </select>
                <input
                  type="date"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={4}
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
                placeholder="Mensagem para os estudantes..."
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewModal({
                      kind: 'notice',
                      item: {
                        title: noticeTitle || 'Prévia do Aviso',
                        body: noticeBody || 'Texto do comunicado.',
                        priority: noticePriority,
                        campusLevel: noticeCampus,
                        eventDate: noticeDate,
                      },
                    })
                  }
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Eye className="h-4 w-4" />
                  Pré-visualizar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveNotice('draft')}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Rascunho
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveNotice('published')}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
                >
                  <Send className="h-4 w-4" />
                  Publicar Aviso
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Avisos Cadastrados" subtitle={`${allManagedNotices.length} aviso(s)`}>
            {allManagedNotices.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhum aviso institucional cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {allManagedNotices.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {n.title}
                        </span>
                        {renderAdminStatusBadge(n.status)}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoticeId(n.noticeId || n.id);
                            setNoticeTitle(n.title);
                            setNoticeBody(n.body);
                            setNoticeCampus(n.campusLevel);
                            setNoticePriority(n.priority);
                            setNoticeDate(n.eventDate || '');
                          }}
                          className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Editar
                        </button>
                        {n.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => void updatePlatformNoticeStatus(n.id, 'published')}
                            className="min-h-[34px] rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white"
                          >
                            Publicar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updatePlatformNoticeStatus(n.id, 'archived')}
                            className="min-h-[34px] rounded border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Arquivar
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* TAB 6: ARMAZENAMENTO NUVEM (PRINCIPAL ADMIN ONLY) */}
      {subTab === 'armazenamento' && canManageUsers && (
        <StorageCenterPanel onNotifyOk={notifyOk} onNotifyErr={notifyErr} />
      )}

      {/* TAB 7: USUÁRIOS & GOVERNANÇA (PRINCIPAL ADMIN ONLY) */}
      {subTab === 'usuarios' && canManageUsers && (
        <UsersGovernancePanel
          medioCargoGroup={medioCargoGroup}
          onNotifyOk={notifyOk}
          onNotifyErr={notifyErr}
        />
      )}

      {/* PRE-VISUALIZAÇÃO MODAL */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Pré-visualização no Ambiente do Estudante
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Conferência antes da publicação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {previewModal.kind === 'material' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 uppercase dark:border-emerald-800 dark:bg-emerald-950/60">
                      {previewModal.item.resourceType || previewModal.item.fileType || 'material'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {previewModal.item.campusLevel === 'medio'
                        ? 'Nível Médio'
                        : previewModal.item.campusLevel === 'superior'
                          ? 'Nível Superior'
                          : 'Geral (Superior + Médio)'}
                    </span>
                  </div>
                  <h4 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {previewModal.item.title}
                  </h4>
                  {previewModal.item.editalTopic && (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Tópico: {previewModal.item.editalTopic}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    {previewModal.item.description || 'Sem descrição adicional informada.'}
                  </p>
                  {previewModal.item.url && (
                    <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
                      Link: {previewModal.item.url}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    Versão {previewModal.item.version || 1}
                    {previewModal.item.pageCount ? ` · ${previewModal.item.pageCount} págs.` : ''}
                    {previewModal.item.allowDownload === false
                      ? ' · Download bloqueado'
                      : ' · Download permitido'}
                  </p>
                </div>

                {previewModal.item.url &&
                  isInAppReadableMaterial({
                    url: previewModal.item.url,
                    fileType: previewModal.item.fileType || 'pdf',
                    resourceType: previewModal.item.resourceType,
                    fileName: previewModal.item.fileName,
                  }) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target: StudyMaterial = {
                          id: previewModal.item.id || 'admin_preview',
                          ownerId: user?.uid || 'admin',
                          title: previewModal.item.title || 'Prévia PDF',
                          disciplineId: previewModal.item.disciplineId || ALEPA_DISCIPLINES[0]?.id || '',
                          fileType: previewModal.item.fileType || 'pdf',
                          resourceType: previewModal.item.resourceType,
                          url: previewModal.item.url || '',
                          institution: previewModal.item.institution,
                          allowDownload: previewModal.item.allowDownload,
                          pageCount: previewModal.item.pageCount,
                          version: previewModal.item.version,
                          isShared: false,
                        };
                        setPreviewModal(null);
                        setAdminReaderPreview(target);
                      }}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43]"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Testar no Book Reader</span>
                    </button>
                  )}

                {previewModal.item.url && (() => {
                  const embed = getVideoEmbedInfo(previewModal.item.url || '');
                  if (!embed?.embedUrl) return null;
                  return (
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <iframe
                        src={embed.embedUrl}
                        title="Prévia do player"
                        className="aspect-video w-full"
                        allowFullScreen
                      />
                    </div>
                  );
                })()}
              </div>
            )}

            {previewModal.kind === 'question' && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  {previewModal.item.topicTitle}
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {previewModal.item.statement}
                </p>
                <div className="space-y-2">
                  {(previewModal.item.options || []).map((opt, idx) => {
                    const letters = ['A', 'B', 'C', 'D', 'E'];
                    const isCorrect = idx === previewModal.item.correctIndex;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                        }`}
                      >
                        <strong>{letters[idx]})</strong> {opt}
                      </div>
                    );
                  })}
                </div>
                {previewModal.item.explanation && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <strong>Comentário:</strong> {previewModal.item.explanation}
                    {previewModal.item.legalBasis && (
                      <p className="mt-1 font-medium text-emerald-800 dark:text-emerald-300">
                        Base: {previewModal.item.legalBasis}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {previewModal.kind === 'notice' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
                  <Bell className="h-4 w-4" />
                  <span>{previewModal.item.priority || 'importante'}</span>
                  {previewModal.item.eventDate && <span>· {previewModal.item.eventDate}</span>}
                </div>
                <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  {previewModal.item.title}
                </h4>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {previewModal.item.body}
                </p>
              </div>
            )}

            {previewModal.kind === 'topic' && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {previewModal.disciplineName}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#0B3321] dark:text-emerald-400" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {previewModal.item.title}
                  </h4>
                  {previewModal.item.highYield && (
                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                      Alta Incidência
                    </span>
                  )}
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-300">
                  {(previewModal.item.subtopics || []).map((st, idx) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Fechar Pré-visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {adminReaderPreview && (
        <BookReaderModal
          material={adminReaderPreview}
          onClose={() => setAdminReaderPreview(null)}
        />
      )}

      {organizingMaterial && (
        <ContentOrganizerModal
          material={organizingMaterial}
          campus={campus}
          onClose={() => setOrganizingMaterial(null)}
          onSaved={() => notifyOk('Estrutura, subtítulo e recomendações do documento salvos.')}
        />
      )}
    </div>
  );
}
