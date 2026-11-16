import { GERAL_LIBRARY_CATEGORIES, isGeralMaterial } from '../data/alepaGeneralLibrary';
import { MEDIO_LIBRARY_CATEGORIES } from '../data/alepaMedioLibrary';
import { isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { LIBRARY_CATEGORIES } from '../data/alepaQuestions';
import {
  Discipline,
  LibraryCategory,
  LibraryCategoryId,
  LibraryScope,
  Question,
  QuestionDifficulty,
  StudyMaterial,
} from '../types';

export type VideoFilterScope = 'all' | LibraryScope;
export type OriginFilter = 'all' | 'official' | 'training' | 'ai';
export type DifficultyFilter = 'all' | QuestionDifficulty;
export type GeneratorStrategy = 'proportional' | 'balanced';

export interface VideoCategoryGroup {
  key: string;
  title: string;
  categoryIds: LibraryCategoryId[];
  disciplineIds: string[];
  count: number;
}

export function normalizeTextKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterDisciplinesByBlock(disciplines: Discipline[], blockFilter: string): Discipline[] {
  if (!blockFilter || blockFilter === 'all') return disciplines;
  return disciplines.filter((d) => d.editalBlock === blockFilter);
}

export function filterVideosByScope(allVideos: StudyMaterial[], scope: VideoFilterScope): StudyMaterial[] {
  if (scope === 'all') return allVideos;
  return allVideos.filter((m) => {
    if (scope === 'geral') {
      return m.campusLevel === 'geral' || isGeralMaterial(m);
    }
    if (scope === 'medio') {
      if (m.campusLevel === 'medio') return true;
      if (m.campusLevel === 'superior' || m.campusLevel === 'geral' || isGeralMaterial(m)) return false;
      return Boolean(m.libraryCategoryId?.startsWith('nm_')) || isMedioDisciplineId(m.disciplineId);
    }
    if (m.campusLevel === 'superior') return true;
    if (m.campusLevel === 'medio' || m.campusLevel === 'geral' || isGeralMaterial(m)) return false;
    const inMedioOnly = Boolean(m.libraryCategoryId?.startsWith('nm_')) || isMedioDisciplineId(m.disciplineId);
    return !inMedioOnly;
  });
}

function getScopedBaseCategories(scope: VideoFilterScope): LibraryCategory[] {
  if (scope === 'geral') return GERAL_LIBRARY_CATEGORIES;
  if (scope === 'medio') return MEDIO_LIBRARY_CATEGORIES;
  if (scope === 'superior') return LIBRARY_CATEGORIES;
  return [...GERAL_LIBRARY_CATEGORIES, ...LIBRARY_CATEGORIES, ...MEDIO_LIBRARY_CATEGORIES];
}

export function doesVideoBelongToCategory(
  video: Pick<StudyMaterial, 'libraryCategoryId' | 'disciplineId'>,
  cat: Pick<LibraryCategory, 'id' | 'disciplineId'>
): boolean {
  return video.libraryCategoryId
    ? video.libraryCategoryId === cat.id
    : video.disciplineId === cat.disciplineId;
}

/**
 * Builds deduplicated discipline filter options for VideosView.
 * In `all` scope, merges categories sharing identical normalized titles across Geral, Superior,
 * and Médio so no duplicate labels appear while preserving accurate counts and full scope matching.
 */
export function buildVideoCategoryGroups(
  scope: VideoFilterScope,
  videosForCounting: StudyMaterial[]
): VideoCategoryGroup[] {
  const baseCategories = getScopedBaseCategories(scope);

  if (scope !== 'all') {
    return baseCategories.map((cat) => {
      const matched = videosForCounting.filter((v) => doesVideoBelongToCategory(v, cat));
      return {
        key: cat.id,
        title: cat.title,
        categoryIds: [cat.id],
        disciplineIds: [cat.disciplineId],
        count: matched.length,
      };
    });
  }

  const grouped = new Map<
    string,
    {
      key: string;
      title: string;
      categoryIds: LibraryCategoryId[];
      disciplineIds: string[];
    }
  >();

  for (const cat of baseCategories) {
    const normTitle = normalizeTextKey(cat.title);
    const existing = grouped.get(normTitle);
    if (!existing) {
      grouped.set(normTitle, {
        key: `merged_${normTitle.replace(/[^a-z0-9]+/g, '_')}`,
        title: cat.title,
        categoryIds: [cat.id],
        disciplineIds: [cat.disciplineId],
      });
    } else {
      if (!existing.categoryIds.includes(cat.id)) existing.categoryIds.push(cat.id);
      if (!existing.disciplineIds.includes(cat.disciplineId)) existing.disciplineIds.push(cat.disciplineId);
    }
  }

  const result: VideoCategoryGroup[] = [];
  for (const group of grouped.values()) {
    const count = videosForCounting.filter((v) =>
      v.libraryCategoryId
        ? group.categoryIds.includes(v.libraryCategoryId)
        : group.disciplineIds.includes(v.disciplineId)
    ).length;

    if (count > 0) {
      result.push({
        ...group,
        count,
      });
    }
  }
  return result;
}

export function matchesVideoCategoryGroup(
  video: Pick<StudyMaterial, 'libraryCategoryId' | 'disciplineId'>,
  selectedKey: string,
  groups: VideoCategoryGroup[]
): boolean {
  if (!selectedKey || selectedKey === 'all') return true;
  const group = groups.find((g) => g.key === selectedKey || g.categoryIds.includes(selectedKey as LibraryCategoryId));
  if (!group) return false;
  return video.libraryCategoryId
    ? group.categoryIds.includes(video.libraryCategoryId)
    : group.disciplineIds.includes(video.disciplineId);
}

export function matchesOriginFilter(q: Pick<Question, 'originType' | 'isOfficial'>, origin: OriginFilter): boolean {
  if (origin === 'all') return true;
  const isAi = q.originType === 'ai_generated';
  if (origin === 'ai') return isAi;
  const isOff = Boolean(q.isOfficial) && !isAi;
  if (origin === 'official') return isOff;
  return !isOff && !isAi;
}

export function matchesDifficultyFilter(q: Pick<Question, 'difficulty'>, difficulty: DifficultyFilter): boolean {
  if (difficulty === 'all') return true;
  return (q.difficulty || 'intermediario') === difficulty;
}

const LEGACY_TOPIC_KEYWORD_GROUPS: Array<{ topicNeedle: string; aliases: string[] }> = [
  {
    topicNeedle: 'compreensao, argumentacao, coesao',
    aliases: ['interpretacao', 'coesao', 'coerencia', 'significacao', 'argumentacao'],
  },
  {
    topicNeedle: 'ortografia, acentuacao, crase',
    aliases: ['ortografia', 'acentuacao', 'crase', 'porques', 'classes de palavras'],
  },
  {
    topicNeedle: 'sintaxe, concordancia, regencia, pronomes e redacao oficial',
    aliases: ['sintaxe', 'concordancia', 'regencia', 'pontuacao', 'redacao oficial', 'manual da presidencia'],
  },
  {
    topicNeedle: 'lgpd, etica no servico publico',
    aliases: ['lgpd', 'etica', 'anticorrupcao', 'improbidade', '8.429'],
  },
  {
    topicNeedle: 'constituicao do estado do para e legislacao da alepa',
    aliases: ['constituicao do estado do para', 'alepa'],
  },
  {
    topicNeedle: 'regimento interno',
    aliases: ['regimento interno', 'res. 02/2022', 'resolucao', 'decretos legislativos'],
  },
  {
    topicNeedle: 'windows 10/11, word, excel',
    aliases: ['windows', 'word', 'excel', 'calc', 'powerpoint', 'libreoffice', 'writer'],
  },
  {
    topicNeedle: 'internet, seguranca da informacao',
    aliases: ['seguranca', 'internet', 'phishing', 'correio eletronico', 'nuvem', 'navegador'],
  },
  {
    topicNeedle: 'logica, relacoes arbitrarias, sequencias',
    aliases: ['logica', 'proposicional', 'conectivos', 'sequencias', 'relacoes arbitrarias'],
  },
  {
    topicNeedle: 'matematica, proporcao, regra de tres e porcentagem',
    aliases: ['porcentagem', 'regra de tres', 'proporcao', 'descontos sucessivos', 'razao'],
  },
  {
    topicNeedle: 'constituicao, principios fundamentais',
    aliases: ['principios fundamentais', 'direitos fundamentais', 'remedios constitucionais', 'art. 5'],
  },
  {
    topicNeedle: 'organizacao do estado, poder legislativo',
    aliases: ['organizacao do estado', 'poder legislativo', 'processo legislativo', 'comissoes'],
  },
  {
    topicNeedle: 'administracao publica (art. 37 cf), servidores e rju',
    aliases: ['art. 37', 'rju', '5.810', 'servidores', 'provimento'],
  },
  {
    topicNeedle: 'atos administrativos, organizacao, servicos publicos e licitacoes',
    aliases: ['atos administrativos', 'poderes', 'licitacoes', '14.133', 'servicos publicos'],
  },
  {
    topicNeedle: 'redacao de leis (lc nº 95/98)',
    aliases: ['95/1998', '95/98', 'tecnica legislativa', 'proposicoes', 'parecer', 'mocao', 'requerimento'],
  },
  {
    topicNeedle: 'organizacao, estruturas, processos, projetos e gestao de contratos',
    aliases: ['organizacao administrativa', 'processos', 'projetos', 'gestao de contratos', 'pdca'],
  },
  {
    topicNeedle: 'documentos, relatorios, formularios, planilhas e atendimento',
    aliases: ['secretaria', 'agenda', 'atas', 'oficios', 'atendimento', 'planilhas'],
  },
  {
    topicNeedle: 'protocolo, classificacao, temporalidade e gestao de documentos',
    aliases: ['arquivologia', 'temporalidade', 'protocolo', 'classificacao', 'metodos de arquivamento', '8.159'],
  },
  {
    topicNeedle: 'compras, estoque, recebimento, armazenagem e gestao patrimonial',
    aliases: ['estoques', 'estoque', 'patrimonio', 'patrimonial', 'recebimento', 'armazenagem', 'inventario', 'peps', 'abc'],
  },
];

export function matchesQuestionTopic(questionTopicTitle: string, targetTopicTitle: string): boolean {
  if (!targetTopicTitle || targetTopicTitle === 'all') return true;
  const qNorm = normalizeTextKey(questionTopicTitle);
  const tNorm = normalizeTextKey(targetTopicTitle);
  if (qNorm === tNorm || qNorm.includes(tNorm) || tNorm.includes(qNorm)) {
    return true;
  }
  const group = LEGACY_TOPIC_KEYWORD_GROUPS.find((g) => tNorm.includes(g.topicNeedle));
  if (group) {
    return group.aliases.some((alias) => qNorm.includes(alias));
  }
  return false;
}

export function collectTopicsForDisciplines(
  disciplines: Discipline[],
  selectedDiscIds: string[],
  questions: Question[]
): Array<{ disciplineId: string; disciplineShortName: string; title: string }> {
  const discSet = new Set(selectedDiscIds);
  const seen = new Set<string>();
  const items: Array<{ disciplineId: string; disciplineShortName: string; title: string }> = [];

  for (const d of disciplines) {
    if (discSet.size > 0 && !discSet.has(d.id)) continue;
    for (const t of d.topics) {
      const key = `${d.id}::${normalizeTextKey(t.title)}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          disciplineId: d.id,
          disciplineShortName: d.shortName,
          title: t.title,
        });
      }
    }
    for (const q of questions) {
      if (q.disciplineId !== d.id || !q.topicTitle) continue;
      const alreadyCoveredBySyllabus = d.topics.some((t) => matchesQuestionTopic(q.topicTitle, t.title));
      if (!alreadyCoveredBySyllabus) {
        const key = `${d.id}::${normalizeTextKey(q.topicTitle)}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            disciplineId: d.id,
            disciplineShortName: d.shortName,
            title: q.topicTitle,
          });
        }
      }
    }
  }

  return items;
}

