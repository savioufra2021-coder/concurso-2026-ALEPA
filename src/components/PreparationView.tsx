import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  MEDIO_CARGOS,
  MEDIO_CONCURSO_PROFILE,
  getMedioCargoInfo,
  isMedioDisciplineId,
} from '../data/alepaMedioSyllabus';
import {
  ADMIN_LEGISLATIVE_PRIORITIES,
  CONCURSO_PROFILE,
  getDaysUntilExam,
} from '../data/alepaSyllabus';
import { CampusLevel, MedioCargoGroup, NavSection } from '../types';
import { PageHeader, SectionCard, StatTile } from './ui/CampusPrimitives';

export function PreparationView({
  campus,
  onChangeCampus,
  medioCargoGroup,
  onChangeMedioCargoGroup,
  onNavigate,
  onOpenStudyRoom,
}: {
  campus: CampusLevel;
  onChangeCampus: (campus: CampusLevel) => void;
  medioCargoGroup: MedioCargoGroup;
  onChangeMedioCargoGroup: (group: MedioCargoGroup) => void;
  onNavigate: (section: NavSection) => void;
  onOpenStudyRoom: (disciplineId: string, topicId: string) => void;
}) {
  const { profile, topicProgressMap, studySessions, simuladoAttempts, errorNotebook, getCampusDisciplines } =
    useAuth();
  const isMedio = campus === 'medio';
  const disciplines = getCampusDisciplines(campus, medioCargoGroup);
  const activeMedioCargo = getMedioCargoInfo(medioCargoGroup);
  const daysLeft = getDaysUntilExam(profile?.examDate || CONCURSO_PROFILE.examDate);

  const metrics = useMemo(() => {
    const totalTopics = disciplines.reduce((acc, d) => acc + d.topics.length, 0);
    const doneTopics = disciplines.reduce(
      (acc, d) =>
        acc + d.topics.filter((t) => topicProgressMap[t.id]?.theoryDone && topicProgressMap[t.id]?.questionsDone).length,
      0
    );
    const highYieldPending = disciplines.flatMap((d) =>
      d.topics
        .filter((t) => t.highYield && !(topicProgressMap[t.id]?.theoryDone && topicProgressMap[t.id]?.questionsDone))
        .map((t) => ({ discipline: d, topic: t }))
    );
    const campusSessions = studySessions.filter((s) =>
      isMedio ? isMedioDisciplineId(s.disciplineId) : !isMedioDisciplineId(s.disciplineId)
    );
    const totalHours = (campusSessions.reduce((a, b) => a + b.durationMinutes, 0) / 60).toFixed(1);
    const campusAttempts = simuladoAttempts.filter((a) =>
      isMedio ? isMedioDisciplineId(a.primaryDisciplineId) : !isMedioDisciplineId(a.primaryDisciplineId)
    );
    const pendingRevs = errorNotebook.filter(
      (e) => e.status === 'pending' && (isMedio ? isMedioDisciplineId(e.disciplineId) : !isMedioDisciplineId(e.disciplineId))
    ).length;

    return {
      totalTopics,
      doneTopics,
      pct: totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0,
      highYieldPending,
      totalHours,
      attemptsCount: campusAttempts.length,
      pendingRevs,
    };
  }, [disciplines, topicProgressMap, studySessions, simuladoAttempts, errorNotebook, isMedio]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Minha Preparação · Concurso ALEPA 2026 (Banca Fundação CETAP)"
        title={isMedio ? `${activeMedioCargo.cargoNumber} – ${activeMedioCargo.title}` : CONCURSO_PROFILE.cargo}
        subtitle={
          isMedio
            ? `${MEDIO_CONCURSO_PROFILE.editalNumber} · ${activeMedioCargo.code} · ${activeMedioCargo.remuneration}`
            : `${CONCURSO_PROFILE.editalNumber} · ${CONCURSO_PROFILE.level} · Meta diária de ${profile?.dailyGoalMinutes || CONCURSO_PROFILE.dailyGoalMinutes} min`
        }
        actions={
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[42px] px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold rounded-xl"
          >
            Ajustar meta e cargo
          </button>
        }
      />

      {/* Seletor de Campus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChangeCampus('superior')}
          className={`p-4 rounded-2xl border text-left transition-colors flex items-start gap-3 ${
            campus === 'superior'
              ? 'bg-[#0B3321] text-white border-[#0B3321]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <GraduationCap className={`w-5 h-5 shrink-0 mt-0.5 ${campus === 'superior' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`} />
          <div>
            <p className={`text-xs font-mono ${campus === 'superior' ? 'text-emerald-200' : 'text-[#146C43] dark:text-emerald-400'}`}>
              CAMPUS 02 · EDITAL 002/2026
            </p>
            <p className="font-display text-base font-bold mt-0.5">Nível Superior (Cargo 03 · PL.AL.102)</p>
            <p className={`text-xs mt-1 ${campus === 'superior' ? 'text-emerald-100/85' : 'text-slate-600 dark:text-slate-400'}`}>
              Assessoramento Legislativo · Técnico Legislativo / Analista
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeCampus('medio')}
          className={`p-4 rounded-2xl border text-left transition-colors flex items-start gap-3 ${
            campus === 'medio'
              ? 'bg-[#0B3321] text-white border-[#0B3321]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <Layers className={`w-5 h-5 shrink-0 mt-0.5 ${campus === 'medio' ? 'text-emerald-300' : 'text-[#146C43] dark:text-emerald-400'}`} />
          <div>
            <p className={`text-xs font-mono ${campus === 'medio' ? 'text-emerald-200' : 'text-[#146C43] dark:text-emerald-400'}`}>
              CAMPUS 01 · EDITAL 001/2026
            </p>
            <p className="font-display text-base font-bold mt-0.5">Nível Médio (Cargos 01 a 04 · PL.AL.060)</p>
            <p className={`text-xs mt-1 ${campus === 'medio' ? 'text-emerald-100/85' : 'text-slate-600 dark:text-slate-400'}`}>
              {activeMedioCargo.cargoNumber} – {activeMedioCargo.shortTitle}
            </p>
          </div>
        </button>
      </div>

      {isMedio && (
        <SectionCard title="Cargo de Nível Médio em Foco">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {MEDIO_CARGOS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => onChangeMedioCargoGroup(c.group)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  medioCargoGroup === c.group
                    ? 'border-[#146C43] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <p className="text-xs font-mono font-bold">{c.cargoNumber} · {c.code}</p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{c.shortTitle}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{c.vacanciesSummary}</p>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Dias até a prova" value={daysLeft} hint="Previsão: 13/12/2026" accent="brand" />
        <StatTile label="Edital concluído" value={`${metrics.pct}%`} hint={`${metrics.doneTopics}/${metrics.totalTopics} tópicos`} accent="success" />
        <StatTile label="Horas registradas" value={`${metrics.totalHours}h`} hint={`${metrics.attemptsCount} simulados`} />
        <StatTile label="Revisões pendentes" value={metrics.pendingRevs} hint="Caderno de erros" accent="warning" />
      </div>

      {/* Trilha Guiada nos 3 Pilares */}
      <SectionCard
        title="Rota Diária nos 3 Pilares"
        subtitle="Fluxo estruturado: Aprender → Praticar → Evoluir"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-mono font-bold text-[#146C43] dark:text-emerald-400">PILAR 1 · APRENDER</span>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-1">Sala de Estudo & Edital</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Estude teoria, leia PDFs oficiais, consulte fontes acadêmicas e faça flashcards por assunto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const first = disciplines[0];
                if (first?.topics[0]) onOpenStudyRoom(first.id, first.topics[0].id);
                else onNavigate('disciplines');
              }}
              className="min-h-[42px] px-3.5 py-2 bg-[#0B3321] text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>Abrir Sala de Estudo</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-mono font-bold text-[#146C43] dark:text-emerald-400">PILAR 2 · PRATICAR</span>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-1">Questões & Simulados CETAP</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Monte baterias por disciplina, simulados cronometrados de 50q e gere questões inéditas com IA.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('simulados')}
              className="min-h-[42px] px-3.5 py-2 bg-[#146C43] text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Resolver Questões</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-mono font-bold text-[#146C43] dark:text-emerald-400">PILAR 3 · EVOLUIR</span>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-1">Revisão Espaçada & IA</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Corrija seus erros recorrentes em ciclos 1/7/15/30 dias e revise seu desempenho por disciplina.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('revisions')}
              className="min-h-[42px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-[#0B3321] text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
              <span>Revisar Erros e Metas</span>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Próximos tópicos de alta incidência pendentes */}
      <SectionCard
        title="Prioridades de Alta Incidência Pendentes"
        subtitle="Toque em qualquer assunto para abrir diretamente na Sala de Estudo"
        rightSlot={
          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="text-xs font-semibold text-[#0B3321] dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Ver Cronograma 2h</span>
          </button>
        }
      >
        {metrics.highYieldPending.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[#16A34A] dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Todos os tópicos de alta incidência deste campus foram concluídos em teoria e questões!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.highYieldPending.slice(0, 8).map(({ discipline, topic }) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onOpenStudyRoom(discipline.id, topic.id)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-white dark:bg-slate-800/80 text-left flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-mono font-semibold text-[#146C43] dark:text-emerald-400">
                    {discipline.priorityRank}º · {discipline.shortName}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">{topic.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{topic.subtopics.slice(0, 2).join(' · ')}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {!isMedio && (
        <SectionCard title="Ordem Estratégica · Nível Superior (8 Prioridades)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {ADMIN_LEGISLATIVE_PRIORITIES.map((item) => (
              <div key={item.rank} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F5F7F6] dark:bg-slate-800/80 space-y-1">
                <p className="text-[11px] font-mono font-bold text-[#146C43] dark:text-emerald-400">
                  {String(item.rank).padStart(2, '0')}º Prioridade
                </p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
