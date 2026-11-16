import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Compass,
  FileText,
  GraduationCap,
  Home,
  Layers,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthView } from './components/AuthView';
import type { GeminiTargetPreset } from './components/GeminiSummaryView';
import { NotificationsCenter } from './components/NotificationsCenter';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ShareAppButton } from './components/ShareAppModal';
import { CONCURSO_PROFILE, formatDateKey } from './data/alepaSyllabus';
import { useStudyAlert } from './hooks/useStudyAlert';
import { CampusLevel, LibraryScope, MedioCargoGroup, NavSection, formatRoleLabel } from './types';

// Route-level code splitting for faster initial mobile load
const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const PreparationView = lazy(() =>
  import('./components/PreparationView').then((m) => ({ default: m.PreparationView }))
);
const DisciplinesView = lazy(() =>
  import('./components/DisciplinesView').then((m) => ({ default: m.DisciplinesView }))
);
const StudyRoomView = lazy(() =>
  import('./components/StudyRoomView').then((m) => ({ default: m.StudyRoomView }))
);
const ScheduleView = lazy(() =>
  import('./components/ScheduleView').then((m) => ({ default: m.ScheduleView }))
);
const SimuladosView = lazy(() =>
  import('./components/SimuladosView').then((m) => ({ default: m.SimuladosView }))
);
const ErrorNotebookView = lazy(() =>
  import('./components/ErrorNotebookView').then((m) => ({ default: m.ErrorNotebookView }))
);
const MediaHubView = lazy(() =>
  import('./components/MediaHubView').then((m) => ({ default: m.MediaHubView }))
);
const GeminiSummaryView = lazy(() =>
  import('./components/GeminiSummaryView').then((m) => ({ default: m.GeminiSummaryView }))
);
const MaterialsView = lazy(() =>
  import('./components/MaterialsView').then((m) => ({ default: m.MaterialsView }))
);
const PerformanceView = lazy(() =>
  import('./components/PerformanceView').then((m) => ({ default: m.PerformanceView }))
);
const FamilyAccessView = lazy(() =>
  import('./components/FamilyAccessView').then((m) => ({ default: m.FamilyAccessView }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const StudentClassroomView = lazy(() =>
  import('./components/StudentClassroomView').then((m) => ({ default: m.StudentClassroomView }))
);
const TeacherConsoleView = lazy(() =>
  import('./components/TeacherConsoleView').then((m) => ({ default: m.TeacherConsoleView }))
);
const AdminConsoleView = lazy(() =>
  import('./components/AdminConsoleView').then((m) => ({ default: m.AdminConsoleView }))
);
const PortugueseRepositoryView = lazy(() =>
  import('./components/PortugueseRepositoryView').then((m) => ({ default: m.PortugueseRepositoryView }))
);
const RequestsCenterView = lazy(() =>
  import('./components/RequestsCenterView').then((m) => ({ default: m.RequestsCenterView }))
);

function RouteLoadingFallback() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 min-h-[240px]">
      <Loader2 className="w-6 h-6 animate-spin text-[#146C43] dark:text-emerald-400" />
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Carregando módulo de estudo...</p>
    </div>
  );
}

interface SidebarNavGroup {
  groupLabel: string;
  items: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    groupLabel: 'Ambiente do Estudante',
    items: [
      { id: 'dashboard', label: 'Início', icon: Home },
      { id: 'disciplines', label: 'Conteúdo', icon: BookOpen },
      { id: 'simulados', label: 'Questões', icon: CheckSquare },
      { id: 'videos', label: 'Vídeos e Podcasts', icon: Video },
    ],
  },
  {
    groupLabel: 'Centrais & Apoio',
    items: [
      { id: 'materials', label: 'Central de Materiais', icon: FileText },
      { id: 'portuguese_repo', label: 'Português (Prof. Fabrício)', icon: BookMarked },
      { id: 'classroom', label: 'Minhas Turmas & Aulas', icon: GraduationCap },
      { id: 'preparation', label: 'Minha Preparação', icon: Compass },
      { id: 'schedule', label: 'Cronograma 2h', icon: CalendarDays },
      { id: 'revisions', label: 'Revisões & Erros', icon: RotateCcw },
      { id: 'gemini', label: 'Professor IA', icon: Sparkles },
      { id: 'requests', label: 'Solicitações', icon: MessageSquare },
    ],
  },
  {
    groupLabel: 'Desempenho & Conta',
    items: [
      { id: 'performance', label: 'Desempenho', icon: BarChart3 },
      { id: 'family', label: 'Familiares', icon: Users },
      { id: 'settings', label: 'Configurações', icon: Settings },
    ],
  },
];

