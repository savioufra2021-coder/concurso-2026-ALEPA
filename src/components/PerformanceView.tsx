import React, { useMemo } from 'react';
import { BarChart3, CheckCircle2, Clock, Cloud, Lightbulb, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMedioCargoInfo, isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { formatDateKey, getDisciplineShortName } from '../data/alepaSyllabus';
import { CampusLevel, MedioCargoGroup } from '../types';

export function PerformanceView({
  campus,
  medioCargoGroup = 'cargo_01_04',
}: {
  campus: CampusLevel;
  medioCargoGroup?: MedioCargoGroup;
}) {
  const { studySessions, simuladoAttempts, topicProgressMap, errorNotebook, isGuest, getCampusDisciplines } =
    useAuth();

  const isMedio = campus === 'medio';
  const activeMedioCargo = getMedioCargoInfo(medioCargoGroup);
  const activeDisciplines = getCampusDisciplines(campus, medioCargoGroup);

  const campusSessions = studySessions.filter((s) =>
    isMedio ? isMedioDisciplineId(s.disciplineId) : !isMedioDisciplineId(s.disciplineId)
  );
  const campusAttempts = simuladoAttempts.filter((a) =>
    isMedio ? isMedioDisciplineId(a.primaryDisciplineId) : !isMedioDisciplineId(a.primaryDisciplineId)
  );
  const campusErrors = errorNotebook.filter((e) =>
    isMedio ? isMedioDisciplineId(e.disciplineId) : !isMedioDisciplineId(e.disciplineId)
  );

  const totalMinutes = campusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const totalQuestionsAnswered = campusAttempts.reduce((acc, a) => acc + a.totalQuestions, 0);
  const totalCorrectAnswers = campusAttempts.reduce((acc, a) => acc + a.correctCount, 0);
  const overallAccuracyPct =
    totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0;

  const avgScore =
    campusAttempts.length > 0
      ? (campusAttempts.reduce((acc, a) => acc + a.score, 0) / campusAttempts.length).toFixed(1)
      : '0.0';

  const masteredErrors = campusErrors.filter((e) => e.status === 'mastered').length;
  const totalErrors = campusErrors.length;
  const recoveryPct = totalErrors > 0 ? Math.round((masteredErrors / totalErrors) * 100) : 100;

  const periodComparison = useMemo(() => {
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(now.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(now.getDate() - 30);
    const k7 = formatDateKey(d7);
    const k30 = formatDateKey(d30);

    const mins7 = campusSessions
      .filter((s) => s.dateKey >= k7)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    const mins30 = campusSessions
      .filter((s) => s.dateKey >= k30)
      .reduce((acc, s) => acc + s.durationMinutes, 0);

    return { mins7, mins30 };
  }, [campusSessions]);

  const disciplineAnalytics = useMemo(() => {
    return activeDisciplines.map((disc) => {
      const topicLevels = disc.topics.map((t) => topicProgressMap[t.id]?.masteryLevel ?? 0);
      const avgMastery = topicLevels.length
        ? Math.round(topicLevels.reduce((a, b) => a + b, 0) / topicLevels.length)
        : 0;
      const mins = campusSessions
        .filter((s) => s.disciplineId === disc.id)
        .reduce((a, s) => a + s.durationMinutes, 0);
      const pendingDiscErrors = campusErrors.filter(
        (e) => e.disciplineId === disc.id && e.status === 'pending'
      ).length;

      return {
        disc,
        avgMastery,
        mins,
        pendingDiscErrors,
      };
    });
  }, [activeDisciplines, topicProgressMap, campusSessions, campusErrors]);

  const smartRecommendations = useMemo(() => {
    const items: string[] = [];
    const lowestDisc = [...disciplineAnalytics].sort((a, b) => a.avgMastery - b.avgMastery)[0];
    if (lowestDisc && lowestDisc.avgMastery < 60) {
      items.push(
        `Reforçar "${lowestDisc.disc.shortName}" (${lowestDisc.avgMastery}% concluído · peso ${lowestDisc.disc.examQuestions}q na prova).`
      );
    }
    const highestErrorDisc = [...disciplineAnalytics].sort((a, b) => b.pendingDiscErrors - a.pendingDiscErrors)[0];
    if (highestErrorDisc && highestErrorDisc.pendingDiscErrors > 0) {
      items.push(
        `Revisar ${highestErrorDisc.pendingDiscErrors} erro(s) pendente(s) em "${highestErrorDisc.disc.shortName}" no Caderno de Erros.`
      );
    }
    if (campusAttempts.length === 0) {
      items.push('Realizar seu primeiro Simulado Cronometrado para gerar sua curva de acertos por disciplina.');
    } else if (overallAccuracyPct < 70) {
      items.push(
        `Sua taxa de acerto acumulada está em ${overallAccuracyPct}%. Priorize baterias comentadas nos assuntos com mais erros.`
      );
    }
    if (items.length === 0) {
      items.push('Ritmo consistente! Continue alternando teoria, questões inéditas e revisão espaçada semanal.');
    }
    return items;
  }, [disciplineAnalytics, campusAttempts.length, overallAccuracyPct]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#146C43] inline-flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {isMedio
                ? `Nível Médio (${activeMedioCargo.cargoNumber} · ${activeMedioCargo.code})`
                : 'Nível Superior (Cargo 03 · PL.AL.102)'}{' '}
              · {isGuest ? 'Modo visitante (salvo localmente)' : 'Nuvem ativa'}
            </span>
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Evolução e Desempenho ({isMedio ? 'Nível Médio' : 'Nível Superior'})
          </h1>
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Horas acumuladas</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
            {totalHours}h
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {periodComparison.mins7} min (7d) · {periodComparison.mins30} min (30d)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Taxa de acertos</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#0B3321] dark:text-emerald-400 font-mono tabular-nums mt-1">
            {overallAccuracyPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {totalCorrectAnswers}/{totalQuestionsAnswered} questões · média {avgScore}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Simulados realizados</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
            {campusAttempts.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Padrão Fundação CETAP</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Recuperação de erros</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#16A34A] dark:text-emerald-400 font-mono tabular-nums mt-1">
            {recoveryPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {masteredErrors}/{totalErrors} dominadas
          </p>
        </div>
      </div>

      {/* Recomendações Automáticas baseadas em Dados Reais */}
      <section className="bg-[#E8F3EC] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0B3321] dark:text-emerald-300">
          <Lightbulb className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
          <span>Recomendações Baseadas nos Seus Dados Reais</span>
        </div>
        <ul className="space-y-1.5 text-xs sm:text-sm text-[#0B3321] dark:text-emerald-200">
          {smartRecommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Progress by Discipline */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#0B3321] dark:text-emerald-400" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Cobertura, Horas e Erros Pendentes por Disciplina
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          {disciplineAnalytics.map(({ disc, avgMastery, mins, pendingDiscErrors }) => (
            <div key={disc.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {disc.priorityRank}º · {disc.shortName}
                </span>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {pendingDiscErrors > 0 && (
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">{pendingDiscErrors} erros</span>
                  )}
                  <span>{mins} min</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 w-10 text-right">{avgMastery}%</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0B3321] dark:bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${avgMastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Evolução recente dos simulados */}
      {campusAttempts.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#146C43] dark:text-emerald-400" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Evolução de Notas nos Últimos Simulados
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {campusAttempts.slice(0, 5).reverse().map((att) => {
              const pct = Math.round((att.score / 10) * 100);
              return (
                <div key={att.id} className="p-3 rounded-xl bg-[#F5F7F6] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#0B3321] dark:text-emerald-400">{att.score.toFixed(1)}/10</span>
                    <span className="text-slate-500 dark:text-slate-400">{att.correctCount}/{att.totalQuestions}</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-[#146C43] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{att.title}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tables: Simulado History + Study Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Histórico de Simulados</h2>
          {campusAttempts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              Nenhum simulado registrado neste campus ainda. Conclua uma bateria na aba Questões.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {campusAttempts.slice(0, 10).map((att) => (
                <div key={att.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{att.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {att.correctCount}/{att.totalQuestions} acertos · {Math.round(att.durationSeconds / 60)} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {att.score.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Sessões de Estudo Recentes</h2>
          {campusSessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              Nenhuma sessão registrada neste campus ainda. Inicie o cronômetro de 2h no Cronograma.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {campusSessions.slice(0, 10).map((ses) => (
                <div key={ses.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {getDisciplineShortName(ses.disciplineId)} · {ses.topicTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {ses.dateKey.split('-').reverse().join('/')} · {ses.blockType}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ses.durationMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
