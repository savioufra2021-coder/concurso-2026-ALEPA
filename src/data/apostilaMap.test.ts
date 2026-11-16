import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInAppReadableMaterial } from '../lib/epubAndHtmlEngine';
import { MEDIO_DEFAULT_MATERIALS } from './alepaMedioLibrary';
import { ALL_MEDIO_DISCIPLINES } from './alepaMedioSyllabus';
import { ALEPA_DISCIPLINES } from './alepaSyllabus';
import {
  isMaterialPendingDefinition,
  standardizeMaterialCatalog,
} from './libraryCatalogUtils';
import {
  APOSTILA_CHAPTERS_BY_MATERIAL,
  APOSTILA_MARKERS,
  APOSTILA_TOPIC_MAP,
  getApostilaEntriesForTopic,
} from './apostilaMap';

const EXPECTED_APOSTILA_IDS = [
  'nm_mat_local_assistente_resumo',
  'nm_mat_local_assistente_impressao',
  'nm_mat_local_assistente_basico_questoes',
  'nm_mat_local_assistente_questoes_especificas',
] as const;

const KNOWN_PAGE_COUNTS: Record<(typeof EXPECTED_APOSTILA_IDS)[number], number> = {
  nm_mat_local_assistente_resumo: 204,
  nm_mat_local_assistente_impressao: 878,
  nm_mat_local_assistente_basico_questoes: 4338,
  nm_mat_local_assistente_questoes_especificas: 2645,
};

