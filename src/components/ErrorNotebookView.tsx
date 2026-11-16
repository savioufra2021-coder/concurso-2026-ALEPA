import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { formatDateKey, getDisciplineShortName } from '../data/alepaSyllabus';
import { CampusLevel, ErrorReason } from '../types';
import {
  SPACED_REPETITION_PRESETS,
  addDaysIso,
  loadSpacedRepetitionConfig,
  saveSpacedRepetitionConfig,
} from '../utils/mediaUrls';

const REASON_LABELS: Record<ErrorReason, string> = {
  atencao: 'Falta de atenção',
  teoria: 'Lacuna de teoria',
  lei_seca: 'Letra da lei / Regimento',
  banca_cetap: 'Pegadinha da banca CETAP',
};

export function ErrorNotebookView({ campus }: { campus: CampusLevel }) {
  const { errorNotebook, updateErrorEntry, deleteErrorEntry } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'pending' | 'overdue' | 'mastered' | 'all'>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [reasonDraft, setReasonDraft] = useState<ErrorReason>('teoria');
  const [spacedCfg, setSpacedCfg] = useState(() => loadSpacedRepetitionConfig());

  const isMedio = campus === 'medio';
  const todayIso = formatDateKey(new Date());

  const campusErrors = useMemo(
    () =>
      errorNotebook.filter((e) =>
        isMedio ? isMedioDisciplineId(e.disciplineId) : !isMedioDisciplineId(e.disciplineId)
      ),
    [errorNotebook, isMedio]
  );

  const pendingErrors = campusErrors.filter((e) => e.status === 'pending');
  const overdueErrors = pendingErrors.filter((e) => e.nextReviewDate <= todayIso);
  const masteredErrors = campusErrors.filter((e) => e.status === 'mastered');

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return campusErrors;
    if (filterStatus === 'overdue') return overdueErrors;
    return campusErrors.filter((e) => e.status === filterStatus);
  }, [campusErrors, overdueErrors, filterStatus]);

  // Diagnóstico de erros recorrentes com base apenas nos registros reais
  const diagnostics = useMemo(() => {
    const byReason: Record<ErrorReason, number> = {
      atencao: 0,
      teoria: 0,
      lei_seca: 0,
      banca_cetap: 0,
    };
    const byDisc = new Map<string, number>();

    pendingErrors.forEach((e) => {
      byReason[e.errorReason] = (byReason[e.errorReason] || 0) + 1;
      byDisc.set(e.disciplineId, (byDisc.get(e.disciplineId) || 0) + 1);
    });

    const topReason = (Object.entries(byReason) as Array<[ErrorReason, number]>).sort((a, b) => b[1] - a[1])[0];
    const topDisc = Array.from(byDisc.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      topReason: topReason && topReason[1] > 0 ? topReason : null,
      topDisc: topDisc && topDisc[1] > 0 ? topDisc : null,
    };
  }, [pendingErrors]);

  const handleScheduleReview = async (
    id: string,
    currentCount: number,
    daysAhead: number,
    markMastered: boolean
  ) => {
    await updateErrorEntry(id, {
      reviewCount: currentCount + 1,
      nextReviewDate: addDaysIso(daysAhead),
      status: markMastered ? 'mastered' : 'pending',
    });
  };

  const handleSaveEdit = async (id: string) => {
    await updateErrorEntry(id, {
      improvementNote: noteText,
      errorReason: reasonDraft,
    });
    setEditingId(null);
  };

  const handleChangePreset = (preset: 'padrao' | 'intensivo' | 'estendido') => {
    const next = { preset, intervals: SPACED_REPETITION_PRESETS[preset].intervals };
    setSpacedCfg(next);
    saveSpacedRepetitionConfig(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#146C43] dark:text-emerald-400">
            Banco de Melhoria · Revisão Espaçada Configurável ({spacedCfg.intervals.join(' / ')} dias)
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Caderno de Erros e Revisões
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span className={overdueErrors.length > 0 ? 'text-amber-700 dark:text-amber-300 font-bold' : ''}>
            Para hoje/atrasadas: {overdueErrors.length}
          </span>
          <span aria-hidden="true">·</span>
          <span>Pendentes: {pendingErrors.length}</span>
          <span aria-hidden="true">·</span>
          <span>Dominadas: {masteredErrors.length}</span>
        </div>
      </div>

      {/* Diagnóstico Real & Seletor de Ciclo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
          <p className="text-xs font-semibold text-[#146C43] dark:text-emerald-400 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Diagnóstico Automático dos Seus Erros</span>
          </p>
          {pendingErrors.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Você ainda não possui erros pendentes neste campus. Erros cometidos nos simulados e na Sala de Estudo
              aparecem aqui automaticamente.
            </p>
          ) : (
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {diagnostics.topDisc && (
                <p>
                  Disciplina com mais pontos de atenção:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {getDisciplineShortName(diagnostics.topDisc[0])} ({diagnostics.topDisc[1]} pendências)
                  </strong>
                </p>
              )}
              {diagnostics.topReason && (
                <p>
                  Principal causa registrada:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {REASON_LABELS[diagnostics.topReason[0]]} ({diagnostics.topReason[1]}x)
                  </strong>
                </p>
              )}
              {overdueErrors.length > 0 && (
                <p className="text-amber-800 dark:text-amber-300 font-medium">
                  Há {overdueErrors.length} questão(ões) com revisão programada para hoje ou em atraso.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
          <label htmlFor="spaced-preset-select" className="text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
            <span>Frequência de Revisão</span>
          </label>
          <select
            id="spaced-preset-select"
            value={spacedCfg.preset}
            onChange={(e) => handleChangePreset(e.target.value as 'padrao' | 'intensivo' | 'estendido')}
            className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
          >
            {Object.entries(SPACED_REPETITION_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{SPACED_REPETITION_PRESETS[spacedCfg.preset].description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-fit">
        {(
          [
            { id: 'pending', label: `Pendentes (${pendingErrors.length})` },
            { id: 'overdue', label: `Hoje / Atrasadas (${overdueErrors.length})` },
            { id: 'mastered', label: `Dominadas (${masteredErrors.length})` },
            { id: 'all', label: `Todas (${campusErrors.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              filterStatus === tab.id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <RefreshCw className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {filterStatus === 'pending'
              ? 'Nenhuma questão pendente de revisão'
              : filterStatus === 'overdue'
                ? 'Nenhuma revisão atrasada para hoje'
                : 'Nenhum registro nesta categoria'}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Sempre que você errar uma questão nos simulados ou baterias de treino, ela aparecerá automaticamente aqui
            para revisão espaçada e registro de melhoria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => {
            const isEditing = editingId === entry.id;
            const isOverdue = entry.status === 'pending' && entry.nextReviewDate <= todayIso;
            const nextDefaultDays = spacedCfg.intervals[Math.min(entry.reviewCount, 3)] || 7;
            return (
              <article
                key={entry.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 sm:p-6 space-y-4 ${
                  isOverdue ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{getDisciplineShortName(entry.disciplineId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.topicTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>Motivo: {REASON_LABELS[entry.errorReason]}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-500">
                    <span className={isOverdue ? 'text-amber-700 font-bold inline-flex items-center gap-1' : ''}>
                      {isOverdue && <CalendarClock className="w-3.5 h-3.5" />}
                      Próx. revisão: {entry.nextReviewDate.split('-').reverse().join('/')}
                    </span>
                    <span>Revisões: {entry.reviewCount}</span>
                  </div>
                </div>

                <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                  {entry.questionStem}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200">
                    <span className="font-semibold block mb-1">Sua resposta anterior</span>
                    <span>{entry.selectedOption}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-950 dark:text-emerald-200">
                    <span className="font-semibold block mb-1">Gabarito oficial</span>
                    <span>{entry.correctOption}</span>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Causa do erro</label>
                        <select
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value as ErrorReason)}
                          className="w-full min-h-[42px] px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                        >
                          {Object.entries(REASON_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nota de melhoria (o que memorizar para não errar novamente)
                      </label>
                      <textarea
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-[40px] px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(entry.id)}
                        className="min-h-[40px] px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0B3321] text-white"
                      >
                        Salvar melhoria
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-300">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block mb-1">Nota de melhoria:</span>
                    {entry.improvementNote || 'Sem nota registrada.'}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setNoteText(entry.improvementNote);
                        setReasonDraft(entry.errorReason);
                      }}
                      className="min-h-[42px] px-3.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Editar nota
                    </button>

                    {entry.status === 'pending' ? (
                      <>
                        {spacedCfg.intervals.slice(0, 3).map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => handleScheduleReview(entry.id, entry.reviewCount, days, false)}
                            className={`min-h-[42px] px-3 py-1.5 text-xs font-medium border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              days === nextDefaultDays
                                ? 'border-[#146C43] bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200 font-semibold'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            +{days}d
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            handleScheduleReview(entry.id, entry.reviewCount, spacedCfg.intervals[3] || 30, true)
                          }
                          className="min-h-[42px] px-4 py-1.5 text-xs font-semibold bg-[#146C43] hover:bg-[#0B3321] text-white rounded-xl inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dominada (+{spacedCfg.intervals[3] || 30}d)</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleScheduleReview(entry.id, entry.reviewCount, spacedCfg.intervals[1] || 7, false)
                        }
                        className="min-h-[42px] px-3.5 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50"
                      >
                        Retornar para pendentes
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteErrorEntry(entry.id)}
                    aria-label="Excluir registro do caderno"
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
