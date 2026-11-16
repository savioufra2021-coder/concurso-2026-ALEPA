import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server';
import {
  AiQuotaManager,
  AiResponseCache,
  validateExtractedQuestions,
} from './quotaAndCache';

describe('AI quota, cache, question validation & server RBAC/SSRF routes', () => {
  describe('AiQuotaManager', () => {
    it('enforces tiered per-minute and daily limits across guest, student, and staff', () => {
      const manager = new AiQuotaManager({
        guest: { perMinute: 2, perDay: 3 },
        student: { perMinute: 3, perDay: 5 },
        staff: { perMinute: 5, perDay: 10 },
      });

      const guest = { key: 'ip:198.51.100.1', tier: 'guest' as const };
      const t0 = Date.UTC(2026, 10, 15, 10, 0, 0);

      expect(manager.checkAndConsume(guest, t0).allowed).toBe(true);
      expect(manager.checkAndConsume(guest, t0 + 1000).allowed).toBe(true);

      // 3rd request within 1 minute hits perMinute cap
      const minuteBlocked = manager.checkAndConsume(guest, t0 + 2000);
      expect(minuteBlocked.allowed).toBe(false);
      expect(minuteBlocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      // Next minute allows 3rd daily request, then 4th hits perDay cap
      const t1 = t0 + 61_000;
      expect(manager.checkAndConsume(guest, t1).allowed).toBe(true);
      const dayBlocked = manager.checkAndConsume(guest, t1 + 1000);
      expect(dayBlocked.allowed).toBe(false);
      expect(dayBlocked.reason).toContain('visitante');

      // Resets cleanly on next UTC day
      const nextDay = Date.UTC(2026, 10, 16, 0, 1, 0);
      const resetSnap = manager.getUsage(guest, nextDay);
      expect(resetSnap.dayUsed).toBe(0);
      expect(resetSnap.dayRemaining).toBe(3);

      // Student and staff have higher defaults
      const defaultManager = new AiQuotaManager();
      expect(defaultManager.getUsage({ key: 'uid:u1', tier: 'guest' }).dayLimit).toBe(24);
      expect(defaultManager.getUsage({ key: 'uid:u2', tier: 'student' }).dayLimit).toBe(140);
      expect(defaultManager.getUsage({ key: 'uid:u3', tier: 'staff' }).dayLimit).toBe(600);
    });
  });

  describe('AiResponseCache', () => {
    it('computes deterministic SHA-256 keys, expires TTL, and evicts LRU entries', () => {
      const k1 = AiResponseCache.buildKey('prof', { a: 1, b: 'limpe' });
      const k2 = AiResponseCache.buildKey('prof', { a: 1, b: 'limpe' });
      const k3 = AiResponseCache.buildKey('prof', { a: 2, b: 'limpe' });
      expect(k1).toBe(k2);
      expect(k1).not.toBe(k3);

      const cache = new AiResponseCache<string>(2, 1000);
      cache.set('kA', 'valA', 100);
      cache.set('kB', 'valB', 100);
      // Access kA to make kB least recently used
      expect(cache.get('kA', 200)).toBe('valA');
      cache.set('kC', 'valC', 200);

      expect(cache.get('kB', 300)).toBeNull();
      expect(cache.get('kA', 300)).toBe('valA');
      expect(cache.get('kC', 300)).toBe('valC');

      // Expires after TTL
      expect(cache.get('kA', 1200)).toBeNull();
    });
  });

  describe('validateExtractedQuestions', () => {
    it('enforces 5 options, human review flag, unconfirmed_page, and duplicate detection', () => {
      const existing = [
        'Segundo a Lei Estadual nº 5.810/1994, a posse ocorrerá no prazo de trinta dias contados da publicação do ato de provimento.',
      ];

      const validated = validateExtractedQuestions(
        [
          {
            topicTitle: 'Provimento e Posse',
            statement:
              'Segundo a Lei Estadual nº 5.810/1994, a posse ocorrerá no prazo de trinta dias contados da publicação do ato de provimento no Diário Oficial.',
            options: ['30 dias', '15 dias', '60 dias'],
            correctIndex: 9,
            explanation: 'Curta',
            sourcePage: 99,
            confidence: 0.5,
          },
          {
            topicTitle: 'Quórum Regimental',
            statement:
              'Conforme o Regimento Interno da Assembleia Legislativa do Estado do Pará, as sessões ordinárias exigem presença mínima regimental.',
            options: ['Alt A', 'Alt B', 'Alt C', 'Alt D', 'Alt E'],
            correctIndex: 2,
            explanation: 'O artigo do Regimento Interno detalha o quórum mínimo de abertura.',
            sourcePage: 12,
            sourceExcerpt: 'Art. X. A sessão será aberta com quórum mínimo...',
            confidence: 0.92,
          },
        ],
        {
          existingStatements: existing,
          validPageNumbers: [10, 11, 12],
        }
      );

      expect(validated).toHaveLength(2);

      // Candidate 1 should be sanitized and heavily flagged
      const first = validated[0];
      expect(first.needsReview).toBe(true);
      expect(first.options).toHaveLength(5);
      expect(first.correctIndex).toBe(0);
      expect(first.sourcePage).toBeUndefined();
      expect(first.reviewFlags).toEqual(
        expect.arrayContaining([
          'incomplete_options',
          'invalid_answer_key',
          'missing_explanation',
          'unconfirmed_page',
          'low_confidence',
          'possible_duplicate',
        ])
      );

      // Candidate 2 retains verified page and still enforces human review
      const second = validated[1];
      expect(second.needsReview).toBe(true);
      expect(second.sourcePage).toBe(12);
      expect(second.correctIndex).toBe(2);
      expect(second.reviewFlags).toEqual([]);
    });
  });

  describe('Express app security & quota route integration', () => {
    let server: http.Server;
    let baseUrl: string;

    beforeAll(async () => {
      const app = await createApp({ enableVite: false });
      server = http.createServer(app);
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    });

    it('returns guest quota usage on GET /api/ai/usage', async () => {
      const res = await fetch(`${baseUrl}/api/ai/usage`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        authenticated: boolean;
        role: string;
        usage: { tier: string; dayLimit: number; dayRemaining: number };
      };
      expect(body.authenticated).toBe(false);
      expect(body.role).toBe('guest');
      expect(body.usage.tier).toBe('guest');
      expect(body.usage.dayLimit).toBe(24);
      expect(body.usage.dayRemaining).toBe(24);
    });

    it('rejects unauthenticated staff question extraction', async () => {
      const res = await fetch(`${baseUrl}/api/ai/extract-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: [{ pageNumber: 1, text: 'Art. 37 da CF estabelece o princípio da legalidade.' }],
        }),
      });
      expect(res.status).toBe(401);
    });

    it('blocks SSRF metadata probe on /api/materials/pdf-proxy', async () => {
      const res = await fetch(
        `${baseUrl}/api/materials/pdf-proxy?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}`
      );
      expect(res.status).toBe(403);
    });

    it('blocks non-allowlisted HTML host on /api/materials/reader-proxy', async () => {
      const res = await fetch(
        `${baseUrl}/api/materials/reader-proxy?kind=html&url=${encodeURIComponent('https://evil.example.com/secret')}`
      );
      expect(res.status).toBe(403);
    });
  });
});
