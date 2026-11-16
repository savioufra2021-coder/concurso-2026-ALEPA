import crypto from 'node:crypto';

export type AiQuotaTier = 'guest' | 'student' | 'staff';

export interface AiTierLimits {
  perMinute: number;
  perDay: number;
}

export const AI_TIER_LIMITS: Record<AiQuotaTier, AiTierLimits> = {
  guest: { perMinute: 8, perDay: 24 },
  student: { perMinute: 20, perDay: 140 },
  staff: { perMinute: 45, perDay: 600 },
};

export interface AiQuotaIdentity {
  key: string;
  tier: AiQuotaTier;
}

export interface AiQuotaDecision {
  allowed: boolean;
  tier: AiQuotaTier;
  minuteUsed: number;
  minuteLimit: number;
  dayUsed: number;
  dayLimit: number;
  retryAfterSeconds: number;
  resetAtIso: string;
  reason?: string;
}

export interface AiUsageSnapshot {
  tier: AiQuotaTier;
  minuteUsed: number;
  minuteLimit: number;
  dayUsed: number;
  dayLimit: number;
  dayRemaining: number;
  cacheHits: number;
  resetAtIso: string;
}

interface QuotaBucket {
  minuteTimestamps: number[];
  dayKey: string;
  dayCount: number;
  cacheHits: number;
}

function getCurrentDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function getNextUtcMidnightIso(nowMs: number): string {
  const d = new Date(nowMs);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

export class AiQuotaManager {
  private buckets = new Map<string, QuotaBucket>();
  private limits: Record<AiQuotaTier, AiTierLimits>;

  constructor(customLimits?: Partial<Record<AiQuotaTier, AiTierLimits>>) {
    this.limits = {
      guest: customLimits?.guest ?? AI_TIER_LIMITS.guest,
      student: customLimits?.student ?? AI_TIER_LIMITS.student,
      staff: customLimits?.staff ?? AI_TIER_LIMITS.staff,
    };
  }

  private getOrResetBucket(key: string, nowMs: number): QuotaBucket {
    const today = getCurrentDayKey(nowMs);
    const minuteStart = nowMs - 60_000;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        minuteTimestamps: [],
        dayKey: today,
        dayCount: 0,
        cacheHits: 0,
      };
      this.buckets.set(key, bucket);
    }
    bucket.minuteTimestamps = bucket.minuteTimestamps.filter((ts) => ts > minuteStart);
    if (bucket.dayKey !== today) {
      bucket.dayKey = today;
      bucket.dayCount = 0;
      bucket.cacheHits = 0;
    }
    return bucket;
  }

  private pruneIfLarge(nowMs: number): void {
    if (this.buckets.size <= 1000) return;
    const today = getCurrentDayKey(nowMs);
    const minuteStart = nowMs - 60_000;
    for (const [k, b] of this.buckets.entries()) {
      if (b.dayKey !== today && b.minuteTimestamps.every((ts) => ts <= minuteStart)) {
        this.buckets.delete(k);
      }
    }
  }

  checkAndConsume(identity: AiQuotaIdentity, nowMs = Date.now()): AiQuotaDecision {
    this.pruneIfLarge(nowMs);
    const bucket = this.getOrResetBucket(identity.key, nowMs);
    const tierLimit = this.limits[identity.tier];
    const resetAtIso = getNextUtcMidnightIso(nowMs);

    if (bucket.minuteTimestamps.length >= tierLimit.perMinute) {
      const oldest = bucket.minuteTimestamps[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
      return {
        allowed: false,
        tier: identity.tier,
        minuteUsed: bucket.minuteTimestamps.length,
        minuteLimit: tierLimit.perMinute,
        dayUsed: bucket.dayCount,
        dayLimit: tierLimit.perDay,
        retryAfterSeconds,
        resetAtIso,
        reason: 'Muitas solicitações à IA em sequência. Aguarde alguns segundos antes de enviar outra consulta.',
      };
    }

    if (bucket.dayCount >= tierLimit.perDay) {
      const retryAfterSeconds = Math.max(60, Math.ceil((Date.parse(resetAtIso) - nowMs) / 1000));
      return {
        allowed: false,
        tier: identity.tier,
        minuteUsed: bucket.minuteTimestamps.length,
        minuteLimit: tierLimit.perMinute,
        dayUsed: bucket.dayCount,
        dayLimit: tierLimit.perDay,
        retryAfterSeconds,
        resetAtIso,
        reason:
          identity.tier === 'guest'
            ? 'Limite diário para visitante atingido. Entre com sua conta Google/ALEPA para ampliar sua cota diária.'
            : 'Cota diária de uso de IA atingida para hoje. O saldo será renovado à 00:00 UTC.',
      };
    }

    bucket.minuteTimestamps.push(nowMs);
    bucket.dayCount += 1;

    return {
      allowed: true,
      tier: identity.tier,
      minuteUsed: bucket.minuteTimestamps.length,
      minuteLimit: tierLimit.perMinute,
      dayUsed: bucket.dayCount,
      dayLimit: tierLimit.perDay,
      retryAfterSeconds: 0,
      resetAtIso,
    };
  }

  recordCacheHit(identity: AiQuotaIdentity, nowMs = Date.now()): void {
    const bucket = this.getOrResetBucket(identity.key, nowMs);
    bucket.cacheHits += 1;
  }

  getUsage(identity: AiQuotaIdentity, nowMs = Date.now()): AiUsageSnapshot {
    const bucket = this.getOrResetBucket(identity.key, nowMs);
    const tierLimit = this.limits[identity.tier];
    return {
      tier: identity.tier,
      minuteUsed: bucket.minuteTimestamps.length,
      minuteLimit: tierLimit.perMinute,
      dayUsed: bucket.dayCount,
      dayLimit: tierLimit.perDay,
      dayRemaining: Math.max(0, tierLimit.perDay - bucket.dayCount),
      cacheHits: bucket.cacheHits,
      resetAtIso: getNextUtcMidnightIso(nowMs),
    };
  }
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class AiResponseCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 150, ttlMs = 30 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  static buildKey(route: string, payload: unknown): string {
    const hash = crypto
      .createHash('sha256')
      .update(route)
      .update('\n')
      .update(JSON.stringify(payload))
      .digest('hex');
    return `${route}:${hash}`;
  }

  get(key: string, nowMs = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= nowMs) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, nowMs = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: nowMs + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export interface ExtractedQuestionCandidate {
  topicTitle?: string;
  statement?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  legalBasis?: string;
  sourcePage?: number;
  sourceExcerpt?: string;
  confidence?: number;
}

export interface ValidatedExtractedQuestion {
  topicTitle: string;
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  legalBasis?: string;
  sourcePage?: number;
  sourceExcerpt?: string;
  needsReview: boolean;
  reviewFlags: string[];
}

function normalizeStatementForDup(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter((w) => w.length >= 4));
  const wordsB = new Set(b.split(' ').filter((w) => w.length >= 4));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection += 1;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateExtractedQuestions(
  candidates: ExtractedQuestionCandidate[],
  options?: {
    existingStatements?: string[];
    validPageNumbers?: number[];
  }
): ValidatedExtractedQuestion[] {
  const existingNormalized = (options?.existingStatements || [])
    .map(normalizeStatementForDup)
    .filter((s) => s.length >= 16);
  const validPagesSet =
    options?.validPageNumbers && options.validPageNumbers.length > 0
      ? new Set(options.validPageNumbers)
      : null;

  const seenInBatch: string[] = [];
  const results: ValidatedExtractedQuestion[] = [];

  for (const raw of candidates.slice(0, 15)) {
    const reviewFlags: string[] = [];
    const statement = String(raw.statement || '').trim().slice(0, 1800);
    const topicTitle = String(raw.topicTitle || 'Tópico Geral do Material').trim().slice(0, 160);
    const rawOpts = Array.isArray(raw.options)
      ? raw.options.map((o) => String(o || '').trim().slice(0, 420)).filter(Boolean)
      : [];

    if (statement.length < 25) {
      reviewFlags.push('short_statement');
    }

    const paddedOptions = [...rawOpts.slice(0, 5)];
    if (paddedOptions.length < 5) {
      reviewFlags.push('incomplete_options');
      while (paddedOptions.length < 5) {
        paddedOptions.push(`Alternativa ${String.fromCharCode(65 + paddedOptions.length)} (completar na revisão)`);
      }
    }

    let correctIndex =
      typeof raw.correctIndex === 'number' && Number.isInteger(raw.correctIndex)
        ? raw.correctIndex
        : 0;
    if (correctIndex < 0 || correctIndex > 4) {
      correctIndex = 0;
      reviewFlags.push('invalid_answer_key');
    }

    const explanation = String(raw.explanation || '').trim().slice(0, 1500);
    if (explanation.length < 15) {
      reviewFlags.push('missing_explanation');
    }

    const legalBasis = raw.legalBasis ? String(raw.legalBasis).trim().slice(0, 280) : undefined;
    const sourceExcerpt = raw.sourceExcerpt
      ? String(raw.sourceExcerpt).trim().slice(0, 400)
      : undefined;

    let sourcePage: number | undefined;
    if (typeof raw.sourcePage === 'number' && Number.isInteger(raw.sourcePage) && raw.sourcePage >= 1) {
      if (!validPagesSet || validPagesSet.has(raw.sourcePage)) {
        sourcePage = raw.sourcePage;
      } else {
        reviewFlags.push('unconfirmed_page');
      }
    } else if (validPagesSet) {
      reviewFlags.push('unconfirmed_page');
    }

    if (typeof raw.confidence === 'number' && raw.confidence < 0.7) {
      reviewFlags.push('low_confidence');
    }

    const normalized = normalizeStatementForDup(statement);
    if (normalized.length >= 16) {
      const isDuplicateExisting = existingNormalized.some(
        (ex) => ex === normalized || jaccardSimilarity(ex, normalized) >= 0.78
      );
      const isDuplicateBatch = seenInBatch.some(
        (seen) => seen === normalized || jaccardSimilarity(seen, normalized) >= 0.78
      );
      if (isDuplicateExisting || isDuplicateBatch) {
        reviewFlags.push('possible_duplicate');
      }
      seenInBatch.push(normalized);
    }

    results.push({
      topicTitle,
      statement,
      options: paddedOptions,
      correctIndex,
      explanation: explanation || 'Comentário pendente de revisão editorial.',
      legalBasis,
      sourcePage,
      sourceExcerpt,
      needsReview: true, // Always requires human editorial review before publishing
      reviewFlags: Array.from(new Set(reviewFlags)),
    });
  }

  return results;
}