const GUEST_RESTRICTED_TABS: ReadonlySet<NavSection> = new Set(['classroom', 'requests', 'family']);

function CampusShell() {
  const {
    user,
    isGuest,
    profile,
    authLoading,
    logout,
    exitGuestMode,
    syncError,
    clearSyncError,
    studySessions,
    updateAccessPresenceContext,
    canAccessAdminPanel,
    canAccessTeacherPanel,
    effectiveRole,
    activeWorkspaceMode,
    setActiveWorkspaceMode,
    preferences,
    updateStudentPreferences,
    recordStudyNotification,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<NavSection>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('acesso') === 'familiar') {
        return 'family';
      }
    } catch {
      // ignore query param error
    }
    return 'dashboard';
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('acesso') === 'familiar' && !user && isGuest) {
        exitGuestMode();
      }
    } catch {
      // ignore
    }
  }, [user, isGuest, exitGuestMode]);

  const [selectedCampus, setSelectedCampus] = useState<CampusLevel>(() => {
    try {
      const saved = localStorage.getItem('concurso_alepa_campus');
      return saved === 'medio' || saved === 'superior' ? saved : 'superior';
    } catch {
      return 'superior';
    }
  });
  const [selectedMedioCargo, setSelectedMedioCargo] = useState<MedioCargoGroup>(() => {
    try {
      const saved = localStorage.getItem('concurso_alepa_medio_cargo');
      return saved === 'cargo_01_04' || saved === 'cargo_01' || saved === 'cargo_02' || saved === 'cargo_03'
        ? saved
        : 'cargo_01_04';
    } catch {
      return 'cargo_01_04';
    }
  });
  const [timerPreset, setTimerPreset] = useState<{ disciplineId?: string; topicTitle?: string }>({});
  const [contentInitialScope, setContentInitialScope] = useState<LibraryScope | undefined>(undefined);
  const [geminiPreset, setGeminiPreset] = useState<GeminiTargetPreset | null>(null);
  const [studyRoomTarget, setStudyRoomTarget] = useState<{ disciplineId?: string; topicId?: string }>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  // Sync preferred campus & medioCargoGroup from saved account preferences when loaded
  useEffect(() => {
    if (preferences.preferredCampus && (preferences.preferredCampus === 'medio' || preferences.preferredCampus === 'superior')) {
      setSelectedCampus(preferences.preferredCampus);
      try {
        localStorage.setItem('concurso_alepa_campus', preferences.preferredCampus);
      } catch {
        // ignore storage errors
      }
    }
  }, [preferences.preferredCampus]);

  useEffect(() => {
    if (preferences.preferredMedioCargo) {
      setSelectedMedioCargo(preferences.preferredMedioCargo);
      try {
        localStorage.setItem('concurso_alepa_medio_cargo', preferences.preferredMedioCargo);
      } catch {
        // ignore storage errors
      }
    }
  }, [preferences.preferredMedioCargo]);

  // Auto-hide header on downward scroll & reveal on upward scroll
  useEffect(() => {
    const onScroll = () => {
      if (mobileMenuOpen) {
        setHeaderHidden(false);
        return;
      }
      const currentY = window.scrollY || 0;
      const delta = currentY - lastScrollYRef.current;
      if (currentY < 48) {
        setHeaderHidden(false);
      } else if (delta > 8 && currentY > 96) {
        setHeaderHidden(true);
      } else if (delta < -8) {
        setHeaderHidden(false);
      }
      lastScrollYRef.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    updateAccessPresenceContext(activeTab, selectedCampus);
  }, [activeTab, selectedCampus, updateAccessPresenceContext]);

  const isGuestSession = isGuest && !user;

  useEffect(() => {
    if (!canAccessAdminPanel && activeTab === 'admin') {
      setActiveTab('dashboard');
      setActiveWorkspaceMode('student');
    }
    if (!canAccessTeacherPanel && activeTab === 'teacher') {
      setActiveTab('dashboard');
      setActiveWorkspaceMode('student');
    }
    if (isGuestSession && GUEST_RESTRICTED_TABS.has(activeTab)) {
      setActiveTab('dashboard');
      setActiveWorkspaceMode('student');
    }
  }, [canAccessAdminPanel, canAccessTeacherPanel, isGuestSession, activeTab, setActiveWorkspaceMode]);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = preferences.theme === 'dark' || (preferences.theme === 'auto' && prefersDark);
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
      root.dataset.accent = preferences.accentColor;
      root.dataset.fontScale = preferences.fontScale;
      root.dataset.density = preferences.density;
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isDark ? '#0B1210' : '#0B3321');
      }
    };
    applyTheme();
    if (preferences.theme === 'auto' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
    return undefined;
  }, [preferences.theme, preferences.accentColor, preferences.fontScale, preferences.density]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleChangeCampus = (campus: CampusLevel) => {
    setSelectedCampus(campus);
    setStudyRoomTarget({});
    try {
      localStorage.setItem('concurso_alepa_campus', campus);
    } catch {
      // ignore storage errors
    }
  };

  const handleChangeMedioCargo = (group: MedioCargoGroup) => {
    setSelectedMedioCargo(group);
    setStudyRoomTarget({});
    try {
      localStorage.setItem('concurso_alepa_medio_cargo', group);
    } catch {
      // ignore storage errors
    }
  };

  const todayKey = formatDateKey(new Date());
  const dailyGoal = profile?.dailyGoalMinutes || CONCURSO_PROFILE.dailyGoalMinutes;
  const minutesToday = studySessions
    .filter((s) => s.dateKey === todayKey)
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  const {
    settings: alertSettings,
    updateSettings: updateAlertSettings,
    activeAlertMessage,
    dismissAlert,
    notificationPermission,
    requestNotificationPermission,
    fireStudyAlert,
  } = useStudyAlert(minutesToday, dailyGoal, selectedCampus);

  const lastRecordedAlertRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeAlertMessage && activeAlertMessage !== lastRecordedAlertRef.current) {
      lastRecordedAlertRef.current = activeAlertMessage;
      void recordStudyNotification(activeAlertMessage);
    }
  }, [activeAlertMessage, recordStudyNotification]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7F6] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-[#0B3321] dark:text-emerald-400 mx-auto" />
          <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Concurso -ALEPA 2026</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando área de estudos...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <AuthView />;
  }

  const primaryMobileTabs: Array<{
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'disciplines', label: 'Conteúdo', icon: BookOpen },
    { id: 'simulados', label: 'Questões', icon: CheckSquare },
    { id: 'videos', label: 'Vídeos', icon: Video },
  ];

  const isMoreTabActive =
    activeTab !== 'dashboard' &&
    activeTab !== 'disciplines' &&
    activeTab !== 'simulados' &&
    activeTab !== 'videos' &&
    activeTab !== 'podcasts';

  const mobileSheetGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: NavSection;
      label: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
  }> = [
    {
      groupLabel: 'Principais recursos',
      items: [
        { id: 'materials', label: 'Central de Materiais', subtitle: 'PDFs, apostilas e Drive', icon: FileText },
        { id: 'portuguese_repo', label: 'Português (Prof. Fabrício)', subtitle: 'Aulas e textos exclusivos', icon: BookMarked },
        { id: 'classroom', label: 'Minhas Turmas', subtitle: 'Aulas, atividades e notas', icon: GraduationCap },
        { id: 'schedule', label: 'Cronograma 2h', subtitle: 'Blocos diários e timer', icon: CalendarDays },
        { id: 'revisions', label: 'Revisões / Erros', subtitle: 'Caderno espaçado', icon: RotateCcw },
        { id: 'gemini', label: 'Professor IA', subtitle: 'Resumos, cards e plano', icon: Sparkles },
      ],
    },
    {
      groupLabel: 'Minha preparação',
      items: [
        { id: 'preparation', label: 'Minha Preparação', subtitle: 'Rota de estudos e edital', icon: Compass },
        { id: 'performance', label: 'Desempenho', subtitle: 'Evolução e progresso', icon: BarChart3 },
        { id: 'requests', label: 'Solicitações', subtitle: 'Pedidos ao prof. e coord.', icon: MessageSquare },
        { id: 'family', label: 'Familiares', subtitle: 'Acesso compartilhado', icon: Users },
      ],
    },
    {
      groupLabel: 'Gestão e configurações',
      items: [
        { id: 'settings', label: 'Configurações', subtitle: 'Meta, cargo e conta', icon: Settings },
      ],
    },
  ];

  const activeSectionLabel =
    activeTab === 'admin'
      ? 'Painel Administrativo'
      : activeTab === 'teacher'
        ? 'Console do Professor'
        : activeTab === 'portuguese_repo'
          ? 'Repositório de Português (Prof. Fabrício)'
          : activeTab === 'classroom'
            ? 'Minhas Turmas & Aulas'
            : activeTab === 'preparation'
              ? 'Minha Preparação'
              : activeTab === 'study_room'
                ? 'Sala de Estudo'
                : activeTab === 'disciplines'
                  ? 'Conteúdo · Disciplinas e Edital'
                  : activeTab === 'schedule'
                    ? 'Cronograma 2h'
                    : activeTab === 'simulados'
                      ? 'Questões · Banco e Simulados'
                      : activeTab === 'revisions'
                        ? 'Revisões / Erros'
                        : activeTab === 'podcasts' || activeTab === 'videos'
                          ? 'Vídeos e Podcasts'
                          : activeTab === 'gemini'
                            ? 'Professor IA & Resumos'
                            : activeTab === 'requests'
                              ? 'Solicitações Acadêmicas'
                              : activeTab === 'materials'
                                ? 'Central de Materiais'
                                : activeTab === 'performance'
                                  ? 'Desempenho'
                                  : activeTab === 'family'
                                    ? 'Familiares'
                                    : activeTab === 'settings'
                                      ? 'Configurações'
                                      : 'Início';

  const handleStartFocusTimer = (disciplineId: string, topicTitle: string) => {
    setTimerPreset({ disciplineId, topicTitle });
    navigateTo('schedule');
  };

  const navigateTo = (section: NavSection) => {
    if (section === 'admin' && !canAccessAdminPanel) {
      return;
    }
    if (section === 'teacher' && !canAccessTeacherPanel) {
      return;
    }
    if (isGuestSession && GUEST_RESTRICTED_TABS.has(section)) {
      return;
    }
    setActiveTab(section);
    setActiveWorkspaceMode(
      section === 'admin' ? 'admin' : section === 'teacher' ? 'teacher' : 'student'
    );
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenStudyRoom = (disciplineId: string, topicId: string) => {
    setStudyRoomTarget({ disciplineId, topicId });
    navigateTo('study_room');
  };

  return (
    <div className="min-h-screen bg-[#F5F7F6] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100 flex overflow-x-hidden max-w-full">
      {/* Structured Desktop Sidebar (visible at lg >= 1024px) */}
      <aside
        aria-label="Menu principal lateral"
        className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 sticky top-0 h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-16 px-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              className="text-left min-w-0"
            >
              <p className="font-display text-sm font-bold text-[#0B3321] dark:text-emerald-300 truncate">
                Concurso -ALEPA 2026
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {selectedCampus === 'medio' ? 'Nível Médio (PL.AL.060)' : 'Nível Superior (PL.AL.102)'}
              </p>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="min-w-[38px] min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mx-auto"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {(canAccessTeacherPanel || canAccessAdminPanel) && (
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Ambientes ({formatRoleLabel(effectiveRole)})
                </p>
              )}
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                title="Ambiente do Estudante"
                className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  sidebarCollapsed ? 'justify-center px-0' : ''
                } ${
                  activeWorkspaceMode === 'student'
                    ? 'bg-[#0B3321] text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Ambiente Estudante</span>}
              </button>

              {canAccessTeacherPanel && (
                <button
                  type="button"
                  onClick={() => navigateTo('teacher')}
                  title="Ambiente do Professor"
                  className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                    sidebarCollapsed ? 'justify-center px-0' : ''
                  } ${
                    activeTab === 'teacher'
                      ? 'bg-[#0B3321] text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-[#0B3321] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Ambiente Professor</span>}
                </button>
              )}

              {canAccessAdminPanel && (
                <button
                  type="button"
                  onClick={() => navigateTo('admin')}
                  title="Ambiente Administrativo / Editor"
                  className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                    sidebarCollapsed ? 'justify-center px-0' : ''
                  } ${
                    activeTab === 'admin'
                      ? 'bg-[#0B3321] text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-[#0B3321] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Ambiente Admin</span>}
                </button>
              )}
            </div>
          )}

          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.groupLabel}
                </p>
              )}
              {group.items
                .filter((item) => !(isGuestSession && GUEST_RESTRICTED_TABS.has(item.id)))
                .map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id || (item.id === 'videos' && activeTab === 'podcasts');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    title={item.label}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                      sidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      active
                        ? 'bg-[#0B3321] text-white shadow-2xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-[#E8F3EC] dark:hover:bg-slate-800 hover:text-[#0B3321] dark:hover:text-emerald-300'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Account Status */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800">
          {isGuest && !user ? (
            <div className="space-y-2">
              {!sidebarCollapsed && profile?.displayName && (
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate px-1">
                  Visitante: {profile.displayName}
                </p>
              )}
              <button
                type="button"
                onClick={exitGuestMode}
                title="Fazer Login para sincronizar na nuvem"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Fazer Login</span>}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {!sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  className="flex items-center gap-2 min-w-0 text-left hover:opacity-80"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {profile?.displayName?.split(' ')[0] || 'Estudante'}
                    </p>
                    <p className="text-[10px] text-[#146C43] dark:text-emerald-400 truncate">Nuvem ativa</p>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                aria-label="Sair da conta"
                title="Sair / Trocar conta"
                className="min-w-[36px] min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mx-auto"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Auto-hiding Slim Top Bar (Mobile: brand + campus + account/login; Desktop: breadcrumb + campus) */}
        <header
          className={`sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-transform duration-200 will-change-transform ${
            headerHidden ? '-translate-y-full focus-within:translate-y-0' : 'translate-y-0'
          }`}
        >
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              className="font-display text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate text-left flex items-center gap-2 min-h-[44px]"
            >
              <span className="lg:hidden inline-flex items-center gap-1.5">
                <span>Concurso -ALEPA 2026</span>
                <span className="text-[11px] font-mono font-semibold text-[#146C43] dark:text-emerald-400">
                  · {selectedCampus === 'medio' ? 'Médio' : 'Superior'}
                </span>
              </span>
              <span className="hidden lg:inline text-slate-500 dark:text-slate-400 font-medium text-xs">
                Concurso -ALEPA 2026 /{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">{activeSectionLabel}</strong>
              </span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {/* Campus Quick Switcher on Desktop Top Bar */}
              <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => handleChangeCampus('superior')}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedCampus === 'superior'
                      ? 'bg-[#0B3321] text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Superior · PL.AL.102
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeCampus('medio')}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedCampus === 'medio'
                      ? 'bg-[#0B3321] text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Médio · PL.AL.060
                </button>
              </div>

              <NotificationsCenter onNavigate={navigateTo} />
              <ThemeSwitcher />

              {isGuest && !user ? (
                <div className="flex items-center gap-2 shrink-0">
                  {profile?.displayName && (
                    <span className="hidden sm:inline text-xs font-medium text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                      {profile.displayName.split(' ')[0]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={exitGuestMode}
                    title="Fazer Login para sincronizar seus estudos na nuvem"
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-white bg-[#0B3321] hover:bg-[#134b32] rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>Login</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  title={`Perfil e configurações (${profile?.displayName || user?.email || 'Estudante'})`}
                  className="min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#0B3321] dark:text-emerald-200 bg-[#E8F3EC] dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0 text-[#146C43] dark:text-emerald-400" />
                  <span className="max-w-[100px] truncate">
                    {profile?.displayName?.split(' ')[0] || 'Conta'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="landscape-main-pad flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-7 pb-24 lg:pb-12 space-y-5 sm:space-y-6 min-w-0">
          {activeTab !== 'dashboard' && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 min-w-0">
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className="min-h-[38px] px-2.5 py-1 -ml-1 rounded-lg font-semibold text-[#0B3321] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="sm:hidden">Início</span>
                <span className="hidden sm:inline">Painel do Estudante</span>
              </button>
              <span aria-hidden="true" className="text-slate-400">
                /
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold truncate">{activeSectionLabel}</span>
            </div>
          )}

          {profile?.active === false && (
            <div
              role="alert"
              className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium"
            >
              Sua conta está temporariamente inativada para funções avançadas. Seus registros históricos permanecem
              preservados; contate a administração para reativação.
            </div>
          )}

          {activeAlertMessage && (
            <div
              role="status"
              className="bg-[#E8F3EC] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-[#146C43] dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Alerta de Estudos · Concurso ALEPA 2026
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{activeAlertMessage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    dismissAlert();
                    navigateTo('schedule');
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 bg-[#0B3321] text-white text-xs font-semibold rounded-xl"
                >
                  Iniciar estudos
                </button>
                <button
                  type="button"
                  onClick={dismissAlert}
                  className="min-h-[40px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl"
                >
                  Dispensar
                </button>
              </div>
            </div>
          )}

          {isGuest && !user && (
            <div
              role="status"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Modo Visitante ativo:</strong> seu progresso,
                simulados e revisões ficam salvos localmente neste navegador. Para sincronizar entre celular e
                computador, entre com sua conta Google quando quiser.
              </div>
              <button
                type="button"
                onClick={exitGuestMode}
                className="min-h-[42px] px-3.5 py-1.5 text-xs font-semibold bg-[#0B3321] hover:bg-[#134b32] text-white rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Fazer login / Nuvem</span>
              </button>
            </div>
          )}

          {syncError && (
            <div
              role="alert"
              className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
            >
              <span>{syncError}</span>
              <button type="button" onClick={clearSyncError} className="text-xs font-semibold underline shrink-0">
                Fechar
              </button>
            </div>
          )}

          <Suspense fallback={<RouteLoadingFallback />}>
            {activeTab === 'dashboard' && (
              <DashboardView
                campus={selectedCampus}
                onChangeCampus={handleChangeCampus}
                medioCargoGroup={selectedMedioCargo}
                onChangeMedioCargoGroup={handleChangeMedioCargo}
                onNavigate={navigateTo}
                onOpenContent={(scope) => {
                  setContentInitialScope(scope);
                  navigateTo('materials');
                }}
                onOpenStudyRoom={handleOpenStudyRoom}
                onStartFocusTimer={handleStartFocusTimer}
                alertSettings={alertSettings}
              />
            )}
            {activeTab === 'preparation' && (
              <PreparationView
                campus={selectedCampus}
                onChangeCampus={handleChangeCampus}
                medioCargoGroup={selectedMedioCargo}
                onChangeMedioCargoGroup={handleChangeMedioCargo}
                onNavigate={navigateTo}
                onOpenStudyRoom={handleOpenStudyRoom}
              />
            )}
            {activeTab === 'portuguese_repo' && (
              <PortugueseRepositoryView
                campus={selectedCampus}
                onNavigate={navigateTo}
                onSummarizeWithGemini={(target) => {
                  setGeminiPreset({
                    mode: target.mode === 'topic' ? 'professor' : 'pdf',
                    materialId: target.materialId,
                    url: target.url,
                    title: target.title,
                    disciplineId: target.disciplineId,
                  });
                  navigateTo('gemini');
                }}
              />
            )}
            {activeTab === 'disciplines' && (
              <DisciplinesView
                campus={selectedCampus}
                onChangeCampus={handleChangeCampus}
                medioCargoGroup={selectedMedioCargo}
                onChangeMedioCargoGroup={handleChangeMedioCargo}
                onOpenStudyRoom={handleOpenStudyRoom}
                onNavigate={navigateTo}
              />
            )}
            {activeTab === 'study_room' && (
              <StudyRoomView
                campus={selectedCampus}
                medioCargoGroup={selectedMedioCargo}
                selectedDisciplineId={studyRoomTarget.disciplineId}
                selectedTopicId={studyRoomTarget.topicId}
                onSelectTopic={(disciplineId, topicId) => setStudyRoomTarget({ disciplineId, topicId })}
                onNavigate={navigateTo}
                onStartFocusTimer={handleStartFocusTimer}
              />
            )}
            {activeTab === 'schedule' && (
              <ScheduleView
                campus={selectedCampus}
                medioCargoGroup={selectedMedioCargo}
                initialDisciplineId={timerPreset.disciplineId}
                initialTopicTitle={timerPreset.topicTitle}
                alertSettings={alertSettings}
                onUpdateAlertSettings={updateAlertSettings}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={requestNotificationPermission}
                onTestAlert={() => fireStudyAlert(undefined, true)}
              />
            )}
            {activeTab === 'simulados' && (
              <SimuladosView campus={selectedCampus} medioCargoGroup={selectedMedioCargo} />
            )}
            {activeTab === 'revisions' && <ErrorNotebookView campus={selectedCampus} />}
            {(activeTab === 'videos' || activeTab === 'podcasts') && (
              <MediaHubView
                campus={selectedCampus}
                initialTab={activeTab === 'podcasts' ? 'podcasts' : 'videos'}
                onSummarizeWithGemini={(target) => {
                  setGeminiPreset(target);
                  navigateTo('gemini');
                }}
              />
            )}
            {activeTab === 'gemini' && (
              <GeminiSummaryView
                campus={selectedCampus}
                presetTarget={geminiPreset}
                onClearPreset={() => setGeminiPreset(null)}
              />
            )}
            {activeTab === 'materials' && (
              <MaterialsView
                campus={selectedCampus}
                initialScope={contentInitialScope}
                onChangeCampus={handleChangeCampus}
                onSummarizeWithGemini={(target) => {
                  setGeminiPreset(target);
                  navigateTo('gemini');
                }}
              />
            )}
            {activeTab === 'performance' && (
              <PerformanceView campus={selectedCampus} medioCargoGroup={selectedMedioCargo} />
            )}
            {activeTab === 'family' && !isGuestSession && (
              <FamilyAccessView
                campus={selectedCampus}
                onNavigate={navigateTo}
                onOpenContent={(scope) => {
                  setContentInitialScope(scope);
                  navigateTo('materials');
                }}
              />
            )}
            {activeTab === 'classroom' && !isGuestSession && (
              <StudentClassroomView
                campus={selectedCampus}
                onSummarizeWithGemini={(target) => {
                  setGeminiPreset(target);
                  navigateTo('gemini');
                }}
              />
            )}
            {activeTab === 'requests' && !isGuestSession && (
              <RequestsCenterView campus={selectedCampus} mode="student" />
            )}
            {activeTab === 'settings' && (
              <SettingsView
                campus={selectedCampus}
                onChangeCampus={handleChangeCampus}
                medioCargoGroup={selectedMedioCargo}
                onChangeMedioCargoGroup={handleChangeMedioCargo}
                onNavigate={navigateTo}
              />
            )}
            {activeTab === 'teacher' && canAccessTeacherPanel && (
              <TeacherConsoleView
                campus={selectedCampus}
                onOpenStudentPreview={() => navigateTo('dashboard')}
              />
            )}
            {activeTab === 'admin' && canAccessAdminPanel && (
              <AdminConsoleView
                campus={selectedCampus}
                onChangeCampus={handleChangeCampus}
                medioCargoGroup={selectedMedioCargo}
                onOpenStudentPreview={(section) => navigateTo(section)}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Mobile & Tablet Portrait Slide-Up Bottom Sheet Menu */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Menu completo mobile"
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
          />

          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl px-4 pt-3 pb-6 pb-safe max-h-[88vh] overflow-y-auto space-y-4">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Navegação Completa</p>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Concurso -ALEPA 2026
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Campus Switcher inside Drawer */}
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 px-1">Campus ativo:</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChangeCampus('superior')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors flex items-center gap-2 ${
                    selectedCampus === 'superior'
                      ? 'bg-[#0B3321] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">Nível Superior</p>
                    <p
                      className={`text-[10px] font-mono ${
                        selectedCampus === 'superior' ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      PL.AL.102
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeCampus('medio')}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors flex items-center gap-2 ${
                    selectedCampus === 'medio'
                      ? 'bg-[#0B3321] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">Nível Médio</p>
                    <p
                      className={`text-[10px] font-mono ${
                        selectedCampus === 'medio' ? 'text-emerald-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      PL.AL.060
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Clean Grouped Sections in Mais Bottom Sheet */}
            <div className="space-y-4">
              {mobileSheetGroups.map((group, gIdx) => (
                <div
                  key={group.groupLabel}
                  className={gIdx > 0 ? 'pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2' : 'space-y-2'}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    {group.groupLabel}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.groupLabel === 'Gestão e configurações' && canAccessTeacherPanel && (
                      <button
                        type="button"
                        onClick={() => navigateTo('teacher')}
                        className={`min-h-[54px] p-3 rounded-2xl border text-left flex items-center gap-3 ${
                          activeTab === 'teacher'
                            ? 'border-[#0B3321] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-[#0B3321] dark:text-emerald-200'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#0B3321] text-white flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">Console do Professor</p>
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate">Turmas, aulas e notas</p>
                        </div>
                      </button>
                    )}

                    {group.groupLabel === 'Gestão e configurações' && canAccessAdminPanel && (
                      <button
                        type="button"
                        onClick={() => navigateTo('admin')}
                        className={`min-h-[54px] p-3 rounded-2xl border text-left flex items-center gap-3 ${
                          activeTab === 'admin'
                            ? 'border-[#0B3321] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-[#0B3321] dark:text-emerald-200'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#0B3321] text-white flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">Painel Admin / Editor</p>
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate">
                            {formatRoleLabel(effectiveRole)}
                          </p>
                        </div>
                      </button>
                    )}

                    {group.items
                      .filter((item) => !(isGuestSession && GUEST_RESTRICTED_TABS.has(item.id)))
                      .map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.id)}
                          className={`min-h-[54px] p-3 rounded-2xl border text-left transition-transform active:scale-[0.98] flex items-center gap-3 ${
                            active
                              ? 'border-[#0B3321] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-[#0B3321] text-white'
                                : 'bg-[#E8F3EC] dark:bg-emerald-950/50 text-[#146C43] dark:text-emerald-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{item.label}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}

                    {group.groupLabel === 'Minha preparação' && (
                      <button
                        type="button"
                        onClick={() => {
                          setContentInitialScope('geral');
                          navigateTo('materials');
                        }}
                        className="min-h-[54px] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-left flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#E8F3EC] dark:bg-emerald-950/50 text-[#146C43] dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">Aba Geral</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Matérias comuns</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {group.groupLabel === 'Gestão e configurações' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          void updateStudentPreferences({
                            theme: preferences.theme === 'dark' ? 'light' : 'dark',
                          })
                        }
                        className="min-h-[44px] w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        {preferences.theme === 'dark' ? (
                          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Moon className="w-4 h-4 text-[#146C43] shrink-0" />
                        )}
                        <span>{preferences.theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
                      </button>
                      <ShareAppButton variant="menu" />
                      <PWAInstallButton variant="menu" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Account & Login Card in Mobile Drawer */}
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#0B3321] text-white flex items-center justify-center shrink-0">
                  {isGuest && !user ? <LogIn className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-300" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {isGuest && !user
                      ? `${profile?.displayName || 'Visitante'} (Visitante)`
                      : profile?.displayName || 'Conectado'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isGuest && !user ? 'Entre para salvar na nuvem' : user?.email || 'Sincronização ativa'}
                  </p>
                </div>
              </div>

              {isGuest && !user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    exitGuestMode();
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Fazer Login</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void logout();
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-[#0B3321] text-slate-900 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                  <span>Sair / Trocar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Portrait Bottom Tab Bar (5 ergonomic tabs >= 48px, 24x24 icons) */}
      <nav
        aria-label="Navegação inferior mobile"
        className="landscape-compact-hidden lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-16 pb-safe"
      >
        {primaryMobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'videos' && activeTab === 'podcasts');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 transition-transform active:scale-95 ${
                isActive ? 'text-[#0B3321] dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-7 h-0.5 rounded-full bg-[#0B3321] dark:bg-emerald-400" />
              )}
              <Icon className="w-6 h-6" />
              <span className="text-[11px] tracking-tight mt-0.5 whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 transition-transform active:scale-95 ${
            mobileMenuOpen || isMoreTabActive
              ? 'text-[#0B3321] dark:text-emerald-300 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {(mobileMenuOpen || isMoreTabActive) && (
            <span className="absolute top-0 w-7 h-0.5 rounded-full bg-[#0B3321] dark:bg-emerald-400" />
          )}
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[11px] tracking-tight mt-0.5 whitespace-nowrap">Mais</span>
        </button>
      </nav>

      {/* Mobile Compact Landscape Left Navigation Rail (>= 48x48 touch targets, 24x24 icons) */}
      <nav
        aria-label="Navegação lateral compacta"
        className="landscape-rail fixed left-0 top-0 bottom-0 z-40 w-14 flex-col items-center justify-around py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200 dark:border-slate-800"
      >
        {primaryMobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'videos' && activeTab === 'podcasts');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              aria-label={tab.label}
              title={tab.label}
              className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-[#0B3321] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-6 h-6" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Mais recursos"
          title="Mais recursos"
          aria-expanded={mobileMenuOpen}
          className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center transition-colors ${
            mobileMenuOpen || isMoreTabActive
              ? 'bg-[#0B3321] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutGrid className="w-6 h-6" />
        </button>
      </nav>
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CampusShell />
    </AuthProvider>
  );
}