export function buildSimuladoDistributionPlan(params: {
  disciplines: Discipline[];
  campusQuestions: Question[];
  selectedDiscIds: string[];
  selectedTopics: string[];
  difficultyFilter: DifficultyFilter;
  originFilter: OriginFilter;
  targetCountInput: number;
  strategy: GeneratorStrategy;
}) {
  const {
    disciplines,
    campusQuestions,
    selectedDiscIds,
    selectedTopics,
    difficultyFilter,
    originFilter,
    targetCountInput,
    strategy,
  } = params;

  const selectedSet = new Set(selectedDiscIds);
  const selectedDiscObjects = disciplines.filter((d) => selectedSet.has(d.id));

  const filteredPool = campusQuestions.filter((q) => {
    if (!selectedSet.has(q.disciplineId)) return false;
    if (!matchesOriginFilter(q, originFilter)) return false;
    if (!matchesDifficultyFilter(q, difficultyFilter)) return false;
    if (selectedTopics.length > 0 && !selectedTopics.some((t) => matchesQuestionTopic(q.topicTitle, t))) {
      return false;
    }
    return true;
  });

  const poolByDisc = new Map<string, Question[]>();
  selectedDiscObjects.forEach((d) => {
    poolByDisc.set(
      d.id,
      filteredPool.filter((q) => q.disciplineId === d.id)
    );
  });

  const maxAvailable = filteredPool.length;
  const targetCount = Math.min(Math.max(1, targetCountInput), maxAvailable);

  const quotas = new Map<string, number>();
  selectedDiscObjects.forEach((d) => quotas.set(d.id, 0));

  if (targetCount > 0 && selectedDiscObjects.length > 0) {
    const totalWeight = selectedDiscObjects.reduce(
      (sum, d) => sum + (strategy === 'proportional' ? Math.max(1, d.examQuestions) : 1),
      0
    );

    let assigned = 0;
    const remainders: Array<{ id: string; rem: number }> = [];
    selectedDiscObjects.forEach((d) => {
      const w = strategy === 'proportional' ? Math.max(1, d.examQuestions) : 1;
      const exact = (targetCount * w) / totalWeight;
      const avail = poolByDisc.get(d.id)?.length || 0;
      const base = Math.min(avail, Math.floor(exact));
      quotas.set(d.id, base);
      assigned += base;
      remainders.push({ id: d.id, rem: exact - Math.floor(exact) });
    });

    remainders.sort((a, b) => b.rem - a.rem);
    let safety = 0;
    while (assigned < targetCount && safety < 500) {
      safety += 1;
      let progressed = false;
      for (const item of remainders) {
        if (assigned >= targetCount) break;
        const avail = poolByDisc.get(item.id)?.length || 0;
        const cur = quotas.get(item.id) || 0;
        if (cur < avail) {
          quotas.set(item.id, cur + 1);
          assigned += 1;
          progressed = true;
        }
      }
      if (!progressed) break;
    }
  }

  const breakdown = selectedDiscObjects.map((d) => ({
    discipline: d,
    planned: quotas.get(d.id) || 0,
    available: poolByDisc.get(d.id)?.length || 0,
  }));

  return {
    selectedCount: selectedDiscObjects.length,
    maxAvailable,
    targetCount,
    breakdown,
    poolByDisc,
  };
}
