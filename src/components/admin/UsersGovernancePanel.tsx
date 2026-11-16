import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Laptop,
  Lock,
  Plus,
  ShieldAlert,
  Smartphone,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  MedioCargoGroup,
  NormalizedUserRole,
  UserProfile,
  formatRoleLabel,
  normalizeUserRole,
} from '../../types';
import { SectionCard } from '../ui/CampusPrimitives';

interface UsersGovernancePanelProps {
  medioCargoGroup: MedioCargoGroup;
  onNotifyOk: (msg: string) => void;
  onNotifyErr: (err: unknown, fallback: string) => void;
}

export function UsersGovernancePanel({
  medioCargoGroup,
  onNotifyOk,
  onNotifyErr,
}: UsersGovernancePanelProps) {
  const {
    user,
    canManageUsers,
    allUsers,
    accessSessions,
    familyMembers,
    allManagedClasses,
    getCampusDisciplines,
    updateUserRole,
    toggleUserActive,
    updateUserAssignments,
    inviteFamilyMember,
    toggleFamilyMemberPublish,
    toggleFamilyMemberActive,
    removeFamilyMember,
    writeAuditLog,
  } = useAuth();

  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | NormalizedUserRole>('all');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [draftClassIds, setDraftClassIds] = useState<string[]>([]);
  const [draftDiscIds, setDraftDiscIds] = useState<string[]>([]);

  // Family access quick form
  const [famName, setFamName] = useState('');
  const [famEmail, setFamEmail] = useState('');
  const [famRel, setFamRel] = useState('Familiar');
  const [famPublish, setFamPublish] = useState(false);

  const allDisciplines = useMemo(() => {
    const sup = getCampusDisciplines('superior');
    const med = getCampusDisciplines('medio', medioCargoGroup);
    const map = new Map<string, string>();
    sup.forEach((d) => map.set(d.id, `${d.name} (Sup.)`));
    med.forEach((d) => map.set(d.id, `${d.name} (Méd.)`));
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [getCampusDisciplines, medioCargoGroup]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      const r = normalizeUserRole(u.role);
      if (roleFilter !== 'all' && r !== roleFilter) return false;
      if (!term) return true;
      return (
        u.displayName.toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        u.uid.toLowerCase().includes(term)
      );
    });
  }, [allUsers, roleFilter, userSearch]);

  if (!canManageUsers) {
    return (
      <SectionCard
        title="Governança de Usuários Restrita"
        subtitle="Apenas o Administrador Principal gerencia contas, perfis e permissões"
      >
        <div className="flex items-center gap-3 py-6 text-xs text-slate-600 dark:text-slate-300">
          <Lock className="h-5 w-5 text-slate-400" />
          <span>Contas Editor/Professor não possuem acesso à alteração de perfis ou sessões de outros usuários.</span>
        </div>
      </SectionCard>
    );
  }

  const openAssignmentsEditor = (u: UserProfile) => {
    if (editingUid === u.uid) {
      setEditingUid(null);
      return;
    }
    setEditingUid(u.uid);
    setDraftClassIds(Array.isArray(u.assignedClassIds) ? u.assignedClassIds : []);
    setDraftDiscIds(Array.isArray(u.assignedDisciplineIds) ? u.assignedDisciplineIds : []);
  };

  const handleSaveAssignments = async (target: UserProfile) => {
    try {
      await updateUserAssignments(target.uid, {
        assignedClassIds: draftClassIds,
        assignedDisciplineIds: draftDiscIds,
      });
      await writeAuditLog({
        action: 'update_user_assignments',
        targetCollection: 'users',
        targetId: target.uid,
        summary: `Vínculos de ${target.displayName} atualizados (${draftClassIds.length} turma(s), ${draftDiscIds.length} disc.)`,
      });
      setEditingUid(null);
      onNotifyOk(`Turmas e disciplinas de ${target.displayName} atualizadas.`);
    } catch (err) {
      onNotifyErr(err, 'Erro ao atualizar vínculos do usuário.');
    }
  };

  const handleInviteFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!famName.trim() || !famEmail.trim()) {
      onNotifyErr(null, 'Preencha nome e e-mail do familiar.');
      return;
    }
    try {
      await inviteFamilyMember({
        name: famName.trim(),
        email: famEmail.trim(),
        relationship: famRel.trim() || 'Familiar',
        canPublish: famPublish,
      });
      setFamName('');
      setFamEmail('');
      onNotifyOk('Acesso familiar registrado.');
    } catch (err) {
      onNotifyErr(err, 'Erro ao cadastrar familiar.');
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Gestão de Usuários, Papéis e Vínculos (RBAC)"
        subtitle="Administre Estudantes, Professores, Editores de Conteúdo e Administradores Principais"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | NormalizedUserRole)}
              className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">Todos perfis</option>
              <option value="student">Estudante</option>
              <option value="teacher">Professor</option>
              <option value="editor">Adm. Conteúdo (Editor)</option>
              <option value="admin">Adm. Principal</option>
              <option value="dev">Desenvolvedor</option>
            </select>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar nome ou e-mail..."
              className="min-h-[38px] w-52 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        }
      >
        {filteredUsers.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const currentNormalized = normalizeUserRole(u.role);
              const isSelf = u.uid === user?.uid;
              const isActive = u.active !== false;
              const isEditingThis = editingUid === u.uid;

              return (
                <div
                  key={u.uid}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {u.displayName}
                        </span>
                        {isSelf && (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Você
                          </span>
                        )}
                        {!isActive && (
                          <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                            Suspenso
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {u.email || u.uid} · Meta {u.dailyGoalMinutes} min/dia ·{' '}
                        {(u.assignedClassIds || []).length} turma(s) ·{' '}
                        {(u.assignedDisciplineIds || []).length} disc.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={currentNormalized}
                        disabled={isSelf}
                        onChange={(e) => {
                          const next = e.target.value as NormalizedUserRole;
                          void updateUserRole(u.uid, next)
                            .then(async () => {
                              await writeAuditLog({
                                action: 'change_user_role',
                                targetCollection: 'users',
                                targetId: u.uid,
                                summary: `Perfil de ${u.displayName} alterado para ${formatRoleLabel(next)}`,
                              });
                              onNotifyOk(
                                `Perfil de ${u.displayName} atualizado para ${formatRoleLabel(next)}.`
                              );
                            })
                            .catch((err) => onNotifyErr(err, 'Falha ao atualizar perfil.'));
                        }}
                        className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="student">Estudante</option>
                        <option value="teacher">Professor</option>
                        <option value="editor">Adm. Conteúdo (Editor)</option>
                        <option value="admin">Adm. Principal</option>
                        <option value="dev">Desenvolvedor</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => openAssignmentsEditor(u)}
                        className="min-h-[38px] rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        Turmas / Disc.
                      </button>

                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => {
                          void toggleUserActive(u.uid, !isActive)
                            .then(async () => {
                              await writeAuditLog({
                                action: isActive ? 'suspend_user' : 'reactivate_user',
                                targetCollection: 'users',
                                targetId: u.uid,
                                summary: `${u.displayName} ${isActive ? 'suspenso' : 'reativado'}`,
                              });
                              onNotifyOk(
                                `Conta de ${u.displayName} ${isActive ? 'suspensa' : 'reativada'}.`
                              );
                            })
                            .catch((err) => onNotifyErr(err, 'Falha ao alterar status da conta.'));
                        }}
                        className={`inline-flex min-h-[38px] items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-50 ${
                          isActive
                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {isActive ? 'Suspender' : 'Reativar'}
                      </button>
                    </div>
                  </div>

                  {isEditingThis && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">
                            Turmas vinculadas ({draftClassIds.length})
                          </p>
                          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                            {allManagedClasses.length === 0 ? (
                              <span className="text-slate-400">Nenhuma turma criada ainda.</span>
                            ) : (
                              allManagedClasses.map((cls) => (
                                <label key={cls.id} className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={draftClassIds.includes(cls.id)}
                                    onChange={(e) =>
                                      setDraftClassIds((prev) =>
                                        e.target.checked
                                          ? [...prev, cls.id]
                                          : prev.filter((id) => id !== cls.id)
                                      )
                                    }
                                  />
                                  <span className="truncate text-slate-700 dark:text-slate-300">
                                    {cls.name} ({cls.code})
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">
                            Disciplinas vinculadas ({draftDiscIds.length})
                          </p>
                          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                            {allDisciplines.map((d) => (
                              <label key={d.id} className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={draftDiscIds.includes(d.id)}
                                  onChange={(e) =>
                                    setDraftDiscIds((prev) =>
                                      e.target.checked
                                        ? [...prev, d.id]
                                        : prev.filter((id) => id !== d.id)
                                    )
                                  }
                                />
                                <span className="truncate text-slate-700 dark:text-slate-300">
                                  {d.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveAssignments(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#0B3321] px-3 font-semibold text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Salvar Vínculos
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUid(null)}
                          className="min-h-[36px] px-3 text-slate-500"
                        >
                          Fechar
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

      {/* Dispositivos e Acessos Familiares */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Sessões & Dispositivos Conectados"
          subtitle={`${accessSessions.filter((s) => s.isOnline).length} online agora`}
          rightSlot={<Users className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />}
        >
          {accessSessions.length === 0 ? (
            <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
              Nenhuma sessão registrada.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {accessSessions.slice(0, 20).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {s.deviceType === 'mobile' ? (
                      <Smartphone className="h-4 w-4 shrink-0 text-emerald-700" />
                    ) : (
                      <Laptop className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {s.displayName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {s.accessType} · {s.activeCampus === 'medio' ? 'Médio' : 'Superior'} · aba{' '}
                        {s.currentTab}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                      s.isOnline
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {s.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Acessos Familiares & Convidados"
          subtitle={`${familyMembers.length} vínculo(s) cadastrado(s)`}
          rightSlot={<ShieldAlert className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />}
        >
          <form onSubmit={(e) => void handleInviteFamily(e)} className="mb-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={famName}
                onChange={(e) => setFamName(e.target.value)}
                placeholder="Nome completo"
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                value={famEmail}
                onChange={(e) => setFamEmail(e.target.value)}
                placeholder="E-mail Google"
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                value={famRel}
                onChange={(e) => setFamRel(e.target.value)}
                placeholder="Vínculo"
                className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={famPublish}
                  onChange={(e) => setFamPublish(e.target.checked)}
                />
                Permitir compartilhar materiais na biblioteca
              </label>
              <button
                type="submit"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#0B3321] px-3 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Convidar
              </button>
            </div>
          </form>

          <div className="max-h-56 space-y-2 overflow-y-auto">
            {familyMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {m.name} ({m.relationship})
                  </p>
                  <p className="truncate text-slate-500 dark:text-slate-400">{m.email}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleFamilyMemberPublish(m.id, !m.canPublish)}
                    className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {m.canPublish ? 'Publica: Sim' : 'Publica: Não'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFamilyMemberActive(m.id, !m.active)}
                    className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {m.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeFamilyMember(m.id)}
                    className="min-h-[32px] rounded border border-rose-200 px-2 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
