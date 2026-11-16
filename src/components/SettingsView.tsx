import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  GraduationCap,
  Heart,
  Layers,
  LogIn,
  LogOut,
  Palette,
  Play,
  RefreshCw,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { DEFAULT_STUDENT_PREFERENCES, useAuth } from '../contexts/AuthContext';
import { MEDIO_CARGOS } from '../data/alepaMedioSyllabus';
import { CONCURSO_PROFILE } from '../data/alepaSyllabus';
import {
  CampusLevel,
  MediaPlaybackPreference,
  MedioCargoGroup,
  NavSection,
  SpacedRepetitionConfig,
  StudentPreferences,
} from '../types';
import {
  SPACED_REPETITION_PRESETS,
  loadSpacedRepetitionConfig,
  saveSpacedRepetitionConfig,
} from '../utils/mediaUrls';
import { PWAInstallButton } from './PWAInstallButton';
import { ShareAppButton } from './ShareAppModal';
import { PageHeader, SectionCard } from './ui/CampusPrimitives';

const DASHBOARD_CARD_LABELS: Record<string, string> = {
  hero: 'Cartão principal do Campus & Meta de hoje',
  continue_reading: 'Continuar leitura (último PDF no Book Reader)',
  study_today: 'Blocos de estudo de hoje (2h/dia)',
  classroom_feed: 'Turmas, aulas & atividades recentes',
  notices: 'Avisos & Comunicados oficiais',
  quick_actions: 'Atalhos rápidos & navegação',
  disciplines_overview: 'Gráfico de progressão & Metas semanais',
};