describe('Mapa Tópico → Página da Apostila e visibilidade nos dois campus', () => {
  it('cadastra cada apostila uma única vez com campusLevel="geral" e chapters gerados do mapa', () => {
    const allIds = MEDIO_DEFAULT_MATERIALS.map((m) => m.id);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const id of EXPECTED_APOSTILA_IDS) {
      const mat = MEDIO_DEFAULT_MATERIALS.find((m) => m.id === id);
      expect(mat).toBeDefined();
      expect(mat?.campusLevel).toBe('geral');
      expect(mat?.pendingDefinition).not.toBe(true);
      expect(Array.isArray(mat?.chapters)).toBe(true);
      expect(mat?.chapters?.length).toBeGreaterThan(0);
      expect(mat?.chapters).toEqual(APOSTILA_CHAPTERS_BY_MATERIAL[id]);
    }
  });

  it('garante intervalos de página válidos (1 <= startPage <= endPage <= numPages) em marcadores, capítulos e tópicos', () => {
    expect(APOSTILA_MARKERS.length).toBeGreaterThan(200);

    for (const marker of APOSTILA_MARKERS) {
      const maxPages = KNOWN_PAGE_COUNTS[marker.materialId as (typeof EXPECTED_APOSTILA_IDS)[number]];
      expect(maxPages).toBeGreaterThan(0);
      expect(marker.startPage).toBeGreaterThanOrEqual(1);
      expect(marker.endPage).toBeGreaterThanOrEqual(marker.startPage);
      expect(marker.endPage).toBeLessThanOrEqual(maxPages);
    }

    for (const entries of Object.values(APOSTILA_TOPIC_MAP)) {
      for (const entry of entries) {
        const maxPages = KNOWN_PAGE_COUNTS[entry.materialId as (typeof EXPECTED_APOSTILA_IDS)[number]];
        expect(entry.ranges.length).toBeGreaterThan(0);
        for (const r of entry.ranges) {
          expect(r.startPage).toBeGreaterThanOrEqual(1);
          expect(r.endPage).toBeGreaterThanOrEqual(r.startPage);
          expect(r.endPage).toBeLessThanOrEqual(maxPages);
        }
      }
    }
  });

  it('abre "Coesão e Coerência" tanto no Superior quanto no Médio na mesma página exata da mesma apostila', () => {
    const supEntries = getApostilaEntriesForTopic('superior', 'portugues', 'pt_interpretacao_coesao');
    const medEntries = getApostilaEntriesForTopic('medio', 'nm_portugues', 'nm_lp_interpretacao_coesao');

    expect(supEntries.length).toBeGreaterThanOrEqual(2);
    expect(medEntries.length).toBeGreaterThanOrEqual(2);

    const supTeoria = supEntries.find((e) => e.kind === 'teoria');
    const medTeoria = medEntries.find((e) => e.kind === 'teoria');
    expect(supTeoria?.materialId).toBe('nm_mat_local_assistente_impressao');
    expect(medTeoria?.materialId).toBe('nm_mat_local_assistente_impressao');

    const supCoesao = supTeoria?.ranges.find((r) => /coes[aã]o/i.test(r.title));
    const medCoesao = medTeoria?.ranges.find((r) => /coes[aã]o/i.test(r.title));
    expect(supCoesao?.startPage).toBe(97);
    expect(medCoesao?.startPage).toBe(97);

    // Tópico reúne múltiplos marcadores da apostila (Compreensão, Argumentação, Comunicação, Coesão, Significação, Figuras)
    expect(supTeoria?.ranges.length).toBeGreaterThan(3);
    expect(medTeoria?.ranges.length).toBeGreaterThan(3);

    const supQuestoes = supEntries.find((e) => e.kind === 'questoes');
    const medQuestoes = medEntries.find((e) => e.kind === 'questoes');
    expect(supQuestoes?.materialId).toBe('nm_mat_local_assistente_basico_questoes');
    expect(medQuestoes?.materialId).toBe('nm_mat_local_assistente_basico_questoes');
    expect(supQuestoes?.ranges.find((r) => /coes[aã]o/i.test(r.title))?.startPage).toBe(917);
  });

  it('não vincula tópicos específicos de outros cargos não cobertos pela apostila (Elétrica, Hidráulica, Climatização, NRs, Civil)', () => {
    const uncoveredMedio: Array<[string, string]> = [
      ['nm_02_atendimento_telefonia', 'nm_c02_nocoes_telefonia'],
      ['nm_03_eletricidade_hidraulica', 'nm_c03_eletricidade_nr10'],
      ['nm_03_eletricidade_hidraulica', 'nm_c03_hidraulica_sanitaria'],
      ['nm_03_climatizacao_seguranca_patrimonio', 'nm_c03_maquinas_pmoc'],
      ['nm_03_climatizacao_seguranca_patrimonio', 'nm_c03_seguranca_incendio'],
    ];
    for (const [discId, topicId] of uncoveredMedio) {
      expect(getApostilaEntriesForTopic('medio', discId, topicId)).toEqual([]);
    }

    expect(getApostilaEntriesForTopic('superior', 'juridicas_complementares', 'jc_civil_proc_civil')).toEqual([]);
    expect(getApostilaEntriesForTopic('superior', 'juridicas_complementares', 'jc_previdenciario_dh')).toEqual([]);
  });

  it('mantém apenas disciplineIds válidos de cada campus nas entradas do mapa (ignora cronogramas semana_1/2/3)', () => {
    const supDiscIds = new Set(ALEPA_DISCIPLINES.map((d) => d.id));
    const medDiscIds = new Set(ALL_MEDIO_DISCIPLINES.map((d) => d.id));

    for (const key of Object.keys(APOSTILA_TOPIC_MAP)) {
      const [campus, discId] = key.split(':');
      expect(discId).not.toMatch(/^semana_/);
      if (campus === 'superior') {
        expect(supDiscIds.has(discId)).toBe(true);
      } else {
        expect(medDiscIds.has(discId)).toBe(true);
      }
    }
  });

  it('gera apostilaMap.report.md com seções separadas por campus e preserva Materiais 1 e 6 pendentes', () => {
    const reportPath = path.resolve(process.cwd(), 'apostilaMap.report.md');
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, 'utf8');

    expect(report).toContain('Campus 02 — Nível Superior');
    expect(report).toContain('Campus 01 — Nível Médio');
    expect(report).toContain('Tópicos do edital SEM marcador');
    expect(report).toContain('Marcadores SEM tópico em nenhum dos dois campus');
    expect(report).toContain('Casamentos duvidosos — Superior');
    expect(report).toContain('Casamentos duvidosos — Médio');
    expect(report).toContain('sem correspondência esperada');

    const [mat1, mat6] = standardizeMaterialCatalog([
      {
        id: 'pending_mat_1',
        ownerId: 'system',
        title: 'Material #1 — Definição pendente',
        disciplineId: 'portugues',
        fileType: 'pdf',
        institution: 'A definir',
        url: '',
        catalogNumber: 1,
        pendingDefinition: true,
        isShared: true,
        isOfficialContent: false,
      },
      {
        id: 'pending_mat_6',
        ownerId: 'system',
        title: 'Material #6 — Definição pendente',
        disciplineId: 'direito_administrativo',
        fileType: 'pdf',
        institution: 'A definir',
        url: '',
        catalogNumber: 6,
        isShared: true,
        isOfficialContent: false,
      },
    ]);
    expect(isMaterialPendingDefinition(mat1)).toBe(true);
    expect(isMaterialPendingDefinition(mat6)).toBe(true);
    expect(isInAppReadableMaterial(mat1)).toBe(false);
    expect(isInAppReadableMaterial(mat6)).toBe(false);
  });
});
