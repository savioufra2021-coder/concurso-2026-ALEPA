import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Filter,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  AcademicRequest,
  AcademicRequestCategory,
  AcademicRequestMessage,
  AcademicRequestStatus,
  CampusLevel,
} from '../types';
import { EmptyState, PageHeader, SectionCard } from './ui/CampusPrimitives';

const CATEGORY_LABELS: Record<AcademicRequestCategory, string> = {
  duvida_academica: 'Dúvida acadêmica sobre conteúdo',
  pedido_material: 'Inclusão de PDF / apostila',
  pedido_video_podcast: 'Criação / pedido de videoaula ou podcast',
  erro_conteudo: 'Correção de material, questão ou gabarito',
  sugestao: 'Sugestão de assunto / melhoria',
  suporte: 'Suporte e outros pedidos acadêmicos',
};

const STATUS_META: Record<AcademicRequestStatus, { label: string; badgeClass: string }> = {
  pendente: {
    label: 'Pendente',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  em_analise: {
    label: 'Em análise',
    badgeClass: 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  aguardando_resposta: {
    label: 'Aguardando resposta',
    badgeClass: 'bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  },
  respondida: {
    label: 'Respondida',
    badgeClass: 'bg-[#E8F3EC] dark:bg-emerald-950/50 text-[#0B3321] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  concluida: {
    label: 'Concluída',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

function formatDateTime(ts: unknown): string {
  try {
    if (!ts) return 'Agora';
    const d =
      typeof ts === 'object' && ts !== null && 'toDate' in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string | number);
    if (Number.isNaN(d.getTime())) return 'Agora';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Agora';
  }
}

export function RequestsCenterView({
  campus,
  mode = 'student',
}: {
  campus: CampusLevel;
  mode?: 'student' | 'teacher' | 'admin';
}) {
  const {
    user,
    isGuest,
    profile,
    allUsers,
    academicRequests,
    createAcademicRequest,
    subscribeAcademicRequestMessages,
    sendAcademicRequestMessage,
    updateAcademicRequestStatus,
    assignAcademicRequest,
    getCampusDisciplines,
    exitGuestMode,
  } = useAuth();

  const [statusFilter, setStatusFilter] = useState<'all' | AcademicRequestStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AcademicRequestCategory>('all');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AcademicRequestMessage[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Student create form state
  const [showCreateForm, setShowCreateForm] = useState(mode === 'student');
  const [formCampus, setFormCampus] = useState<CampusLevel>(campus);
  const formDisciplines = useMemo(
    () => getCampusDisciplines(formCampus, 'cargo_01_04'),
    [getCampusDisciplines, formCampus]
  );
  const [formDisciplineId, setFormDisciplineId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<AcademicRequestCategory>('duvida_academica');
  const [formTopic, setFormTopic] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormCampus(campus);
  }, [campus]);

  useEffect(() => {
    if (!formDisciplineId && formDisciplines[0]) {
      setFormDisciplineId(formDisciplines[0].id);
    }
  }, [formDisciplines, formDisciplineId]);

  const allDisciplineNames = useMemo(() => {
    const map: Record<string, string> = {};
    [...getCampusDisciplines('superior', 'cargo_01_04'), ...getCampusDisciplines('medio', 'cargo_01_04')].forEach(
      (d) => {
        map[d.id] = d.shortName;
      }
    );
    return map;
  }, [getCampusDisciplines]);

  const teachersList = useMemo(
    () => allUsers.filter((u) => u.active !== false && ['teacher', 'editor', 'admin', 'dev'].includes(u.role)),
    [allUsers]
  );

  const visibleRequests = useMemo(() => {
    let base: AcademicRequest[] = academicRequests;
    if (mode === 'student' && user) {
      base = academicRequests.filter((r) => r.studentId === user.uid);
    } else if (mode === 'teacher' && user) {
      const myDiscs = new Set(profile?.assignedDisciplineIds || []);
      base = academicRequests.filter(
        (r) => r.assignedTeacherId === user.uid || (!r.assignedTeacherId && myDiscs.has(r.disciplineId))
      );
    }
    return base.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      return true;
    });
  }, [academicRequests, mode, user, profile?.assignedDisciplineIds, statusFilter, categoryFilter]);

  const activeRequest = useMemo(
    () => visibleRequests.find((r) => r.id === selectedRequestId) || visibleRequests[0] || null,
    [visibleRequests, selectedRequestId]
  );

  useEffect(() => {
    if (!activeRequest) {
      setMessages([]);
      return;
    }
    const unsub = subscribeAcademicRequestMessages(activeRequest.id, (list) => {
      setMessages(list);
    });
    return () => unsub();
  }, [activeRequest?.id, subscribeAcademicRequestMessages]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);
    if (!user) {
      setErrorMsg('Entre com sua conta Google ou e-mail para registrar uma solicitação acadêmica.');
      return;
    }
    if (!formTitle.trim() || !formDescription.trim()) {
      setErrorMsg('Informe título e descrição detalhada para sua solicitação.');
      return;
    }
    setCreating(true);
    try {
      const id = await createAcademicRequest({
        category: formCategory,
        campusLevel: formCampus,
        disciplineId: formDisciplineId || formDisciplines[0]?.id || 'portugues',
        topicTitle: formTopic.trim() || 'Geral da disciplina',
        subject: formTitle.trim(),
        description: formDescription.trim(),
      });
      setFormTitle('');
      setFormTopic('');
      setFormDescription('');
      setSelectedRequestId(id);
      setShowCreateForm(false);
      setFeedback('Solicitação acadêmica registrada e encaminhada para atendimento humano docente/administrativo.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registrar solicitação.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !replyDraft.trim()) return;
    setSendingReply(true);
    setErrorMsg(null);
    try {
      await sendAcademicRequestMessage(activeRequest.id, replyDraft.trim());
      setReplyDraft('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (reqId: string, nextStatus: AcademicRequestStatus) => {
    setErrorMsg(null);
    try {
      await updateAcademicRequestStatus(reqId, nextStatus);
      setFeedback(`Status atualizado para "${STATUS_META[nextStatus].label}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    }
  };

  const handleAssignTeacher = async (reqId: string, teacherUid: string) => {
    const teacher = teachersList.find((t) => t.uid === teacherUid);
    if (!teacher) return;
    setErrorMsg(null);
    const assignedRole: 'teacher' | 'editor' | 'admin' =
      teacher.role === 'teacher' || teacher.role === 'editor' ? teacher.role : 'admin';
    try {
      await assignAcademicRequest(reqId, {
        uid: teacher.uid,
        displayName: teacher.displayName,
        role: assignedRole,
      });
      setFeedback(`Solicitação encaminhada para ${teacher.displayName}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao atribuir responsável.');
    }
  };

  if (isGuest && !user) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Atendimento Humano Real · Estudante ↔ Professor ↔ Coordenação"
          title="Central de Solicitações Acadêmicas"
          subtitle="Peça novas apostilas, videoaulas, podcasts, correções de gabarito ou tire dúvidas diretamente com professores e administração."
        />
        <SectionCard title="Login necessário para solicitações identificadas">
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <p>
              Para garantir histórico de mensagens com autoria real, acompanhamento de status e notificação de resposta, entre com sua conta.
            </p>
            <button
              type="button"
              onClick={exitGuestMode}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-sm font-semibold"
            >
              Fazer Login na Conta
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === 'student' && (
        <PageHeader
          eyebrow="Comunicação Humana Real · Estudante ↔ Professor ↔ Coordenação"
          title="Central de Solicitações Acadêmicas"
          subtitle="Solicite materiais, videoaulas, podcasts, correções de questões ou esclarecimentos diretamente à equipe docente (sem respostas automáticas de IA)."
          actions={
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{showCreateForm ? 'Ocultar formulário' : 'Nova solicitação'}</span>
            </button>
          }
        />
      )}

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

      {/* New Ticket Form (Student mode) */}
      {mode === 'student' && showCreateForm && (
        <SectionCard
          title="Abrir Nova Solicitação Acadêmica"
          subtitle="Descreva seu pedido para que o professor responsável pela disciplina ou a coordenação responda"
        >
          <form onSubmit={handleCreateRequest} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de solicitação
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as AcademicRequestCategory)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {(Object.keys(CATEGORY_LABELS) as AcademicRequestCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Campus / Nível
                </label>
                <select
                  value={formCampus}
                  onChange={(e) => {
                    const nextC = e.target.value as CampusLevel;
                    setFormCampus(nextC);
                    const nextD = getCampusDisciplines(nextC, 'cargo_01_04')[0]?.id || '';
                    setFormDisciplineId(nextD);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  <option value="superior">Nível Superior (002/2026)</option>
                  <option value="medio">Nível Médio (001/2026)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disciplina
                </label>
                <select
                  value={formDisciplineId}
                  onChange={(e) => setFormDisciplineId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {formDisciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.shortName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assunto / Tópico relacionado
                </label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="Ex: Art. 37 da CF ou Crase / Questão 14"
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título resumido *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Pedido de videoaula sobre Regimento Interno"
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descrição detalhada *
              </label>
              <textarea
                rows={3}
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva sua dúvida, material necessário ou erro encontrado..."
                className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{creating ? 'Enviando...' : 'Enviar Solicitação'}</span>
            </button>
          </form>
        </SectionCard>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtros:</span>
        </div>
        <select
          aria-label="Filtrar por status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | AcademicRequestStatus)}
          className="min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
        >
          <option value="all">Todos os status ({academicRequests.length})</option>
          {(Object.keys(STATUS_META) as AcademicRequestStatus[]).map((st) => (
            <option key={st} value={st}>
              {STATUS_META[st].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por categoria"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | AcademicRequestCategory)}
          className="min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
        >
          <option value="all">Todas as categorias</option>
          {(Object.keys(CATEGORY_LABELS) as AcademicRequestCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Master-Detail Requests Workspace */}
      {visibleRequests.length === 0 ? (
        <SectionCard title="Solicitações Acadêmicas">
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma solicitação encontrada"
            description={
              mode === 'student'
                ? 'Clique em "Nova solicitação" acima para enviar um pedido ou dúvida para um professor ou coordenação.'
                : 'Nenhuma solicitação corresponde aos filtros atuais neste momento.'
            }
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Request List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5">
            {visibleRequests.map((req) => {
              const selected = activeRequest?.id === req.id;
              const statusInfo = STATUS_META[req.status];
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedRequestId(req.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors space-y-2 ${
                    selected
                      ? 'bg-[#E8F3EC] dark:bg-emerald-950/50 border-[#146C43] dark:border-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-lg border font-semibold ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {formatDateTime(req.updatedAt)}
                    </span>
                  </div>
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {req.subject}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-[#146C43] dark:text-emerald-400">
                      {allDisciplineNames[req.disciplineId] || req.disciplineId}
                    </span>
                    <span>·</span>
                    <span className="truncate">{req.topicTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aluno: {req.studentName}
                    {req.assignedTeacherName ? ` · Resp.: ${req.assignedTeacherName}` : ' · Aguardando atribuição'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Request Detail & Human Chat */}
          {activeRequest && (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-lg border font-semibold ${
                          STATUS_META[activeRequest.status].badgeClass
                        }`}
                      >
                        {STATUS_META[activeRequest.status].label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {CATEGORY_LABELS[activeRequest.category]}
                      </span>
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {activeRequest.subject}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {allDisciplineNames[activeRequest.disciplineId] || activeRequest.disciplineId} ·{' '}
                      {activeRequest.topicTitle} · Solicitado por <strong>{activeRequest.studentName}</strong>
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDateTime(activeRequest.createdAt)}
                  </span>
                </div>

                {/* Description box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {activeRequest.description}
                </div>

                {/* Teacher & Admin Management Controls */}
                {(mode === 'admin' || mode === 'teacher') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800">
                    <div>
                      <label className="block text-[11px] font-bold text-[#0B3321] dark:text-emerald-300 mb-1">
                        Atualizar status da solicitação
                      </label>
                      <select
                        value={activeRequest.status}
                        onChange={(e) =>
                          void handleStatusChange(activeRequest.id, e.target.value as AcademicRequestStatus)
                        }
                        className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      >
                        {(Object.keys(STATUS_META) as AcademicRequestStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_META[st].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {mode === 'admin' ? (
                      <div>
                        <label className="block text-[11px] font-bold text-[#0B3321] dark:text-emerald-300 mb-1">
                          Encaminhar / Atribuir Professor
                        </label>
                        <select
                          value={activeRequest.assignedTeacherId || ''}
                          onChange={(e) => void handleAssignTeacher(activeRequest.id, e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        >
                          <option value="">Selecionar responsável...</option>
                          {teachersList.map((t) => (
                            <option key={t.uid} value={t.uid}>
                              {t.displayName} ({t.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-end">
                        {activeRequest.status === 'pendente' && user && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(activeRequest.id, 'em_analise')}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Iniciar análise</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time Message Thread */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Histórico de Conversa Humana ({messages.length})</span>
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      Sem respostas automáticas de IA
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        Nenhuma mensagem adicionada ainda neste protocolo. Use o campo abaixo para iniciar o atendimento.
                      </p>
                    ) : (
                      messages.map((m) => {
                        const isMine = m.senderId === user?.uid;
                        const isStaff = m.senderRole !== 'student';
                        return (
                          <div
                            key={m.id}
                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                              isMine
                                ? 'bg-[#E8F3EC] dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 ml-4'
                                : isStaff
                                  ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 mr-4'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mr-4'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1">
                                {isStaff && <ShieldCheck className="w-3 h-3 text-[#146C43] dark:text-emerald-400" />}
                                {m.senderName}
                              </span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                {formatDateTime(m.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                              {m.body}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Reply Input */}
              <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Escreva uma resposta humana..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyDraft.trim()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingReply ? '...' : 'Enviar'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
