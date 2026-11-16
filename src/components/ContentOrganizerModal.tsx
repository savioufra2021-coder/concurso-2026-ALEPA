import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/apiClient';
import {
  CampusLevel,
  LibraryScope,
  MaterialChapter,
  PublicationStatus,
  StudyMaterial,
} from '../types';

interface ContentOrganizerModalProps {
  material: StudyMaterial;
  campus: CampusLevel;
  onClose: () => void;
  onSaved?: (materialId: string) => void;
}

export function ContentOrganizerModal({
  material,
  campus,
  onClose,
  onSaved,
}: ContentOrganizerModalProps) {
  const {
    user,
    effectiveRole,
    isAdmin,
    canPublishShared,
    getCampusDisciplines,
    updateMaterial,
    updateMaterialStatus,
  } = useAuth();

  const [title, setTitle] = useState(material.title || '');
  const [subtitle, setSubtitle] = useState(material.subtitle || '');
  const [description, setDescription] = useState(material.description || '');
  const [campusLevel, setCampusLevel] = useState<LibraryScope>(material.campusLevel || campus);
  const [disciplineId, setDisciplineId] = useState(material.disciplineId || '');
  const [editalTopic, setEditalTopic] = useState(material.editalTopic || '');
  const [keywordsText, setKeywordsText] = useState((material.keywords || []).join(', '));
  const [recommendationsText, setRecommendationsText] = useState(
    (material.studyRecommendations || []).join('\n')
  );
  const [chapters, setChapters] = useState<MaterialChapter[]>(material.chapters || []);
  const [transcriptNotes, setTranscriptNotes] = useState('');

  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isMedia =
    material.resourceType === 'video' ||
    material.resourceType === 'podcast' ||
    material.fileType === 'video';
  const canUseAi =
    effectiveRole === 'admin' ||
    effectiveRole === 'editor' ||
    effectiveRole === 'teacher' ||
    effectiveRole === 'dev';

  const disciplineOptions = useMemo(() => {
    const sup = getCampusDisciplines('superior').map((d) => ({
      id: d.id,
      name: `${d.shortName} (Superior)`,
    }));
    const med = getCampusDisciplines('medio').map((d) => ({
      id: d.id,
      name: `${d.shortName} (Médio)`,
    }));
    const gerais = [
      { id: 'geral_portugues', name: 'Português (Geral)' },
      { id: 'geral_raciocinio_logico', name: 'Raciocínio Lógico (Geral)' },
      { id: 'geral_informatica', name: 'Informática (Geral)' },
      { id: 'geral_constitucional', name: 'Constitucional (Geral)' },
      { id: 'geral_administrativo', name: 'Administrativo (Geral)' },
      { id: 'geral_legislacao_alepa', name: 'Legislação ALEPA (Geral)' },
      { id: 'geral_etica', name: 'Ética (Geral)' },
    ];
    return [...gerais, ...sup, ...med];
  }, [getCampusDisciplines]);

  const handleAddChapter = () => {
    setChapters((prev) => [
      ...prev,
      {
        id: `ch_${Date.now()}_${prev.length}`,
        title: '',
        summary: '',
      },
    ]);
  };

  const handleMoveChapter = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= chapters.length) return;
    setChapters((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleAiOrganize = async () => {
    setErrorMsg(null);
    setFeedback(null);
    setAiBusy(true);
    try {
      const res = await apiFetch('/api/ai/organize-material', {
        method: 'POST',
        body: JSON.stringify({
          title,
          fileName: material.fileName,
          resourceType: material.resourceType || material.fileType,
          campusLevel,
          editalTopic,
          description,
          pageCount: material.pageCount,
          durationSeconds: material.durationSeconds,
          outlineWithPages: (material.sections || []).map((s) => ({
            title: s.title,
            page: s.startPage,
          })),
          transcriptOrNotes: transcriptNotes,
          availableDisciplines: disciplineOptions.slice(0, 24),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        suggestion?: {
          subtitle?: string;
          description?: string;
          disciplineId?: string;
          editalTopic?: string;
          keywords?: string[];
          studyRecommendations?: string[];
          chapters?: MaterialChapter[];
        };
      };
      if (!res.ok || !json.suggestion) {
        throw new Error(json.error || 'Não foi possível gerar sugestão de organização.');
      }
      const sug = json.suggestion;
      if (sug.subtitle) setSubtitle(sug.subtitle);
      if (sug.description) setDescription(sug.description);
      if (sug.disciplineId && disciplineOptions.some((d) => d.id === sug.disciplineId)) {
        setDisciplineId(sug.disciplineId);
      }
      if (sug.editalTopic) setEditalTopic(sug.editalTopic);
      if (Array.isArray(sug.keywords) && sug.keywords.length > 0) {
        setKeywordsText(sug.keywords.join(', '));
      }
      if (Array.isArray(sug.studyRecommendations) && sug.studyRecommendations.length > 0) {
        setRecommendationsText(sug.studyRecommendations.join('\n'));
      }
      if (Array.isArray(sug.chapters) && sug.chapters.length > 0 && chapters.length === 0) {
        setChapters(sug.chapters);
      }
      setFeedback('Sugestões aplicadas como rascunho. Revise todos os capítulos e páginas antes de salvar.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao consultar IA.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async (targetStatus?: PublicationStatus) => {
    if (material.pendingDefinition) {
      setErrorMsg('Este material está marcado com definição pendente e não pode ser alterado ou publicado até confirmação.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Informe o título do material.');
      return;
    }
    setErrorMsg(null);
    setFeedback(null);
    setSaving(true);
    try {
      const cleanedChapters: MaterialChapter[] = chapters
        .filter((c) => c.title.trim().length > 0)
        .map((c, idx) => {
          const sp = typeof c.startPage === 'number' && c.startPage >= 1 ? Math.round(c.startPage) : undefined;
          const ep =
            typeof c.endPage === 'number' && c.endPage >= 1
              ? Math.max(sp || 1, Math.round(c.endPage))
              : undefined;
          const ss = typeof c.startSeconds === 'number' && c.startSeconds >= 0 ? Math.round(c.startSeconds) : undefined;
          const es =
            typeof c.endSeconds === 'number' && c.endSeconds >= 0
              ? Math.max(ss || 0, Math.round(c.endSeconds))
              : undefined;
          return {
            id: c.id || `ch_${idx + 1}`,
            title: c.title.trim().slice(0, 140),
            summary: c.summary?.trim() ? c.summary.trim().slice(0, 320) : undefined,
            startPage: sp,
            endPage: ep,
            startSeconds: ss,
            endSeconds: es,
          };
        });

      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);

      const studyRecommendations = recommendationsText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 8);

      await updateMaterial(material.id, {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim(),
        campusLevel,
        disciplineId: disciplineId || material.disciplineId,
        editalTopic: editalTopic.trim(),
        keywords,
        studyRecommendations,
        chapters: cleanedChapters,
        organizedBy: user?.uid || material.organizedBy,
        organizedAt: new Date().toISOString(),
      });

      if (targetStatus) {
        await updateMaterialStatus(material.id, targetStatus);
      }

      onSaved?.(material.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar organização.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="organize-content-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#146C43] dark:text-emerald-400">
                Curadoria & Metadados
              </p>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Status:{' '}
                {material.status === 'published'
                  ? 'Publicado'
                  : material.status === 'approved'
                    ? 'Aprovado'
                    : material.status === 'in_review'
                      ? 'Em revisão'
                      : material.status === 'archived'
                        ? 'Arquivado'
                        : 'Rascunho'}
              </span>
              {material.pendingDefinition && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  Definição pendente
                </span>
              )}
            </div>
            <h2 id="organize-content-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              Identificar e organizar conteúdo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar organizador"
            className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {material.pendingDefinition && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 px-3.5 py-2.5 text-amber-900 dark:text-amber-200 font-medium">
              Material preservado com definição pendente. A edição e publicação permanecem bloqueadas até esclarecimento oficial.
            </div>
          )}
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3.5 py-2.5 text-red-800 dark:text-red-200 font-medium">
              {errorMsg}
            </div>
          )}
          {feedback && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 font-medium">
              {feedback}
            </div>
          )}

          {/* AI Assistant Bar */}
          {canUseAi && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#0B3321] dark:text-emerald-300">Assistente de Organização (IA)</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Gera rascunho de subtítulo, descrição, palavras-chave e recomendações com base nas evidências abaixo.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void handleAiOrganize()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-60 text-white font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{aiBusy ? 'Organizando...' : 'Sugerir com IA'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={transcriptNotes}
                onChange={(e) => setTranscriptNotes(e.target.value)}
                placeholder="Opcional: cole aqui sumário, índice, marcações de tempo ou notas reais deste arquivo para guiar a IA..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Core Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Título principal</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtítulo / Linha editorial</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex.: Lei seca comentada com foco em quóruns da ALEPA"
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Escopo / Campus</label>
              <select
                value={campusLevel}
                onChange={(e) => setCampusLevel(e.target.value as LibraryScope)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              >
                <option value="geral">Geral (Comum aos dois níveis)</option>
                <option value="superior">Campus 02 · Nível Superior</option>
                <option value="medio">Campus 01 · Nível Médio</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Disciplina</label>
              <select
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              >
                {disciplineOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assunto do edital</label>
              <input
                value={editalTopic}
                onChange={(e) => setEditalTopic(e.target.value)}
                placeholder="Ex.: Processo Legislativo e Comissões"
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Palavras-chave (separadas por vírgula)
              </label>
              <input
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="regimento, quórum, comissão, cetap"
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descrição resumida</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recomendações de estudo (uma por linha)
              </label>
              <textarea
                rows={3}
                value={recommendationsText}
                onChange={(e) => setRecommendationsText(e.target.value)}
                placeholder="Ler artigos 1º a 20 com marca-texto&#10;Resolver 10 questões CETAP sobre o tema"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Chapters / Time markers / Page ranges */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Capítulos & {isMedia ? 'Marcações de Tempo' : 'Intervalos de Páginas'} ({chapters.length})
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Permite ir direto ao capítulo certo dentro do Book Reader ou do Player de Mídia.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddChapter}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar capítulo</span>
              </button>
            </div>

            {chapters.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 py-2">
                Nenhum capítulo cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {chapters.map((ch, idx) => (
                  <div
                    key={ch.id || idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#146C43] dark:text-emerald-400">
                        Cap. {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveChapter(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Mover para cima"
                          className="min-w-[30px] min-h-[30px] rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center justify-center"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveChapter(idx, 1)}
                          disabled={idx === chapters.length - 1}
                          aria-label="Mover para baixo"
                          className="min-w-[30px] min-h-[30px] rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center justify-center"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setChapters((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Remover capítulo"
                          className="min-w-[30px] min-h-[30px] rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        value={ch.title}
                        onChange={(e) =>
                          setChapters((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item))
                          )
                        }
                        placeholder="Título do capítulo"
                        className="sm:col-span-2 min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                      {isMedia ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            value={ch.startSeconds ?? ''}
                            onChange={(e) =>
                              setChapters((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, startSeconds: e.target.value === '' ? undefined : Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            placeholder="Início (seg)"
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                          />
                          <input
                            type="number"
                            min={0}
                            value={ch.endSeconds ?? ''}
                            onChange={(e) =>
                              setChapters((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, endSeconds: e.target.value === '' ? undefined : Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            placeholder="Fim (seg)"
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                          />
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={1}
                            value={ch.startPage ?? ''}
                            onChange={(e) =>
                              setChapters((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, startPage: e.target.value === '' ? undefined : Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            placeholder="Pág. inicial"
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                          />
                          <input
                            type="number"
                            min={1}
                            value={ch.endPage ?? ''}
                            onChange={(e) =>
                              setChapters((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, endPage: e.target.value === '' ? undefined : Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            placeholder="Pág. final"
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                          />
                        </>
                      )}
                    </div>

                    <input
                      value={ch.summary || ''}
                      onChange={(e) =>
                        setChapters((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, summary: e.target.value } : item))
                        )
                      }
                      placeholder="Resumo rápido deste capítulo (opcional)"
                      className="w-full min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={saving || Boolean(material.pendingDefinition)}
              onClick={() => void handleSave('draft')}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 disabled:opacity-60"
            >
              Salvar Rascunho
            </button>

            <button
              type="button"
              disabled={saving || Boolean(material.pendingDefinition)}
              onClick={() => void handleSave('in_review')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-sky-300 bg-sky-50 dark:bg-sky-950/50 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar para Revisão</span>
            </button>

            {(canPublishShared || isAdmin) && (
              <>
                <button
                  type="button"
                  disabled={saving || Boolean(material.pendingDefinition)}
                  onClick={() => void handleSave('approved')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold disabled:opacity-60"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={saving || Boolean(material.pendingDefinition)}
                  onClick={() => void handleSave('published')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#146C43] hover:bg-[#0B3321] disabled:opacity-60 text-white font-semibold inline-flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Publicar</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={saving || Boolean(material.pendingDefinition)}
              onClick={() => void handleSave()}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B3321] hover:bg-[#146C43] disabled:opacity-60 text-white font-semibold inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
