import React, { useMemo, useState } from 'react';
import {
  Activity,
  Download,
  Edit3,
  Eye,
  FileJson,
  Lock,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../lib/apiClient';
import { formatBytes } from '../../lib/storageService';
import { formatRoleLabel, normalizeUserRole } from '../../types';
import { SectionCard, StatTile } from '../ui/CampusPrimitives';

interface AuditReportsPanelProps {
  onNotifyOk: (msg: string) => void;
  onNotifyErr: (err: unknown, fallback: string) => void;
}

export function AuditReportsPanel({ onNotifyOk, onNotifyErr }: AuditReportsPanelProps) {
  const {
    canManageUsers,
    allUsers,
    accessSessions,
    allManagedExams,
    allManagedClasses,
    enrollments,
    allManagedMaterials,
    allManagedQuestions,
    allManagedDisciplines,
    allManagedTopics,
    allManagedSimuladoLists,
    allManagedNotices,
    storageMetadataRecords,
    auditLogs,
    submissions,
    writeAuditLog,
  } = useAuth();

  const [aiPrompt, setAiPrompt] = useState(
    'Analise o estado atual da plataforma e recomende as 3 prioridades editoriais e operacionais desta semana.'
  );
  const [aiReply, setAiReply] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

  const stats = useMemo(() => {
    const customMats = allManagedMaterials.filter((m) => !m.isSystemDefault);
    const matDrafts = customMats.filter((m) => m.status === 'draft' || m.status === 'in_review').length;
    const matPub = customMats.filter((m) => !m.status || m.status === 'published').length;
    const matArch = customMats.filter((m) => m.status === 'archived').length;

    const qDrafts = allManagedQuestions.filter((q) => q.status === 'draft' || q.status === 'in_review').length;
    const qPub = allManagedQuestions.filter((q) => !q.status || q.status === 'published').length;

    const onlineDevices = accessSessions.filter((s) => s.isOnline).length;
    const adminCount = allUsers.filter((u) => {
      const r = normalizeUserRole(u.role);
      return r === 'admin' || r === 'dev';
    }).length;
    const teacherCount = allUsers.filter((u) => normalizeUserRole(u.role) === 'teacher').length;
    const editorCount = allUsers.filter((u) => normalizeUserRole(u.role) === 'editor').length;
    const storageBytes = storageMetadataRecords.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);

    return {
      totalUsers: allUsers.length,
      adminCount,
      teacherCount,
      editorCount,
      studentCount: Math.max(0, allUsers.length - adminCount - teacherCount - editorCount),
      onlineDevices,
      matDrafts,
      matPub,
      matArch,
      qDrafts,
      qPub,
      discTotal: allManagedDisciplines.length,
      topicTotal: allManagedTopics.length,
      simTotal: allManagedSimuladoLists.length,
      noticePub: allManagedNotices.filter((n) => n.status === 'published').length,
      classesCount: allManagedClasses.length,
      enrollmentsCount: enrollments.filter((e) => e.status === 'active').length,
      storageObjects: storageMetadataRecords.length,
      storageBytes,
    };
  }, [
    allUsers,
    accessSessions,
    allManagedMaterials,
    allManagedQuestions,
    allManagedDisciplines,
    allManagedTopics,
    allManagedSimuladoLists,
    allManagedNotices,
    allManagedClasses,
    enrollments,
    storageMetadataRecords,
  ]);

  const filteredLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    if (!term) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.action.toLowerCase().includes(term) ||
        log.summary.toLowerCase().includes(term) ||
        log.targetCollection.toLowerCase().includes(term) ||
        (log.actorEmail || log.actorId).toLowerCase().includes(term)
    );
  }, [auditLogs, auditSearch]);

  const handleAskAdminAssistant = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const platformSnapshot = [
        `Usuários cadastrados (visível): ${stats.totalUsers} (Adm: ${stats.adminCount}, Editores: ${stats.editorCount}, Profs: ${stats.teacherCount}, Alunos: ${stats.studentCount})`,
        `Sessões online registradas: ${stats.onlineDevices}`,
        `Concursos/Editais: ${allManagedExams.length} | Turmas: ${stats.classesCount} | Matrículas ativas: ${stats.enrollmentsCount}`,
        `Materiais customizados: ${stats.matPub} publicados, ${stats.matDrafts} rascunho/revisão, ${stats.matArch} arquivados`,
        `Questões autorais: ${stats.qPub} publicadas, ${stats.qDrafts} pendentes`,
        `Disciplinas extras: ${stats.discTotal} | Tópicos extras: ${stats.topicTotal} | Listas Simulado: ${stats.simTotal} | Avisos ativos: ${stats.noticePub}`,
        `Armazenamento mapeado: ${stats.storageObjects} objetos (${formatBytes(stats.storageBytes)})`,
        `Submissões em atividades: ${submissions.length}`,
      ].join('\n');

      const res = await apiFetch('/api/ai/admin-assistant', {
        method: 'POST',
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          platformSnapshot,
        }),
      });
      const data = (await res.json()) as { error?: string; reply?: string };
      if (!res.ok) throw new Error(data.error || 'Erro no Assistente Administrativo.');
      setAiReply(data.reply || '');
    } catch (err) {
      onNotifyErr(err, 'Erro ao consultar Assistente Administrativo IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportJsonBackup = async () => {
    if (!canManageUsers) return;
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        platform: 'Concurso -ALEPA 2026',
        exams: allManagedExams,
        classes: allManagedClasses,
        enrollments,
        managedDisciplines: allManagedDisciplines,
        managedTopics: allManagedTopics,
        materials: allManagedMaterials.filter((m) => !m.isSystemDefault),
        questions: allManagedQuestions,
        simuladoLists: allManagedSimuladoLists,
        notices: allManagedNotices,
        storageMetadata: storageMetadataRecords,
        auditLogs: auditLogs.slice(0, 200),
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alepa-campus-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await writeAuditLog({
        action: 'export_json_backup',
        targetCollection: 'platform',
        targetId: 'snapshot',
        summary: 'Exportação de backup JSON completo da estrutura e catálogo institucional',
      });
      onNotifyOk('Backup JSON exportado com sucesso.');
    } catch (err) {
      onNotifyErr(err, 'Erro ao exportar backup JSON.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Usuários"
          value={stats.totalUsers}
          hint={canManageUsers ? `${stats.teacherCount} prof. / ${stats.studentCount} alunos` : 'Modo Editor'}
        />
        <StatTile label="Sessões Online" value={stats.onlineDevices} hint="PC + Celular" />
        <StatTile
          label="Turmas / Matríc."
          value={`${stats.classesCount} / ${stats.enrollmentsCount}`}
          hint={`${allManagedExams.length} concurso(s)`}
        />
        <StatTile
          label="Materiais Pub."
          value={stats.matPub}
          hint={`${stats.matDrafts} em fluxo / ${stats.matArch} arq.`}
        />
        <StatTile
          label="Questões Autorais"
          value={stats.qPub}
          hint={`${stats.qDrafts} em revisão`}
        />
        <StatTile
          label="Armazenamento"
          value={formatBytes(stats.storageBytes)}
          hint={`${stats.storageObjects} objeto(s)`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Assistente Estratégico Administrativo (IA)"
          subtitle="Baseado exclusivamente nas métricas reais atuais da plataforma"
          rightSlot={<Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
        >
          <div className="space-y-3">
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Pergunte sobre prioridades editoriais, lacunas de conteúdo, turmas ou armazenamento..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleAskAdminAssistant()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0B3321] px-4 text-xs font-semibold text-white hover:bg-[#146C43] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? 'Analisando dados reais...' : 'Consultar Assistente IA'}
            </button>
            {aiReply && (
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {aiReply}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Ciclo Editorial & Exportação de Backup"
          subtitle="Fluxo de 5 estados e geração de snapshot institucional"
          rightSlot={
            canManageUsers ? (
              <button
                type="button"
                onClick={() => void handleExportJsonBackup()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                Backup JSON
              </button>
            ) : (
              <FileJson className="h-5 w-5 text-slate-400" />
            )
          }
        >
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <Edit3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Rascunho → Em Revisão → Aprovado
                </p>
                <p>Professores e Editores preparam materiais, questões e aulas antes de liberar para alunos.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">Pré-visualização & Book Reader</p>
                <p>Confira PDFs digitalizados, camada de texto, players de vídeo e avisos antes da publicação.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <Send className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">Publicado → Arquivado</p>
                <p>Somente itens Publicados aparecem aos estudantes. Arquivar oculta mantendo todo histórico.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Audit Trail (Principal Admin only) */}
      {canManageUsers ? (
        <SectionCard
          title="Trilha de Auditoria Imutável"
          subtitle={`${auditLogs.length} evento(s) registrado(s)`}
          rightSlot={
            <input
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filtrar ação, ator ou coleção..."
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          }
        >
          {filteredLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum evento de auditoria encontrado.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filteredLogs.slice(0, 60).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-1 rounded-lg border border-slate-200 p-2.5 text-xs sm:flex-row sm:items-center dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {log.action}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        · {log.targetCollection}
                      </span>
                    </div>
                    <p className="truncate text-slate-700 dark:text-slate-300">{log.summary}</p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <p>{log.actorEmail || log.actorId}</p>
                    <p>{formatRoleLabel(log.actorRole)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Auditoria & Exportação"
          subtitle="Acesso reservado ao Administrador Principal"
        >
          <div className="flex items-center gap-2 py-4 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="h-4 w-4" />
            <span>Trilha de auditoria e backup completo são exclusivos do Administrador Principal.</span>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