export function SettingsView({
  campus,
  onChangeCampus,
  medioCargoGroup = 'cargo_01_04',
  onChangeMedioCargoGroup,
  onNavigate,
}: {
  campus: CampusLevel;
  onChangeCampus: (campus: CampusLevel) => void;
  medioCargoGroup?: MedioCargoGroup;
  onChangeMedioCargoGroup?: (group: MedioCargoGroup) => void;
  onNavigate: (section: NavSection) => void;
}) {
  const {
    user,
    isGuest,
    profile,
    preferences,
    updateStudentPreferences,
    updateProfileSettings,
    logout,
    exitGuestMode,
  } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(
    profile?.dailyGoalMinutes || CONCURSO_PROFILE.dailyGoalMinutes
  );
  const [examDate, setExamDate] = useState(profile?.examDate || CONCURSO_PROFILE.examDate);
  const [targetCargo, setTargetCargo] = useState(
    profile?.targetCargo || 'Cargo 03 – Técnico Legislativo (PL.AL.102)'
  );
  const [spacedConfig, setSpacedConfig] = useState<SpacedRepetitionConfig>(() =>
    loadSpacedRepetitionConfig()
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setDailyGoalMinutes(profile.dailyGoalMinutes || CONCURSO_PROFILE.dailyGoalMinutes);
    setExamDate(profile.examDate || CONCURSO_PROFILE.examDate);
    setTargetCargo(profile.targetCargo || 'Cargo 03 – Técnico Legislativo (PL.AL.102)');
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await updateProfileSettings({
        displayName: displayName.trim() || profile?.displayName || 'Estudante ALEPA',
        dailyGoalMinutes: Math.max(15, Math.min(720, Math.round(dailyGoalMinutes))),
        examDate: examDate.trim() || CONCURSO_PROFILE.examDate,
        targetCargo: targetCargo.trim() || 'Cargo 03 – Técnico Legislativo (PL.AL.102)',
      });
      setFeedback('Configurações do perfil e meta diária salvas com sucesso.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao atualizar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCampusProfile = (nextCampus: CampusLevel) => {
    onChangeCampus(nextCampus);
    void handleUpdateVisualPref(
      { preferredCampus: nextCampus },
      `Perfil acadêmico atualizado para ${nextCampus === 'medio' ? 'Nível Médio (001/2026)' : 'Nível Superior (002/2026)'}. Todo o seu histórico anterior foi preservado.`
    );
  };

  const handleSelectMedioCargoProfile = (group: MedioCargoGroup) => {
    onChangeMedioCargoGroup?.(group);
    const cargoInfo = MEDIO_CARGOS.find((c) => c.group === group);
    void handleUpdateVisualPref(
      { preferredCampus: 'medio', preferredMedioCargo: group },
      `Cargo do Nível Médio atualizado para ${cargoInfo ? `${cargoInfo.cargoNumber} (${cargoInfo.code})` : group}. Histórico geral preservado.`
    );
  };

  const handleChangeSpacedPreset = (preset: SpacedRepetitionConfig['preset']) => {
    const next: SpacedRepetitionConfig = {
      preset,
      intervals: SPACED_REPETITION_PRESETS[preset].intervals,
    };
    setSpacedConfig(next);
    saveSpacedRepetitionConfig(next);
    setFeedback(`Ciclo de revisão espaçada alterado para: ${SPACED_REPETITION_PRESETS[preset].label}.`);
  };

  const handleUpdateVisualPref = async (patch: Partial<StudentPreferences>, msg?: string) => {
    setErrorMsg(null);
    try {
      await updateStudentPreferences(patch);
      if (msg) setFeedback(msg);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar preferência visual.');
    }
  };

  const orderedCards =
    preferences.dashboardCardOrder.length > 0
      ? preferences.dashboardCardOrder
      : DEFAULT_STUDENT_PREFERENCES.dashboardCardOrder;

  const moveCardOrder = (cardId: string, direction: -1 | 1) => {
    const idx = orderedCards.indexOf(cardId);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= orderedCards.length) return;
    const copy = [...orderedCards];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    void handleUpdateVisualPref({ dashboardCardOrder: copy });
  };

  const toggleCardVisibility = (cardId: string) => {
    const hidden = preferences.hiddenDashboardCards || [];
    const next = hidden.includes(cardId) ? hidden.filter((id) => id !== cardId) : [...hidden, cardId];
    void handleUpdateVisualPref({ hiddenDashboardCards: next });
  };

  const handleHideAllCards = () => {
    void handleUpdateVisualPref({ hiddenDashboardCards: [...orderedCards] });
  };

  const handleShowAllCards = () => {
    void handleUpdateVisualPref({ hiddenDashboardCards: [] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Meu Perfil Acadêmico & Preferências"
        title="Configurações & Personalização"
        subtitle="Defina seu nível acadêmico, cargo do edital, player mobile, aparência, meta diária e sincronização entre dispositivos sem apagar seu histórico."
      />

      {feedback && (
        <div className="bg-[#E8F3EC] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium inline-flex items-center gap-2 w-full">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Meu Perfil Acadêmico + Preferência de Player Mobile */}
      <SectionCard
        title="Meu Perfil Acadêmico (Nível e Cargo do Edital)"
        subtitle="A alteração do nível ou cargo adapta os conteúdos sem apagar suas sessões, simulados ou histórico anterior"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelectCampusProfile('superior')}
              className={`min-h-[56px] p-4 rounded-xl border text-left transition-colors flex items-start gap-3 ${
                campus === 'superior'
                  ? 'bg-[#0B3321] text-white border-[#0B3321]'
                  : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
              }`}
            >
              <GraduationCap
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  campus === 'superior' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'
                }`}
              />
              <div>
                <p className="text-sm font-bold">Nível Superior · Edital 002/2026</p>
                <p
                  className={`text-xs mt-0.5 ${
                    campus === 'superior' ? 'text-emerald-100/85' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Cargo 03 – Analista Legislativo / Administração (PL.AL.102)
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCampusProfile('medio')}
              className={`min-h-[56px] p-4 rounded-xl border text-left transition-colors flex items-start gap-3 ${
                campus === 'medio'
                  ? 'bg-[#0B3321] text-white border-[#0B3321]'
                  : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
              }`}
            >
              <Layers
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  campus === 'medio' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'
                }`}
              />
              <div>
                <p className="text-sm font-bold">Nível Médio · Edital 001/2026</p>
                <p
                  className={`text-xs mt-0.5 ${
                    campus === 'medio' ? 'text-emerald-100/85' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Auxiliar Técnico Legislativo (Cargos 01 a 04 · PL.AL.060)
                </p>
              </div>
            </button>
          </div>

          {campus === 'medio' && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cargo específico do Nível Médio (Edital 001/2026):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {MEDIO_CARGOS.map((cargo) => {
                  const selected = medioCargoGroup === cargo.group;
                  return (
                    <button
                      key={cargo.code}
                      type="button"
                      onClick={() => handleSelectMedioCargoProfile(cargo.group)}
                      className={`min-h-[48px] p-3 rounded-xl border text-left text-xs transition-colors ${
                        selected
                          ? 'bg-[#E8F3EC] dark:bg-emerald-950/50 border-[#146C43] text-[#0B3321] dark:text-emerald-200 font-bold'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="font-mono text-[11px] font-bold">
                        {cargo.cargoNumber} · {cargo.code}
                      </p>
                      <p className="truncate mt-0.5">{cargo.shortTitle.replace(/^Cargo \d+ · /, '')}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Media playback preference */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
              <span>Reprodução de Vídeos e Podcasts no Celular</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: 'ask', label: 'Perguntar sempre', desc: 'Escolher ao abrir cada conteúdo' },
                  { id: 'internal', label: 'Preferir player interno', desc: 'Abrir direto no Concurso -ALEPA 2026' },
                  { id: 'external', label: 'Preferir aplicativo externo', desc: 'Encaminhar para YouTube/Spotify' },
                ] as Array<{ id: MediaPlaybackPreference; label: string; desc: string }>
              ).map((opt) => {
                const active = (preferences.mediaPlaybackPreference || 'ask') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      void handleUpdateVisualPref(
                        { mediaPlaybackPreference: opt.id },
                        `Preferência de reprodução definida para: ${opt.label}.`
                      )
                    }
                    className={`min-h-[48px] p-3 rounded-xl border text-left transition-colors ${
                      active
                        ? 'bg-[#0B3321] text-white border-[#0B3321]'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className={`text-[11px] mt-0.5 ${active ? 'text-emerald-100/80' : 'text-slate-500 dark:text-slate-400'}`}>
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
            <ShareAppButton variant="card" />
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <PWAInstallButton variant="auth" />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Personalização Visual & Painel */}
      <SectionCard
        title="Personalização Visual & Painel Inicial"
        subtitle="Suas escolhas são aplicadas imediatamente e sincronizadas com sua conta"
        rightSlot={
          <button
            type="button"
            onClick={() =>
              void handleUpdateVisualPref(
                {
                  theme: DEFAULT_STUDENT_PREFERENCES.theme,
                  accentColor: DEFAULT_STUDENT_PREFERENCES.accentColor,
                  fontScale: DEFAULT_STUDENT_PREFERENCES.fontScale,
                  density: DEFAULT_STUDENT_PREFERENCES.density,
                  hiddenDashboardCards: [],
                  dashboardCardOrder: DEFAULT_STUDENT_PREFERENCES.dashboardCardOrder,
                },
                'Aparência restaurada para o padrão oficial ALEPA.'
              )
            }
            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
          >
            Restaurar padrão
          </button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                <span>Tema da interface</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'light', label: 'Claro' },
                    { id: 'dark', label: 'Escuro' },
                    { id: 'auto', label: 'Automático' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void handleUpdateVisualPref({ theme: t.id }, `Tema alterado para ${t.label}.`)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      preferences.theme === t.id
                        ? 'bg-[#0B3321] text-white border-[#0B3321]'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Cor de destaque</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'emerald', label: 'Verde ALEPA' },
                    { id: 'indigo', label: 'Índigo' },
                    { id: 'amber', label: 'Âmbar' },
                    { id: 'teal', label: 'Turquesa' },
                  ] as const
                ).map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => void handleUpdateVisualPref({ accentColor: acc.id })}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      preferences.accentColor === acc.id
                        ? 'bg-[#0B3321] text-white border-[#0B3321]'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tamanho da fonte</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'sm', label: 'Compacta' },
                      { id: 'md', label: 'Padrão' },
                      { id: 'lg', label: 'Ampliada' },
                    ] as const
                  ).map((fs) => (
                    <button
                      key={fs.id}
                      type="button"
                      onClick={() => void handleUpdateVisualPref({ fontScale: fs.id })}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-semibold ${
                        preferences.fontScale === fs.id
                          ? 'bg-[#0B3321] text-white border-[#0B3321]'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {fs.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Densidade dos cartões</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'comfortable', label: 'Confortável' },
                      { id: 'compact', label: 'Compacto' },
                    ] as const
                  ).map((dn) => (
                    <button
                      key={dn.id}
                      type="button"
                      onClick={() => void handleUpdateVisualPref({ density: dn.id })}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-semibold ${
                        preferences.density === dn.id
                          ? 'bg-[#0B3321] text-white border-[#0B3321]'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {dn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <Heart className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
                <span className="font-mono tabular-nums">
                  Favoritos salvos: {preferences.favoriteMaterialIds.length} materiais ·{' '}
                  {preferences.favoriteQuestionIds.length} questões · {preferences.favoriteTopicIds.length} tópicos
                </span>
              </div>
            </div>
          </div>

          {/* Dashboard Cards Ordering & Visibility */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ordem e visibilidade dos blocos do Painel Inicial
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleShowAllCards}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Mostrar todos
                </button>
                <button
                  type="button"
                  onClick={handleHideAllCards}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Ocultar todos
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {orderedCards.map((cardId, idx) => {
                const isHidden = (preferences.hiddenDashboardCards || []).includes(cardId);
                return (
                  <div
                    key={cardId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span
                      className={`text-xs font-medium truncate ${
                        isHidden ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {DASHBOARD_CARD_LABELS[cardId] || cardId}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCardOrder(cardId, -1)}
                        aria-label="Mover bloco para cima"
                        className="min-w-[40px] min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedCards.length - 1}
                        onClick={() => moveCardOrder(cardId, 1)}
                        aria-label="Mover bloco para baixo"
                        className="min-w-[40px] min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCardVisibility(cardId)}
                        aria-label={isHidden ? 'Mostrar bloco' : 'Ocultar bloco'}
                        className={`min-w-[40px] min-h-[40px] rounded-lg border flex items-center justify-center transition-colors ${
                          isHidden
                            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            : 'border-emerald-200 dark:border-emerald-800 bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300'
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Perfil de Estudo & Meta Diária"
          subtitle="Dados sincronizados na nuvem quando conectado ao Google/E-mail"
        >
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="cfg-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome de exibição
              </label>
              <input
                id="cfg-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-goal" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Meta diária (minutos)
                </label>
                <input
                  id="cfg-goal"
                  type="number"
                  min={15}
                  max={720}
                  value={dailyGoalMinutes}
                  onChange={(e) => setDailyGoalMinutes(Number(e.target.value) || 120)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>

              <div>
                <label htmlFor="cfg-exam" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data prevista da prova
                </label>
                <input
                  id="cfg-exam"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cfg-cargo" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cargo alvo
              </label>
              <input
                id="cfg-cargo"
                type="text"
                value={targetCargo}
                onChange={(e) => setTargetCargo(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Campus ativo padrão
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeCampus('superior')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold ${
                    campus === 'superior'
                      ? 'bg-[#0B3321] text-white border-[#0B3321]'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Nível Superior (002/2026)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeCampus('medio')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold ${
                    campus === 'medio'
                      ? 'bg-[#0B3321] text-white border-[#0B3321]'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Nível Médio (001/2026)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2.5 bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-50 text-white text-sm font-semibold rounded-xl w-full sm:w-auto"
            >
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Ciclos de Revisão Espaçada"
            subtitle="Configure os intervalos padrão sugeridos no Caderno de Erros"
          >
            <div className="space-y-2.5">
              {(Object.keys(SPACED_REPETITION_PRESETS) as Array<SpacedRepetitionConfig['preset']>).map((key) => {
                const preset = SPACED_REPETITION_PRESETS[key];
                const active = spacedConfig.preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChangeSpacedPreset(key)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                      active
                        ? 'border-[#146C43] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-bold">{preset.label}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{preset.description}</p>
                    </div>
                    <RefreshCw
                      className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-[#146C43] dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}
                    />
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Conta, Sincronização e Alertas"
            subtitle="Acesse de qualquer celular ou computador sem perder o histórico"
          >
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isGuest && !user ? (
                    <Smartphone className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
                  ) : (
                    <Cloud className="w-5 h-5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {isGuest && !user
                        ? `${profile?.displayName || 'Visitante'} · Modo Visitante (Local)`
                        : profile?.displayName || user?.email}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 truncate">
                      {isGuest && !user
                        ? 'Salvo neste dispositivo. Entre para sincronizar na nuvem.'
                        : `Sincronização Firebase ativa · ${user?.email || ''}`}
                    </p>
                  </div>
                </div>
                {isGuest && !user ? (
                  <button
                    type="button"
                    onClick={exitGuestMode}
                    className="min-h-[40px] px-3.5 py-2 bg-[#0B3321] text-white font-semibold rounded-xl inline-flex items-center gap-1.5 shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Fazer Login</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="min-h-[40px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl inline-flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('schedule')}
                  className="min-h-[40px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] rounded-xl font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                  <span>Alertas de Estudo (WhatsApp / E-mail)</span>
                </button>
                {!(isGuest && !user) && (
                  <button
                    type="button"
                    onClick={() => onNavigate('family')}
                    className="min-h-[40px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] rounded-xl font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                    <span>Acesso Familiar e Compartilhado</span>
                  </button>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
