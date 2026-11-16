import { LastStudiedContext, MaterialRelevanceTier, SpacedRepetitionConfig, StudyMaterial } from '../types';

export function normalizeUrlInput(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('local://') || trimmed.startsWith('spotify:')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function extractYouTubeId(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const pathMatch = url.match(/youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
  if (pathMatch) return pathMatch[1];
  return null;
}

export function formatSafePublicUrl(rawUrl: string): string | null {
  const normalized = normalizeUrlInput(rawUrl);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(rawUrl: string): boolean {
  return Boolean(formatSafePublicUrl(rawUrl));
}

export function getVideoEmbedInfo(rawUrl: string): { platform: string; embedUrl: string | null } {
  const ytId = extractYouTubeId(rawUrl);
  if (ytId) {
    return { platform: 'YouTube', embedUrl: `https://www.youtube.com/embed/${ytId}` };
  }
  const spotifyMatch = rawUrl.match(/open\.spotify\.com\/(episode|show|playlist|track)\/([a-zA-Z0-9]+)/i);
  if (spotifyMatch) {
    return {
      platform: 'Spotify',
      embedUrl: `https://open.spotify.com/embed/${spotifyMatch[1].toLowerCase()}/${spotifyMatch[2]}`,
    };
  }
  const vimeoMatch = rawUrl.match(/vimeo\.com\/(\d+)/i);
  if (vimeoMatch) {
    return { platform: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }
  return { platform: 'Externo', embedUrl: null };
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDurationSeconds(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function inferMaterialRelevance(mat: StudyMaterial): MaterialRelevanceTier {
  if (mat.relevanceTier) return mat.relevanceTier;
  if (
    mat.isOfficialContent ||
    mat.resourceType === 'legislacao' ||
    /edital|anexo|regimento|constitui|cetap|alepa/i.test(`${mat.title} ${mat.institution || ''}`)
  ) {
    return 'essencial';
  }
  if (mat.resourceType === 'curso' || mat.resourceType === 'livro_digital' || /scielo|bdtd|oasis|capes/i.test(mat.url)) {
    return 'aprofundamento';
  }
  return 'complementar';
}

const LAST_STUDIED_KEY = 'alepa_last_studied_v1';
const SPACED_CONFIG_KEY = 'alepa_spaced_rep_v1';

export function saveLastStudiedContext(ctx: Omit<LastStudiedContext, 'updatedAt'>): void {
  try {
    const payload: LastStudiedContext = {
      ...ctx,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LAST_STUDIED_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function loadLastStudiedContext(): LastStudiedContext | null {
  try {
    const raw = localStorage.getItem(LAST_STUDIED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastStudiedContext>;
    if (!parsed || typeof parsed.label !== 'string' || typeof parsed.section !== 'string') return null;
    return parsed as LastStudiedContext;
  } catch {
    return null;
  }
}

export const SPACED_REPETITION_PRESETS: Record<
  SpacedRepetitionConfig['preset'],
  { label: string; description: string; intervals: [number, number, number, number] }
> = {
  padrao: {
    label: 'Padrão (1 · 7 · 15 · 30 dias)',
    description: 'Ciclo clássico de consolidação até a prova CETAP.',
    intervals: [1, 7, 15, 30],
  },
  intensivo: {
    label: 'Reta Final (1 · 3 · 7 · 14 dias)',
    description: 'Ciclos mais curtos para matérias de alta incidência ou próximas da prova.',
    intervals: [1, 3, 7, 14],
  },
  estendido: {
    label: 'Longo Prazo (2 · 10 · 21 · 45 dias)',
    description: 'Espaçamento maior para tópicos já consolidados.',
    intervals: [2, 10, 21, 45],
  },
};

export function loadSpacedRepetitionConfig(): SpacedRepetitionConfig {
  try {
    const raw = localStorage.getItem(SPACED_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SpacedRepetitionConfig>;
      if (
        parsed.preset &&
        Array.isArray(parsed.intervals) &&
        parsed.intervals.length === 4 &&
        parsed.intervals.every((n) => typeof n === 'number' && n >= 1 && n <= 90)
      ) {
        return {
          preset: parsed.preset,
          intervals: parsed.intervals as [number, number, number, number],
        };
      }
    }
  } catch {
    // ignore
  }
  return { preset: 'padrao', intervals: [1, 7, 15, 30] };
}

export function saveSpacedRepetitionConfig(cfg: SpacedRepetitionConfig): void {
  try {
    localStorage.setItem(SPACED_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}
