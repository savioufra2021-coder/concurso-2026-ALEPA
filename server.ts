import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SsrfValidationError,
  RemoteSizeLimitError,
  assertSafeRemoteUrl,
  normalizeRemoteUrlInput,
  safeFetchRemoteDocument,
  isPdfMagicBuffer,
  isZipMagicBuffer,
  looksLikeHtmlBuffer,
  decodeHtmlBuffer,
  extractStructuredHtmlPortal,
} from './server/security/safeFetch.ts';
import {
  AiQuotaManager,
  AiResponseCache,
  validateExtractedQuestions,
  type AiQuotaIdentity,
  type AiQuotaTier,
  type ExtractedQuestionCandidate,
} from './server/ai/quotaAndCache.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
].join(' ');

const pendingSpotifyStates = new Map<string, { createdAt: number; redirectUri: string }>();

function getSpotifyCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID?.trim() || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() || '',
  };
}

function getSpotifyRedirectUri(): string {
  const baseUrl = (process.env.APP_URL?.trim() || `http://localhost:${PORT}`).replace(/\/+$/, '');
  return `${baseUrl}/api/spotify/callback`;
}

function cleanupExpiredSpotifyStates(): void {
  const now = Date.now();
  for (const [stateKey, info] of pendingSpotifyStates.entries()) {
    if (now - info.createdAt > 15 * 60 * 1000) {
      pendingSpotifyStates.delete(stateKey);
    }
  }
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function extractSpotifyBearer(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function fetchSpotifyApi<T = unknown>(
  endpointPath: string,
  accessToken: string
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const url = endpointPath.startsWith('http')
    ? endpointPath
    : `https://api.spotify.com/v1${endpointPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 401) {
    return { ok: false, status: 401, error: 'SPOTIFY_TOKEN_EXPIRED' };
  }

  if (!res.ok) {
    let errMessage = `Erro na API do Spotify (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } | string };
      if (typeof errJson.error === 'string') {
        errMessage = errJson.error;
      } else if (errJson.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    return { ok: false, status: res.status, error: errMessage };
  }

  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}

let cachedSpotifyAppToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyAppToken(): Promise<string | null> {
  const { clientId, clientSecret } = getSpotifyCredentials();
  if (!clientId || !clientSecret) return null;

  if (cachedSpotifyAppToken && Date.now() < cachedSpotifyAppToken.expiresAt - 30_000) {
    return cachedSpotifyAppToken.token;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    cachedSpotifyAppToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    };
    return cachedSpotifyAppToken.token;
  } catch {
    return null;
  }
}

function isValidSpotifyId(kind: string, id: string): boolean {
  if (!id || id.length > 80 || id === '.' || id === '..' || id.includes('..')) {
    return false;
  }
  if (kind === 'user') {
    return /^[a-zA-Z0-9._-]+$/.test(id);
  }
  return /^[a-zA-Z0-9]+$/.test(id);
}

export function parseSpotifyTarget(raw: string): {
  kind: 'user' | 'episode' | 'show' | 'playlist' | 'track' | 'album' | 'home' | 'unknown';
  id: string | null;
  canonicalUrl: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', id: null, canonicalUrl: '' };

  const uriMatch = trimmed.match(/^spotify:(user|episode|show|playlist|track|album):([a-zA-Z0-9._-]+)$/i);
  if (uriMatch) {
    const kind = uriMatch[1].toLowerCase() as 'user' | 'episode' | 'show' | 'playlist' | 'track' | 'album';
    const id = uriMatch[2];
    if (!isValidSpotifyId(kind, id)) {
      return { kind: 'unknown', id: null, canonicalUrl: '' };
    }
    return { kind, id, canonicalUrl: `https://open.spotify.com/${kind}/${encodeURIComponent(id)}` };
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return { kind: 'unknown', id: null, canonicalUrl: '' };
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== 'open.spotify.com' && host !== 'play.spotify.com') {
    return { kind: 'unknown', id: null, canonicalUrl: '' };
  }

  const cleanPath = parsedUrl.pathname.replace(/^\/intl-[a-z-]+(?=\/|$)/i, '');
  if (!cleanPath || cleanPath === '/') {
    return { kind: 'home', id: null, canonicalUrl: 'https://open.spotify.com/' };
  }

  const itemMatch = cleanPath.match(/^\/(user|episode|show|playlist|track|album)\/([a-zA-Z0-9._-]+)(?:\/)?$/i);
  if (itemMatch) {
    const kind = itemMatch[1].toLowerCase() as 'user' | 'episode' | 'show' | 'playlist' | 'track' | 'album';
    const id = itemMatch[2];
    if (!isValidSpotifyId(kind, id)) {
      return { kind: 'unknown', id: null, canonicalUrl: '' };
    }
    return { kind, id, canonicalUrl: `https://open.spotify.com/${kind}/${encodeURIComponent(id)}` };
  }

  return { kind: 'unknown', id: null, canonicalUrl: '' };
}

async function readBoundedTextResponse(res: globalThis.Response, maxBytes = 512 * 1024): Promise<string> {
  const contentLength = Number(res.headers.get('content-length') || '0');
  if (contentLength > maxBytes) {
    throw new Error('Resposta excede o tamanho máximo permitido.');
  }
  if (!res.body) {
    const txt = await res.text();
    return txt.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractYouTubeId(rawUrl: string): string | null {
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

type StaffRole = 'admin' | 'editor' | 'teacher' | 'dev';
type EffectiveUserRole = StaffRole | 'student';

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  role: EffectiveUserRole;
}

interface AuthenticatedRequest extends Request {
  authUser?: VerifiedFirebaseUser;
}

const PRIMARY_ADMIN_EMAILS = new Set([
  'saviobaia6@gmail.com',
  'saviobaiax5@gmail.com',
  'legcmp.dle@gmail.com',
  'alfaservicosgraficosx5@gmail.com',
]);

function loadFirebaseAppletConfig(): { projectId: string; firestoreDatabaseId: string; storageBucket: string } {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string; firestoreDatabaseId?: string; storageBucket?: string };
    return {
      projectId: parsed.projectId || '',
      firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
      storageBucket: parsed.storageBucket || '',
    };
  } catch {
    return { projectId: '', firestoreDatabaseId: '(default)', storageBucket: '' };
  }
}

const FIREBASE_APPLET_CONFIG = loadFirebaseAppletConfig();
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedFirebaseCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedFirebaseCerts && Date.now() < cachedFirebaseCerts.expiresAt) {
    return cachedFirebaseCerts.certs;
  }

  const res = await fetch(FIREBASE_CERTS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter chaves públicas do Firebase (${res.status})`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedFirebaseCerts = {
    certs,
    expiresAt: Date.now() + Math.max(60, maxAgeSec - 30) * 1000,
  };
  return certs;
}

function normalizeServerRole(rawRole?: string | null, email?: string): EffectiveUserRole {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (normalizedEmail && PRIMARY_ADMIN_EMAILS.has(normalizedEmail)) {
    return rawRole === 'dev' ? 'dev' : 'admin';
  }
  if (rawRole === 'admin' || rawRole === 'dev' || rawRole === 'editor' || rawRole === 'teacher') {
    return rawRole;
  }
  return 'student';
}

async function resolveUserRoleFromFirestore(uid: string, idToken: string, email: string): Promise<EffectiveUserRole> {
  if (!FIREBASE_APPLET_CONFIG.projectId) {
    return normalizeServerRole(null, email);
  }
  try {
    const dbId = encodeURIComponent(FIREBASE_APPLET_CONFIG.firestoreDatabaseId || '(default)');
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_APPLET_CONFIG.projectId)}/databases/${dbId}/documents/users/${encodeURIComponent(uid)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return normalizeServerRole(null, email);
    }
    const doc = (await res.json()) as {
      fields?: { role?: { stringValue?: string } };
    };
    const rawRole = doc.fields?.role?.stringValue || null;
    return normalizeServerRole(rawRole, email);
  } catch {
    return normalizeServerRole(null, email);
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = await getFirebasePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const isValidSig = verifier.verify(certPem, Buffer.from(signatureB64, 'base64url'));
    if (!isValidSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    const projectId = FIREBASE_APPLET_CONFIG.projectId;
    if (!projectId) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
    if (payload.email_verified !== true) return null;

    const email = typeof payload.email === 'string' ? payload.email : '';
    const role = await resolveUserRoleFromFirestore(payload.sub, idToken, email);
    return {
      uid: payload.sub,
      email,
      role,
    };
  } catch {
    return null;
  }
}

function requireRole(allowedRoles: StaffRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSpotifyBearer(req);
    if (!token) {
      res.status(401).json({
        error: 'Autenticação obrigatória para acessar o ambiente administrativo.',
      });
      return;
    }

    const verified = await verifyFirebaseIdToken(token);
    if (!verified) {
      res.status(401).json({
        error: 'Token de sessão inválido, expirado ou com e-mail não verificado.',
      });
      return;
    }

    if (!allowedRoles.includes(verified.role as StaffRole)) {
      res.status(403).json({
        error: 'Acesso negado. Este recurso é exclusivo para Administrador, Editor/Professor ou Desenvolvedor.',
      });
      return;
    }

    (req as AuthenticatedRequest).authUser = verified;
    next();
  };
}

const aiQuotaManager = new AiQuotaManager();
const aiResponseCache = new AiResponseCache(150, 30 * 60 * 1000);

async function attachOptionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    const token = extractSpotifyBearer(req);
    if (token) {
      const verified = await verifyFirebaseIdToken(token);
      if (verified) {
        authReq.authUser = verified;
      }
    }
  }
  next();
}

export function resolveTrustProxyHops(rawValue = process.env.TRUST_PROXY_HOPS): number | string {
  const trimmed = (rawValue ?? '').trim().toLowerCase();
  if (!trimmed) return 1;
  if (trimmed === 'false' || trimmed === 'off' || trimmed === '0') return 0;
  if (trimmed === 'loopback' || trimmed === 'uniquelocal' || trimmed === 'linklocal') {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (Number.isSafeInteger(hops) && hops >= 0 && hops <= 10) {
      return hops;
    }
  }
  return 1;
}

export function normalizeClientIp(rawIp?: string | null): string {
  const trimmed = (rawIp || '').trim();
  if (!trimmed) return 'unknown';
  const withoutZone = trimmed.split('%')[0];
  const normalized = withoutZone.toLowerCase().startsWith('::ffff:')
    ? withoutZone.slice(7)
    : withoutZone;
  return (normalized || 'unknown').slice(0, 64);
}

export function resolveQuotaIdentity(req: Request): AiQuotaIdentity {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (authUser) {
    const tier: AiQuotaTier =
      authUser.role === 'admin' ||
      authUser.role === 'editor' ||
      authUser.role === 'teacher' ||
      authUser.role === 'dev'
        ? 'staff'
        : 'student';
    return {
      key: `uid:${authUser.uid}`,
      tier,
    };
  }
  const ip = normalizeClientIp(req.ip || req.socket?.remoteAddress);
  return {
    key: `ip:${ip}`,
    tier: 'guest',
  };
}

export class ProxyRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(options: { maxRequests: number; windowMs: number; maxKeys?: number }) {
    this.maxRequests = Math.max(1, Math.floor(options.maxRequests));
    this.windowMs = Math.max(1000, Math.floor(options.windowMs));
    this.maxKeys = options.maxKeys ?? 5000;
  }

  consume(
    key: string,
    now = Date.now()
  ): { allowed: boolean; remaining: number; limit: number; retryAfterSeconds: number } {
    const cutoff = now - this.windowMs;
    const prev = this.buckets.get(key) || [];
    const recent = prev.filter((ts) => ts > cutoff);
    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.buckets.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        limit: this.maxRequests,
        retryAfterSeconds,
      };
    }
    recent.push(now);
    if (!this.buckets.has(key) && this.buckets.size >= this.maxKeys) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }
    this.buckets.set(key, recent);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      limit: this.maxRequests,
      retryAfterSeconds: 0,
    };
  }
}

function createProxyRateLimitMiddleware(limiter: ProxyRateLimiter, message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUser = (req as AuthenticatedRequest).authUser;
    const key = authUser
      ? `uid:${authUser.uid}`
      : `ip:${normalizeClientIp(req.ip || req.socket?.remoteAddress)}`;
    const decision = limiter.consume(key);
    res.setHeader('X-Proxy-RateLimit-Limit', String(decision.limit));
    res.setHeader('X-Proxy-RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json({
        kind: 'rate_limited',
        error: message,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
      return;
    }
    next();
  };
}

export function buildCspHeader(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://accounts.google.com blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' blob: data: https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://*.firebaseapp.com https://firebasestorage.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://open.spotify.com https://api.spotify.com",
    "frame-src 'self' https://drive.google.com https://docs.google.com https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://accounts.google.com https://*.firebaseapp.com",
    "form-action 'self' https://accounts.spotify.com https://accounts.google.com",
  ].join('; ');
}

function geminiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const identity = resolveQuotaIdentity(req);
  const decision = aiQuotaManager.checkAndConsume(identity);

  res.setHeader('X-AI-Quota-Tier', decision.tier);
  res.setHeader('X-AI-Quota-Limit', String(decision.dayLimit));
  res.setHeader('X-AI-Quota-Remaining', String(Math.max(0, decision.dayLimit - decision.dayUsed)));

  if (!decision.allowed) {
    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    res.status(429).json({
      error: decision.reason || 'Limite de uso de IA atingido. Tente novamente em instantes.',
      quota: decision,
    });
    return;
  }
  next();
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage === 'GEMINI_KEY_MISSING') {
    return {
      status: 503,
      message:
        'A chave da API Gemini ainda não está disponível neste ambiente. Verifique o painel Settings > Secrets.',
    };
  }
  const lower = rawMessage.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return {
      status: 400,
      message: 'A chave da API Gemini configurada está inválida. Verifique no painel Settings > Secrets.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Permissão negada ao acessar o Gemini. Verifique a chave configurada em Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Limite temporário de uso da API Gemini atingido. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Modelo ou recurso não encontrado no Gemini. Tente novamente em instantes.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Não foi possível gerar o resumo com o Gemini agora.',
  };
}

function extractGroundingLinks(response: unknown): Array<{ title: string; uri: string }> {
  const res = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const links: Array<{ title: string; uri: string }> = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      links.push({
        uri,
        title: chunk.web?.title || uri,
      });
    }
  }
  return links;
}

const VIDEO_SYSTEM_INSTRUCTION = `Você é um tutor especialista em concursos públicos brasileiros (especialmente ALEPA 2026 · Banca Fundação CETAP).
Sua tarefa é resumir o conteúdo de videoaulas em português do Brasil claro, objetivo e didático para estudo rápido.

Formato recomendado (use quando os tempos e tópicos estiverem disponíveis no vídeo ou na transcrição):
1. Comece com um parágrafo curto de abertura explicando o tema central e eventuais mnemônicos (ex.: "O vídeo explica ... (0:00-0:37).").
2. Liste os principais tópicos em blocos claros no padrão:
   **Nome do Tópico (MM:SS-MM:SS):** Explicação direta, precisa e focada em o que cai em prova.
3. Finalize com uma seção curta **"Pontos de Atenção · Banca CETAP"** com 3 a 5 dicas objetivas de revisão/pegadinhas.

Regras:
- Nunca invente minutagens se elas não puderem ser observadas no vídeo ou no texto enviado; se não houver minutagens exatas disponíveis, organize por tópicos numerados sem inventar horários.
- Seja fiel ao conteúdo jurídico/técnico e destaque artigos constitucionais/legais citados.`;

const PDF_SYSTEM_INSTRUCTION = `Você é um tutor especialista em concursos públicos brasileiros (ALEPA 2026 · Banca Fundação CETAP).
Sua tarefa é resumir apostilas, editais, leis e materiais em PDF em português do Brasil claro e estruturado.

Formato da resposta:
1. **Visão Geral do Documento:** Síntese em 2 a 4 linhas do tema central e objetivo do material.
2. **Resumo Estruturado por Tópicos / Seções:** Organize os principais conceitos, regras, prazos, artigos e definições em tópicos claros com **títulos em negrito**.
3. **Artigos, Prazos e Exceções Importantes:** Liste números, quóruns, competências ou exceções legais relevantes para questões objetivas.
4. **Resumo Relâmpago para Revisão (CETAP):** 3 a 5 bullets curtos com o que mais costuma ser cobrado em prova.`;

export async function createApp(options?: {
  enableVite?: boolean;
  trustProxyHops?: number | string;
  proxyMaxPerMinute?: number;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set(
    'trust proxy',
    options?.trustProxyHops !== undefined ? options.trustProxyHops : resolveTrustProxyHops()
  );

  const cspHeader = buildCspHeader();
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', cspHeader);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  const pdfProxyLimiter = new ProxyRateLimiter({
    maxRequests: options?.proxyMaxPerMinute ?? 60,
    windowMs: 60_000,
  });
  const readerProxyLimiter = new ProxyRateLimiter({
    maxRequests: options?.proxyMaxPerMinute ?? 45,
    windowMs: 60_000,
  });
  const spotifyResolveLimiter = new ProxyRateLimiter({
    maxRequests: options?.proxyMaxPerMinute ?? 30,
    windowMs: 60_000,
  });

  app.use(express.json({ limit: '28mb' }));
  app.use('/api/gemini', attachOptionalAuth, geminiRateLimiter);
  app.use('/api/ai', attachOptionalAuth);
  app.use(
    '/api/materials/pdf-proxy',
    attachOptionalAuth,
    createProxyRateLimitMiddleware(
      pdfProxyLimiter,
      'Muitas solicitações de leitura de PDF em sequência. Aguarde alguns segundos e tente novamente.'
    )
  );
  app.use(
    '/api/materials/reader-proxy',
    attachOptionalAuth,
    createProxyRateLimitMiddleware(
      readerProxyLimiter,
      'Muitas solicitações de leitura no leitor em sequência. Aguarde alguns segundos e tente novamente.'
    )
  );
  app.use(
    '/api/spotify/resolve',
    attachOptionalAuth,
    createProxyRateLimitMiddleware(
      spotifyResolveLimiter,
      'Muitas consultas ao Spotify em sequência. Aguarde alguns segundos e tente novamente.'
    )
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: GEMINI_MODEL });
  });

  app.get('/api/ai/usage', (req: Request, res: Response) => {
    const identity = resolveQuotaIdentity(req);
    const snapshot = aiQuotaManager.getUsage(identity);
    res.json({
      authenticated: Boolean((req as AuthenticatedRequest).authUser),
      role: (req as AuthenticatedRequest).authUser?.role || 'guest',
      usage: snapshot,
    });
  });

  // ---------------------------------------------------------------------------
  // Spotify OAuth & Web API Proxy Routes
  // ---------------------------------------------------------------------------
  app.get('/api/spotify/status', (_req: Request, res: Response) => {
    const { clientId, clientSecret } = getSpotifyCredentials();
    const redirectUri = getSpotifyRedirectUri();
    res.json({
      configured: Boolean(clientId && clientSecret),
      redirectUri,
      scopes: SPOTIFY_SCOPES.split(' '),
    });
  });

  app.get('/api/spotify/auth/url', (_req: Request, res: Response) => {
    const { clientId, clientSecret } = getSpotifyCredentials();
    const redirectUri = getSpotifyRedirectUri();

    if (!clientId || !clientSecret) {
      res.status(503).json({
        configured: false,
        redirectUri,
        error:
          'Credenciais do Spotify (SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET) ainda não configuradas nas variáveis de ambiente.',
      });
      return;
    }

    cleanupExpiredSpotifyStates();
    const state = crypto.randomBytes(24).toString('hex');
    pendingSpotifyStates.set(state, { createdAt: Date.now(), redirectUri });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: SPOTIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
      show_dialog: 'true',
    });

    res.json({
      configured: true,
      redirectUri,
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    });
  });

  const handleSpotifyCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    const sendPopupHtml = (messagePayload: Record<string, unknown>, titleText: string, bodyText: string) => {
      const serialized = serializeForInlineScript(messagePayload);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titleText}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 420px; width: 100%; text-align: center; }
      h1 { font-size: 18px; margin: 0 0 8px; color: #0b3321; }
      p { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
      a { display: inline-block; padding: 10px 16px; background: #0b3321; color: #fff; text-decoration: none; border-radius: 10px; font-size: 13px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${titleText}</h1>
      <p>${bodyText}</p>
      <a href="/">Voltar para o Concurso ALEPA 2026</a>
    </div>
    <script>
      (function () {
        var msg = ${serialized};
        try {
          if (window.opener) {
            window.opener.postMessage(msg, '*');
            window.close();
          }
        } catch (e) {}
      })();
    </script>
  </body>
</html>`);
    };

    if (oauthError) {
      sendPopupHtml(
        { type: 'SPOTIFY_OAUTH_ERROR', error: oauthError },
        'Conexão Spotify cancelada',
        'A autorização foi cancelada ou negada no Spotify. Você pode fechar esta janela e tentar novamente.'
      );
      return;
    }

    cleanupExpiredSpotifyStates();
    const stateRecord = state ? pendingSpotifyStates.get(state) : undefined;
    if (!code || !state || !stateRecord) {
      sendPopupHtml(
        {
          type: 'SPOTIFY_OAUTH_ERROR',
          error: 'Sessão de autenticação expirada ou inválida. Tente conectar novamente.',
        },
        'Sessão expirada',
        'Não foi possível validar o retorno do Spotify. Feche esta janela e clique em "Conectar com Spotify" novamente.'
      );
      return;
    }

    pendingSpotifyStates.delete(state);
    const { clientId, clientSecret } = getSpotifyCredentials();
    if (!clientId || !clientSecret) {
      sendPopupHtml(
        { type: 'SPOTIFY_OAUTH_ERROR', error: 'Credenciais do Spotify não configuradas no servidor.' },
        'Configuração pendente',
        'As credenciais SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET não foram encontradas no servidor.'
      );
      return;
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: stateRecord.redirectUri,
      });

      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        sendPopupHtml(
          {
            type: 'SPOTIFY_OAUTH_ERROR',
            error: tokenJson.error_description || tokenJson.error || 'Falha ao trocar código no Spotify.',
          },
          'Erro ao autenticar no Spotify',
          tokenJson.error_description || 'Não foi possível concluir a autenticação com o Spotify.'
        );
        return;
      }

      const meResult = await fetchSpotifyApi<{
        id: string;
        display_name?: string;
        email?: string;
        product?: string;
        country?: string;
        images?: Array<{ url: string }>;
        external_urls?: { spotify?: string };
      }>('/me', tokenJson.access_token);

      const expiresAt = Date.now() + Math.max(60, (tokenJson.expires_in || 3600) - 60) * 1000;

      sendPopupHtml(
        {
          type: 'SPOTIFY_OAUTH_SUCCESS',
          payload: {
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token || '',
            expiresAt,
            scope: tokenJson.scope || SPOTIFY_SCOPES,
            user: meResult.ok && meResult.data
              ? {
                  id: meResult.data.id,
                  displayName: meResult.data.display_name || meResult.data.id,
                  email: meResult.data.email || '',
                  product: meResult.data.product || 'free',
                  avatarUrl: meResult.data.images?.[0]?.url || '',
                  profileUrl: meResult.data.external_urls?.spotify || 'https://open.spotify.com',
                }
              : null,
          },
        },
        'Spotify conectado!',
        'Sua conta Spotify foi conectada ao Concurso ALEPA 2026. Esta janela será fechada automaticamente.'
      );
    } catch (err) {
      sendPopupHtml(
        {
          type: 'SPOTIFY_OAUTH_ERROR',
          error: err instanceof Error ? err.message : 'Erro interno ao concluir OAuth do Spotify.',
        },
        'Erro na conexão',
        'Ocorreu um erro inesperado ao comunicar com o Spotify. Feche esta janela e tente novamente.'
      );
    }
  };

  app.get(['/api/spotify/callback', '/api/spotify/callback/'], handleSpotifyCallback);

  app.post('/api/spotify/refresh', async (req: Request, res: Response) => {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token não informado.' });
        return;
      }

      const { clientId, clientSecret } = getSpotifyCredentials();
      if (!clientId || !clientSecret) {
        res.status(503).json({ error: 'Credenciais do Spotify não configuradas no servidor.' });
        return;
      }

      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error_description?: string;
        error?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        res.status(401).json({
          error: tokenJson.error_description || tokenJson.error || 'Sessão Spotify expirada. Reconecte sua conta.',
        });
        return;
      }

      const expiresAt = Date.now() + Math.max(60, (tokenJson.expires_in || 3600) - 60) * 1000;
      res.json({
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || refreshToken,
        expiresAt,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao renovar token do Spotify.',
      });
    }
  });

  app.get('/api/spotify/me', async (req: Request, res: Response) => {
    const token = extractSpotifyBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Token do Spotify não enviado.' });
      return;
    }

    const result = await fetchSpotifyApi<{
      id: string;
      display_name?: string;
      email?: string;
      product?: string;
      images?: Array<{ url: string }>;
      external_urls?: { spotify?: string };
    }>('/me', token);

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      id: result.data.id,
      displayName: result.data.display_name || result.data.id,
      email: result.data.email || '',
      product: result.data.product || 'free',
      avatarUrl: result.data.images?.[0]?.url || '',
      profileUrl: result.data.external_urls?.spotify || 'https://open.spotify.com',
    });
  });

  app.get('/api/spotify/search', async (req: Request, res: Response) => {
    const token = extractSpotifyBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Conecte sua conta Spotify para pesquisar.' });
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const types = typeof req.query.type === 'string' && req.query.type.trim()
      ? req.query.type.trim()
      : 'episode,show,playlist,track';

    if (!q) {
      res.status(400).json({ error: 'Informe um termo para pesquisar no Spotify.' });
      return;
    }

    const params = new URLSearchParams({
      q,
      type: types,
      market: 'BR',
      limit: '10',
    });

    const result = await fetchSpotifyApi(`/search?${params.toString()}`, token);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(result.data);
  });

  app.get('/api/spotify/library', async (req: Request, res: Response) => {
    const token = extractSpotifyBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Conecte sua conta Spotify para carregar sua biblioteca.' });
      return;
    }

    const [showsRes, episodesRes, playlistsRes] = await Promise.all([
      fetchSpotifyApi<{ items?: unknown[] }>('/me/shows?limit=20', token),
      fetchSpotifyApi<{ items?: unknown[] }>('/me/episodes?market=BR&limit=20', token),
      fetchSpotifyApi<{ items?: unknown[] }>('/me/playlists?limit=20', token),
    ]);

    if (showsRes.status === 401 || episodesRes.status === 401 || playlistsRes.status === 401) {
      res.status(401).json({ error: 'SPOTIFY_TOKEN_EXPIRED' });
      return;
    }

    res.json({
      shows: showsRes.ok ? showsRes.data?.items || [] : [],
      episodes: episodesRes.ok ? episodesRes.data?.items || [] : [],
      playlists: playlistsRes.ok ? playlistsRes.data?.items || [] : [],
    });
  });

  app.get('/api/spotify/shows/:id/episodes', async (req: Request, res: Response) => {
    const token = extractSpotifyBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Token do Spotify não enviado.' });
      return;
    }

    const showId = encodeURIComponent(String(req.params.id || '').trim());
    const result = await fetchSpotifyApi<{ items?: unknown[] }>(
      `/shows/${showId}/episodes?market=BR&limit=20`,
      token
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ items: result.data?.items || [] });
  });

  app.get('/api/spotify/users/:userId/playlists', async (req: Request, res: Response) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      res.status(400).json({ error: 'ID de usuário do Spotify não informado.' });
      return;
    }

    const token = extractSpotifyBearer(req) || (await getSpotifyAppToken());
    if (!token) {
      res.status(200).json({ items: [], requiresAuth: true });
      return;
    }

    const result = await fetchSpotifyApi<{ items?: unknown[] }>(
      `/users/${encodeURIComponent(userId)}/playlists?limit=20`,
      token
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, items: [] });
      return;
    }

    res.json({ items: result.data?.items || [], requiresAuth: false });
  });

  app.get('/api/spotify/resolve', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Informe um link do Spotify para resolver.' });
      return;
    }

    const parsed = parseSpotifyTarget(rawUrl);
    if (parsed.kind === 'home') {
      res.json({
        kind: 'home',
        canonicalUrl: parsed.canonicalUrl,
        title: 'Spotify Web (Brasil / PT)',
      });
      return;
    }

    if (parsed.kind === 'unknown' || !parsed.id) {
      res.status(400).json({
        error:
          'Link do Spotify não reconhecido. Cole um link de perfil (open.spotify.com/user/...), episódio, podcast, playlist ou faixa.',
      });
      return;
    }

    const token = extractSpotifyBearer(req) || (await getSpotifyAppToken());

    if (parsed.kind === 'user') {
      let displayName = parsed.id;
      let avatarUrl = '';
      let playlists: unknown[] = [];

      if (token) {
        const [profileRes, playlistsRes] = await Promise.all([
          fetchSpotifyApi<{
            id: string;
            display_name?: string;
            images?: Array<{ url: string }>;
            external_urls?: { spotify?: string };
          }>(`/users/${encodeURIComponent(parsed.id)}`, token),
          fetchSpotifyApi<{ items?: unknown[] }>(
            `/users/${encodeURIComponent(parsed.id)}/playlists?limit=20`,
            token
          ),
        ]);

        if (profileRes.ok && profileRes.data) {
          displayName = profileRes.data.display_name || parsed.id;
          avatarUrl = profileRes.data.images?.[0]?.url || '';
        }
        if (playlistsRes.ok && playlistsRes.data?.items) {
          playlists = playlistsRes.data.items;
        }
      } else {
        try {
          const pageRes = await fetch(parsed.canonicalUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'error',
            signal: AbortSignal.timeout(8_000),
          });
          if (pageRes.ok) {
            const html = await readBoundedTextResponse(pageRes, 512 * 1024);
            const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
            const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1];
            if (ogTitle) displayName = decodeHtmlEntities(ogTitle);
            if (ogImage && /^https?:\/\//i.test(ogImage)) avatarUrl = ogImage;
          }
        } catch {
          // ignore public html fetch fallback failure
        }
      }

      res.json({
        kind: 'user',
        user: {
          id: parsed.id,
          displayName,
          profileUrl: parsed.canonicalUrl,
          avatarUrl,
        },
        playlists,
        hasApiPlaylists: Boolean(token),
      });
      return;
    }

    // Episode, Show, Playlist, Track, or Album: try Web API first if token available, else Spotify public oEmbed
    if (token) {
      const apiPathMap: Record<'episode' | 'show' | 'playlist' | 'track' | 'album', string> = {
        episode: `/episodes/${encodeURIComponent(parsed.id)}?market=BR`,
        show: `/shows/${encodeURIComponent(parsed.id)}?market=BR`,
        playlist: `/playlists/${encodeURIComponent(parsed.id)}?market=BR`,
        track: `/tracks/${encodeURIComponent(parsed.id)}?market=BR`,
        album: `/albums/${encodeURIComponent(parsed.id)}?market=BR`,
      };
      const apiRes = await fetchSpotifyApi<Record<string, unknown>>(apiPathMap[parsed.kind], token);
      if (apiRes.ok && apiRes.data) {
        const d = apiRes.data;
        const images = (d.images as Array<{ url?: string }> | undefined) ||
          ((d.show as { images?: Array<{ url?: string }> } | undefined)?.images) ||
          ((d.album as { images?: Array<{ url?: string }> } | undefined)?.images);
        const subtitle =
          (d.show as { name?: string } | undefined)?.name ||
          (d.publisher as string | undefined) ||
          ((d.owner as { display_name?: string } | undefined)?.display_name) ||
          ((d.artists as Array<{ name?: string }> | undefined)?.map((a) => a.name).filter(Boolean).join(', ')) ||
          'Spotify';

        res.json({
          kind: 'media',
          item: {
            id: parsed.id,
            kind: parsed.kind === 'album' ? 'playlist' : parsed.kind,
            title: String(d.name || 'Conteúdo Spotify'),
            subtitle: String(subtitle),
            description: typeof d.description === 'string' ? d.description : '',
            url: parsed.canonicalUrl,
            embedUrl: `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}?utm_source=generator`,
            imageUrl: images?.[0]?.url || '',
            durationMs: typeof d.duration_ms === 'number' ? d.duration_ms : undefined,
            releaseDate: typeof d.release_date === 'string' ? d.release_date : undefined,
          },
        });
        return;
      }
    }

    try {
      const oembedRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as {
          title?: string;
          thumbnail_url?: string;
          provider_name?: string;
          iframe_url?: string;
        };
        res.json({
          kind: 'media',
          item: {
            id: parsed.id,
            kind: parsed.kind === 'album' ? 'playlist' : parsed.kind,
            title: oembed.title || `Spotify ${parsed.kind}`,
            subtitle: oembed.provider_name || 'Spotify',
            url: parsed.canonicalUrl,
            embedUrl:
              oembed.iframe_url ||
              `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}?utm_source=generator`,
            imageUrl: oembed.thumbnail_url || '',
          },
        });
        return;
      }
    } catch {
      // fallback below
    }

    res.json({
      kind: 'media',
      item: {
        id: parsed.id,
        kind: parsed.kind === 'album' ? 'playlist' : parsed.kind,
        title: `Conteúdo Spotify (${parsed.kind})`,
        subtitle: 'Spotify',
        url: parsed.canonicalUrl,
        embedUrl: `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}?utm_source=generator`,
      },
    });
  });

  app.post('/api/gemini/summarize-video', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        url?: string;
        title?: string;
        transcriptOrNotes?: string;
        disciplineName?: string;
        customFocus?: string;
      };

      const rawUrl = typeof body.url === 'string' ? normalizeRemoteUrlInput(body.url) : '';
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const transcriptOrNotes =
        typeof body.transcriptOrNotes === 'string' ? body.transcriptOrNotes.trim() : '';
      const disciplineName = typeof body.disciplineName === 'string' ? body.disciplineName.trim() : '';
      const customFocus = typeof body.customFocus === 'string' ? body.customFocus.trim() : '';

      if (!rawUrl && !transcriptOrNotes) {
        res.status(400).json({
          error: 'Informe o link do vídeo (YouTube, Instagram, TikTok) ou cole anotações/transcrição para resumir.',
        });
        return;
      }

      const videoCacheKey = AiResponseCache.buildKey('summarize-video', {
        rawUrl,
        title,
        transcriptOrNotes,
        disciplineName,
        customFocus,
      });
      const cachedVideo = aiResponseCache.get(videoCacheKey);
      if (cachedVideo) {
        aiQuotaManager.recordCacheHit(resolveQuotaIdentity(req));
        res.json({ ...(cachedVideo as Record<string, unknown>), cached: true });
        return;
      }

      const ai = getGeminiClient();
      const ytId = rawUrl ? extractYouTubeId(rawUrl) : null;
      const canonicalYtUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : null;

      const userPromptParts = [
        title ? `Título informado: ${title}` : '',
        disciplineName ? `Disciplina de estudo: ${disciplineName}` : '',
        rawUrl ? `Link do vídeo: ${canonicalYtUrl || rawUrl}` : '',
        customFocus ? `Foco pedido pelo estudante: ${customFocus}` : '',
        transcriptOrNotes
          ? `Anotações / transcrição fornecida pelo estudante:\n${transcriptOrNotes}`
          : 'Gere um resumo didático completo por tópicos (com intervalos de tempo MM:SS-MM:SS sempre que identificáveis no vídeo).',
      ].filter(Boolean);
      const userPrompt = userPromptParts.join('\n\n');

      // 1. Direct multimodal YouTube summarization when a YouTube video ID is present
      if (canonicalYtUrl) {
        try {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    fileData: {
                      fileUri: canonicalYtUrl,
                      mimeType: 'video/mp4',
                    },
                  },
                  { text: userPrompt },
                ],
              },
            ],
            config: {
              systemInstruction: VIDEO_SYSTEM_INSTRUCTION,
            },
          });

          const text = response.text?.trim();
          if (text) {
            const payload = {
              summary: text,
              model: GEMINI_MODEL,
              sourceMode: 'youtube_video',
              sources: [{ title: title || 'Vídeo no YouTube', uri: canonicalYtUrl }],
            };
            aiResponseCache.set(videoCacheKey, payload);
            res.json(payload);
            return;
          }
        } catch (ytErr) {
          console.warn('Fallback após análise direta do YouTube:', ytErr instanceof Error ? ytErr.message : ytErr);
        }
      }

      // 2. Fallback or non-YouTube URL: urlContext + googleSearch, or direct notes summarization
      if (rawUrl) {
        try {
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `${userPrompt}\n\nSe não for possível ler diretamente o áudio/vídeo deste link externo, deixe claro o que pôde ser obtido pela página/pesquisa ou pelas anotações enviadas, e ajude o estudante com uma explicação completa do tema identificado.`,
            config: {
              systemInstruction: VIDEO_SYSTEM_INSTRUCTION,
              tools: [{ urlContext: {} }, { googleSearch: {} }],
            },
          });
          const text = response.text?.trim();
          if (text) {
            const links = extractGroundingLinks(response);
            const payload = {
              summary: text,
              model: GEMINI_MODEL,
              sourceMode: 'url_context',
              sources: links.length > 0 ? links : [{ title: title || 'Link do vídeo', uri: rawUrl }],
            };
            aiResponseCache.set(videoCacheKey, payload);
            res.json(payload);
            return;
          }
        } catch (urlErr) {
          if (!transcriptOrNotes) {
            throw urlErr;
          }
        }
      }

      // 3. Direct summarization from pasted transcript / notes
      const fallbackResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: VIDEO_SYSTEM_INSTRUCTION,
        },
      });

      const notesPayload = {
        summary: fallbackResponse.text?.trim() || 'Não foi possível gerar texto para este vídeo.',
        model: GEMINI_MODEL,
        sourceMode: 'notes_only',
        sources: rawUrl ? [{ title: title || 'Link informado', uri: rawUrl }] : [],
      };
      aiResponseCache.set(videoCacheKey, notesPayload);
      res.json(notesPayload);
    } catch (err) {
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/summarize-pdf', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        fileBase64?: string;
        fileName?: string;
        pdfUrl?: string;
        title?: string;
        disciplineName?: string;
        customFocus?: string;
      };

      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : 'documento.pdf';
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const disciplineName = typeof body.disciplineName === 'string' ? body.disciplineName.trim() : '';
      const customFocus = typeof body.customFocus === 'string' ? body.customFocus.trim() : '';
      const rawPdfUrl = typeof body.pdfUrl === 'string' ? normalizeRemoteUrlInput(body.pdfUrl) : '';
      let base64Data = typeof body.fileBase64 === 'string' ? body.fileBase64.trim() : '';

      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1] || '';
      }

      if (!base64Data && !rawPdfUrl) {
        res.status(400).json({
          error: 'Envie um arquivo PDF ou informe o link do PDF/material para resumir.',
        });
        return;
      }

      const pdfCacheKey =
        !base64Data && rawPdfUrl
          ? AiResponseCache.buildKey('summarize-pdf-url', {
              rawPdfUrl,
              title,
              disciplineName,
              customFocus,
            })
          : null;
      if (pdfCacheKey) {
        const cachedPdf = aiResponseCache.get(pdfCacheKey);
        if (cachedPdf) {
          aiQuotaManager.recordCacheHit(resolveQuotaIdentity(req));
          res.json({ ...(cachedPdf as Record<string, unknown>), cached: true });
          return;
        }
      }

      const ai = getGeminiClient();

      const promptLines = [
        title ? `Título do material: ${title}` : '',
        fileName ? `Arquivo: ${fileName}` : '',
        disciplineName ? `Disciplina: ${disciplineName}` : '',
        customFocus ? `Foco pedido pelo estudante: ${customFocus}` : '',
        'Faça um resumo completo, fiel e bem organizado deste PDF para revisão de concurso.',
      ].filter(Boolean);
      const promptText = promptLines.join('\n');

      // Try fetching remote PDF bytes securely (SSRF-hardened + manual redirect validation + streaming byte cap)
      let fetchedUrlMode: 'pdf_inline' | 'url_context' = 'pdf_inline';
      if (!base64Data && rawPdfUrl) {
        try {
          const remoteDoc = await safeFetchRemoteDocument(rawPdfUrl, {
            maxBytes: 18 * 1024 * 1024,
            timeoutMs: 15_000,
            acceptKind: 'pdf',
            headers: {
              'User-Agent': 'MeuCampusALEPA-GeminiSummarizer/1.0',
              Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
            },
          });

          const looksLikePdf =
            remoteDoc.contentType.includes('application/pdf') || isPdfMagicBuffer(remoteDoc.buffer);
          if (looksLikePdf) {
            base64Data = remoteDoc.buffer.toString('base64');
            fetchedUrlMode = 'pdf_inline';
          } else {
            fetchedUrlMode = 'url_context';
          }
        } catch (err) {
          if (err instanceof SsrfValidationError && (err.status === 400 || err.status === 403)) {
            res.status(err.status).json({ error: err.message });
            return;
          }
          fetchedUrlMode = 'url_context';
        }
      }

      if (base64Data) {
        const approxBytes = Math.floor((base64Data.length * 3) / 4);
        if (approxBytes > 20 * 1024 * 1024) {
          res.status(413).json({
            error: 'O PDF excede o limite de 20 MB para envio direto. Divida o arquivo em partes menores.',
          });
          return;
        }

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          config: {
            systemInstruction: PDF_SYSTEM_INSTRUCTION,
          },
        });

        const payload = {
          summary: response.text?.trim() || 'Não foi possível extrair texto deste PDF.',
          model: GEMINI_MODEL,
          sourceMode: fetchedUrlMode,
          sources: rawPdfUrl ? [{ title: title || fileName, uri: rawPdfUrl }] : [],
        };
        if (pdfCacheKey) {
          aiResponseCache.set(pdfCacheKey, payload);
        }
        res.json(payload);
        return;
      }

      // Fallback to urlContext for web pages / legislation links / Drive preview links
      const urlResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${promptText}\n\nLink do material: ${rawPdfUrl}`,
        config: {
          systemInstruction: PDF_SYSTEM_INSTRUCTION,
          tools: [{ urlContext: {} }],
        },
      });

      const links = extractGroundingLinks(urlResponse);
      const urlPayload = {
        summary: urlResponse.text?.trim() || 'Não foi possível ler o link informado.',
        model: GEMINI_MODEL,
        sourceMode: 'url_context',
        sources: links.length > 0 ? links : [{ title: title || rawPdfUrl, uri: rawPdfUrl }],
      };
      if (pdfCacheKey) {
        aiResponseCache.set(pdfCacheKey, urlPayload);
      }
      res.json(urlPayload);
    } catch (err) {
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        messages?: Array<{ role?: string; text?: string }>;
        contextTitle?: string;
        contextSummary?: string;
        campus?: string;
        libraryContext?: Array<{
          title?: string;
          discipline?: string;
          url?: string;
          excerpt?: string;
        }>;
      };

      const rawMessages = Array.isArray(body.messages) ? body.messages : [];
      const contents = rawMessages
        .filter((m) => typeof m?.text === 'string' && m.text.trim().length > 0)
        .slice(-16)
        .map((m) => ({
          role: m.role === 'model' ? ('model' as const) : ('user' as const),
          parts: [{ text: (m.text || '').trim() }],
        }));

      if (contents.length === 0) {
        res.status(400).json({ error: 'Digite uma pergunta para conversar com o Gemini.' });
        return;
      }

      const ai = getGeminiClient();
      const campusLabel =
        body.campus === 'medio'
          ? 'Nível Médio (Cargo 04 – Assistência Administrativa · PL.AL.060)'
          : 'Nível Superior (Cargo 03 – Assessoramento Legislativo · PL.AL.102)';

      const libraryItems = Array.isArray(body.libraryContext)
        ? body.libraryContext
            .filter((item) => item && typeof item.title === 'string' && item.title.trim())
            .slice(0, 4)
        : [];

      const libraryBlock =
        libraryItems.length > 0
          ? `MATERIAIS DA BIBLIOTECA SELECIONADOS PELO ESTUDANTE (priorize e cite explicitamente o título/página quando responder):\n${libraryItems
              .map(
                (item, idx) =>
                  `[Fonte ${idx + 1}] ${String(item.title).slice(0, 180)}${item.discipline ? ` (${String(item.discipline).slice(0, 80)})` : ''}\n${String(item.excerpt || '').slice(0, 2200)}`
              )
              .join('\n\n')}`
          : '';

      const systemParts = [
        `Você é o assistente de estudos Gemini para o Concurso ALEPA 2026 (Banca Fundação CETAP), foco em ${campusLabel}.`,
        'Responda sempre em português do Brasil de forma clara, estruturada e objetiva.',
        'Jamais invente artigos de lei ou fontes não fornecidas. Se usar materiais da biblioteca selecionados, cite o título da fonte correspondente.',
        body.contextTitle ? `Material em foco: ${body.contextTitle}` : '',
        body.contextSummary
          ? `Use também como referência o resumo já gerado abaixo:\n---\n${body.contextSummary.slice(0, 8000)}\n---`
          : '',
        libraryBlock,
      ].filter(Boolean);

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemParts.join('\n\n'),
        },
      });

      res.json({
        reply: response.text?.trim() || 'Não consegui gerar uma resposta agora.',
        model: GEMINI_MODEL,
        citedTitles: libraryItems.map((i) => i.title),
      });
    } catch (err) {
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/professor', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        action?:
          | 'explain_topic'
          | 'generate_flashcards'
          | 'generate_mindmap'
          | 'generate_questions'
          | 'explain_question'
          | 'revision_plan';
        campus?: string;
        disciplineName?: string;
        topicTitle?: string;
        subtopics?: string[];
        studentNotes?: string;
        questionStatement?: string;
        questionOptions?: string[];
        correctIndex?: number;
        selectedIndex?: number;
        legalBasis?: string;
        weakDisciplinesSummary?: string;
        pendingErrorsSummary?: string;
        questionCount?: number;
      };

      const action = body.action || 'explain_topic';
      const campusLabel =
        body.campus === 'medio'
          ? 'Nível Médio (Edital 001/2026 – Assistente Administrativo / Auxiliar Técnico Legislativo · PL.AL.060)'
          : 'Nível Superior (Edital 002/2026 – Cargo 03 Técnico Legislativo / Analista · PL.AL.102)';
      const disciplineName = (body.disciplineName || '').trim().slice(0, 140);
      const topicTitle = (body.topicTitle || '').trim().slice(0, 220);
      const subtopics = Array.isArray(body.subtopics)
        ? body.subtopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
        : [];
      const studentNotes = (body.studentNotes || '').trim().slice(0, 2000);

      const ai = getGeminiClient();

      const groundingSafetyRule = [
        `Você é o Professor IA do MEU CAMPUS ALEPA 2026 (Banca Fundação CETAP), atuando para o edital de ${campusLabel}.`,
        'Responda sempre em português do Brasil claro, didático, direto e rigoroso.',
        'REGRA DE INTEGRIDADE JURÍDICA: NUNCA invente números de artigos de lei, incisos, leis inexistentes ou datas/prazos sem certeza. Caso mencione alguma norma específica que exija conferência no texto atualizado (como Regimento Interno da ALEPA ou Lei Estadual), oriente explicitamente a conferência no Banco de Leis da ALEPA ou no Planalto.',
      ].join('\n');

      if (action === 'generate_flashcards') {
        if (!topicTitle && !disciplineName) {
          res.status(400).json({ error: 'Informe a disciplina ou assunto para gerar flashcards.' });
          return;
        }
        const prompt = [
          disciplineName ? `Disciplina: ${disciplineName}` : '',
          topicTitle ? `Assunto do Edital: ${topicTitle}` : '',
          subtopics.length ? `Subtópicos: ${subtopics.join('; ')}` : '',
          studentNotes ? `Notas do estudante:\n${studentNotes}` : '',
          'Gere exatamente 6 flashcards de revisão ativa focados em conceitos-chave, distinções e pegadinhas clássicas de prova objetiva (estilo Fundação CETAP).',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: groundingSafetyRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING, description: 'Pergunta curta ou conceito para memorização ativa' },
                  back: { type: Type.STRING, description: 'Resposta objetiva, precisa e didática' },
                  tip: { type: Type.STRING, description: 'Dica rápida ou alerta de pegadinha de banca' },
                },
                required: ['front', 'back'],
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '[]') as Array<{ front: string; back: string; tip?: string }>;
        res.json({ action, flashcards: parsed.slice(0, 8), model: GEMINI_MODEL });
        return;
      }

      if (action === 'generate_mindmap') {
        if (!topicTitle && !disciplineName) {
          res.status(400).json({ error: 'Informe a disciplina ou assunto para gerar o mapa mental.' });
          return;
        }
        const prompt = [
          disciplineName ? `Disciplina: ${disciplineName}` : '',
          topicTitle ? `Assunto central: ${topicTitle}` : '',
          subtopics.length ? `Subtópicos do edital: ${subtopics.join('; ')}` : '',
          'Estruture um mapa mental hierárquico claro em 4 a 6 ramos principais com 3 a 5 palavras-chave/tópicos práticos em cada ramo.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: groundingSafetyRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                centralTopic: { type: Type.STRING },
                branches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      items: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ['title', 'items'],
                  },
                },
              },
              required: ['centralTopic', 'branches'],
            },
          },
        });

        const mindMap = JSON.parse(response.text || '{}');
        res.json({ action, mindMap, model: GEMINI_MODEL });
        return;
      }

      if (action === 'generate_questions') {
        if (!topicTitle && !disciplineName) {
          res.status(400).json({ error: 'Informe a disciplina ou assunto para gerar questões inéditas.' });
          return;
        }
        const count = Math.max(1, Math.min(5, Number(body.questionCount) || 3));
        const prompt = [
          disciplineName ? `Disciplina: ${disciplineName}` : '',
          topicTitle ? `Assunto do Edital: ${topicTitle}` : '',
          subtopics.length ? `Subtópicos: ${subtopics.join('; ')}` : '',
          `Elabore ${count} questões inéditas de múltipla escolha (exatamente 5 alternativas A, B, C, D e E, com apenas 1 correta), no padrão da Fundação CETAP.`,
          'Cada questão deve conter enunciado claro, 5 alternativas distintas, índice da resposta correta (0 a 4), explicação comentada e referência normativa/conceitual real (sem inventar artigos).',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: groundingSafetyRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topicTitle: { type: Type.STRING },
                  statement: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  legalBasis: { type: Type.STRING },
                },
                required: ['topicTitle', 'statement', 'options', 'correctIndex', 'explanation'],
              },
            },
          },
        });

        const rawItems = JSON.parse(response.text || '[]') as Array<{
          topicTitle?: string;
          statement?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
          legalBasis?: string;
        }>;

        const questions = rawItems
          .filter((item) => item.statement && Array.isArray(item.options) && item.options.length === 5)
          .slice(0, 5)
          .map((item, idx) => ({
            id: `ai_q_${Date.now()}_${idx}`,
            topicTitle: (item.topicTitle || topicTitle || disciplineName).slice(0, 200),
            statement: String(item.statement).slice(0, 2400),
            options: item.options!.slice(0, 5).map((o) => String(o).slice(0, 480)),
            correctIndex: Math.max(0, Math.min(4, Number(item.correctIndex) || 0)),
            explanation: String(item.explanation || '').slice(0, 1900),
            legalBasis: item.legalBasis ? String(item.legalBasis).slice(0, 380) : undefined,
            originType: 'ai_generated',
            isOfficial: false,
            source: 'Gerada por IA · Professor Gemini (Treino Inédito)',
          }));

        res.json({ action, questions, model: GEMINI_MODEL });
        return;
      }

      if (action === 'explain_question') {
        const statement = (body.questionStatement || '').trim().slice(0, 2500);
        const options = Array.isArray(body.questionOptions) ? body.questionOptions : [];
        if (!statement || options.length < 2) {
          res.status(400).json({ error: 'Envie o enunciado e as alternativas da questão para explicação.' });
          return;
        }
        const letters = ['A', 'B', 'C', 'D', 'E'];
        const formattedOptions = options
          .slice(0, 5)
          .map((opt, idx) => `${letters[idx] || idx + 1}) ${opt}`)
          .join('\n');
        const correctIdx = typeof body.correctIndex === 'number' ? body.correctIndex : 0;
        const selectedIdx = typeof body.selectedIndex === 'number' ? body.selectedIndex : undefined;

        const prompt = [
          disciplineName ? `Disciplina: ${disciplineName}` : '',
          topicTitle ? `Assunto: ${topicTitle}` : '',
          `Enunciado:\n${statement}`,
          `Alternativas:\n${formattedOptions}`,
          `Gabarito oficial: ${letters[correctIdx] || 'A'}`,
          selectedIdx !== undefined ? `Alternativa marcada pelo aluno: ${letters[selectedIdx]}` : '',
          body.legalBasis ? `Referência: ${body.legalBasis}` : '',
          'Explique: (1) Por que a alternativa correta está certa; (2) Por que cada alternativa incorreta está errada ou traz pegadinha; (3) O ponto-chave para memorizar.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: { systemInstruction: groundingSafetyRule },
        });
        res.json({ action, text: response.text?.trim() || '', model: GEMINI_MODEL });
        return;
      }

      if (action === 'revision_plan') {
        const weakSummary = (body.weakDisciplinesSummary || '').trim().slice(0, 3000);
        const errorSummary = (body.pendingErrorsSummary || '').trim().slice(0, 3000);
        const prompt = [
          'Monte um Plano Personalizado de Revisão para os próximos 7 dias com base exclusivamente nos dados reais do estudante abaixo:',
          weakSummary ? `Desempenho e cobertura por disciplina:\n${weakSummary}` : '',
          errorSummary ? `Erros recentes / revisões pendentes:\n${errorSummary}` : '',
          'Estruture em: (1) Diagnóstico objetivo das prioridades; (2) Plano dia a dia (Dia 1 a Dia 7) alternando revisão ativa, lei seca e baterias curtas; (3) Meta prática mensurável.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: { systemInstruction: groundingSafetyRule },
        });
        res.json({ action, text: response.text?.trim() || '', model: GEMINI_MODEL });
        return;
      }

      // Default: explain_topic
      if (!topicTitle && !disciplineName) {
        res.status(400).json({ error: 'Informe a disciplina ou assunto para explicação.' });
        return;
      }
      const explainPrompt = [
        disciplineName ? `Disciplina: ${disciplineName}` : '',
        topicTitle ? `Assunto do Edital: ${topicTitle}` : '',
        subtopics.length ? `Subtópicos cobrados no edital: ${subtopics.join('; ')}` : '',
        studentNotes ? `Anotações atuais do aluno:\n${studentNotes}` : '',
        'Elabore uma aula escrita completa e objetiva com:',
        '## 1. Conceito Central e Visão Geral',
        '## 2. Pontos-Chave e Subtópicos do Edital',
        '## 3. Como a Banca Fundação CETAP costuma cobrar (Pegadinhas e Exceções)',
        '## 4. Resumo Relâmpago para Revisão',
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: explainPrompt,
        config: { systemInstruction: groundingSafetyRule },
      });
      res.json({ action: 'explain_topic', text: response.text?.trim() || '', model: GEMINI_MODEL });
    } catch (err) {
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ---------------------------------------------------------------------------
  // RBAC-Protected Administrative & Authoring APIs
  // ---------------------------------------------------------------------------
  app.use('/api/admin', geminiRateLimiter);

  app.get(
    '/api/admin/auth-check',
    requireRole(['admin', 'editor', 'dev']),
    (req: Request, res: Response) => {
      const authUser = (req as AuthenticatedRequest).authUser;
      res.json({
        ok: true,
        uid: authUser?.uid,
        email: authUser?.email,
        role: authUser?.role,
      });
    }
  );

  app.post(
    '/api/admin/authoring',
    requireRole(['admin', 'editor', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          action?: 'draft_material_summary' | 'draft_question' | 'draft_topic' | 'draft_notice';
          disciplineName?: string;
          campusLevel?: 'superior' | 'medio' | 'geral';
          title?: string;
          topicTitle?: string;
          contextText?: string;
          url?: string;
        };

        const action = body.action || 'draft_question';
        const disciplineName = (body.disciplineName || '').trim().slice(0, 140);
        const campusLevel = body.campusLevel || 'superior';
        const title = (body.title || '').trim().slice(0, 180);
        const topicTitle = (body.topicTitle || '').trim().slice(0, 180);
        const contextText = (body.contextText || '').trim().slice(0, 4000);
        let safeUrl = '';
        if (body.url && body.url.trim()) {
          const normalized = normalizeRemoteUrlInput(body.url);
          try {
            const parsed = await assertSafeRemoteUrl(normalized);
            safeUrl = parsed.toString();
          } catch {
            safeUrl = '';
          }
        }

        const ai = getGeminiClient();
        const adminSystemRule = `Você é um especialista editorial e conteudista do MEU CAMPUS ALEPA 2026 (Concurso ALEPA 2026, Banca Fundação CETAP, Nível Superior PL.AL.102 e Nível Médio PL.AL.060).
Regras obrigatórias:
- Escreva sempre em português do Brasil claro, preciso e direto.
- Jamais invente números de artigos, leis ou súmulas. Se não tiver certeza da citação exata, mantenha a referência genérica à norma/conteúdo.
- Todo material gerado entra primeiro como rascunho para revisão e pré-visualização do administrador/editor antes de publicar.`;

        if (action === 'draft_material_summary') {
          if (!title && !contextText && !safeUrl) {
            res.status(400).json({ error: 'Informe título, link ou descrição base para gerar o rascunho.' });
            return;
          }

          const prompt = [
            disciplineName ? `Disciplina: ${disciplineName}` : '',
            `Nível: ${campusLevel}`,
            title ? `Título: ${title}` : '',
            safeUrl ? `URL de referência: ${safeUrl}` : '',
            contextText ? `Contexto fornecido pelo editor:\n${contextText}` : '',
            'Gere em JSON: description (resumo didático de 2 a 4 linhas para o cartão do aluno), editalTopic (tópico sugerido do edital), e relevanceTier ("essencial" | "complementar" | "aprofundamento").',
          ]
            .filter(Boolean)
            .join('\n\n');

          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              systemInstruction: adminSystemRule,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  editalTopic: { type: Type.STRING },
                  relevanceTier: { type: Type.STRING },
                },
                required: ['description', 'editalTopic', 'relevanceTier'],
              },
            },
          });

          const draft = JSON.parse(response.text || '{}') as {
            description?: string;
            editalTopic?: string;
            relevanceTier?: string;
          };

          res.json({
            action,
            draft: {
              description: String(draft.description || '').slice(0, 950),
              editalTopic: String(draft.editalTopic || topicTitle || '').slice(0, 220),
              relevanceTier: ['essencial', 'complementar', 'aprofundamento'].includes(String(draft.relevanceTier))
                ? draft.relevanceTier
                : 'essencial',
            },
            model: GEMINI_MODEL,
          });
          return;
        }

        if (action === 'draft_topic') {
          if (!topicTitle && !disciplineName && !contextText) {
            res.status(400).json({ error: 'Informe a disciplina ou tema para estruturar os subtópicos do edital.' });
            return;
          }

          const prompt = [
            disciplineName ? `Disciplina: ${disciplineName}` : '',
            `Escolaridade: ${campusLevel}`,
            topicTitle ? `Título do tópico: ${topicTitle}` : '',
            contextText ? `Texto/base do edital:\n${contextText}` : '',
            'Estruture este tópico em JSON com: title (título limpo e objetivo), subtopics (lista de 4 a 8 subtópicos objetivos cobrados no edital) e highYield (booleano indicando se costuma ter alta cobrança na CETAP).',
          ]
            .filter(Boolean)
            .join('\n\n');

          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              systemInstruction: adminSystemRule,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  highYield: { type: Type.BOOLEAN },
                },
                required: ['title', 'subtopics', 'highYield'],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}') as {
            title?: string;
            subtopics?: string[];
            highYield?: boolean;
          };

          res.json({
            action,
            draft: {
              title: String(parsed.title || topicTitle || 'Novo Tópico do Edital').slice(0, 220),
              subtopics: Array.isArray(parsed.subtopics)
                ? parsed.subtopics.slice(0, 12).map((s) => String(s).trim()).filter(Boolean)
                : [],
              highYield: Boolean(parsed.highYield),
            },
            model: GEMINI_MODEL,
          });
          return;
        }

        if (action === 'draft_notice') {
          if (!title && !contextText) {
            res.status(400).json({ error: 'Informe o assunto ou briefing para redigir o aviso.' });
            return;
          }

          const prompt = [
            `Escolaridade alvo: ${campusLevel}`,
            title ? `Assunto do aviso: ${title}` : '',
            contextText ? `Informações do aviso:\n${contextText}` : '',
            'Redija em JSON um comunicado institucional claro e motivador para os candidatos: title (até 120 caracteres), body (texto claro em 2 a 4 frases), priority ("normal" | "importante" | "urgente").',
          ]
            .filter(Boolean)
            .join('\n\n');

          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              systemInstruction: adminSystemRule,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  body: { type: Type.STRING },
                  priority: { type: Type.STRING },
                },
                required: ['title', 'body', 'priority'],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}') as {
            title?: string;
            body?: string;
            priority?: string;
          };

          res.json({
            action,
            draft: {
              title: String(parsed.title || title || 'Comunicado do Campus').slice(0, 160),
              body: String(parsed.body || '').slice(0, 1800),
              priority: ['normal', 'importante', 'urgente'].includes(String(parsed.priority))
                ? parsed.priority
                : 'importante',
            },
            model: GEMINI_MODEL,
          });
          return;
        }

        // Default: draft_question
        if (!topicTitle && !disciplineName && !contextText) {
          res.status(400).json({ error: 'Informe a disciplina, assunto ou texto base para elaborar a questão.' });
          return;
        }

        const prompt = [
          disciplineName ? `Disciplina: ${disciplineName}` : '',
          `Escolaridade: ${campusLevel}`,
          topicTitle ? `Assunto do edital: ${topicTitle}` : '',
          contextText ? `Texto base / diretriz do editor:\n${contextText}` : '',
          'Elabore 1 questão inédita de concurso público (5 alternativas A-E, apenas 1 correta) no padrão Fundação CETAP, com comentário explicativo detalhado e referência normativa/conceitual segura.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: adminSystemRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topicTitle: { type: Type.STRING },
                statement: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                legalBasis: { type: Type.STRING },
              },
              required: ['topicTitle', 'statement', 'options', 'correctIndex', 'explanation'],
            },
          },
        });

        const item = JSON.parse(response.text || '{}') as {
          topicTitle?: string;
          statement?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
          legalBasis?: string;
        };

        const rawOpts = Array.isArray(item.options) ? item.options.slice(0, 5).map((o) => String(o).slice(0, 480)) : [];
        while (rawOpts.length < 5) {
          rawOpts.push(`Alternativa ${rawOpts.length + 1}`);
        }

        res.json({
          action: 'draft_question',
          draft: {
            topicTitle: String(item.topicTitle || topicTitle || disciplineName).slice(0, 180),
            statement: String(item.statement || '').slice(0, 2400),
            options: rawOpts,
            correctIndex: Math.max(0, Math.min(4, Number(item.correctIndex) || 0)),
            explanation: String(item.explanation || '').slice(0, 1900),
            legalBasis: item.legalBasis ? String(item.legalBasis).slice(0, 380) : '',
          },
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Cloud Storage Health & Document Intelligence / Teacher / Admin AI Endpoints
  // ---------------------------------------------------------------------------
  app.get(
    '/api/storage/health',
    requireRole(['admin', 'dev']),
    (_req: Request, res: Response) => {
      const projectId = FIREBASE_APPLET_CONFIG.projectId;
      const bucket = FIREBASE_APPLET_CONFIG.storageBucket;
      res.json({
        configured: Boolean(bucket && projectId),
        projectId,
        storageBucket: bucket,
        firestoreDatabaseId: FIREBASE_APPLET_CONFIG.firestoreDatabaseId,
        consoleUrl: projectId
          ? `https://console.firebase.google.com/project/${projectId}/storage`
          : '',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        spotifyConfigured: Boolean(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim()),
        checkedAt: new Date().toISOString(),
      });
    }
  );

  app.post('/api/ai/classify-document', geminiRateLimiter);
  app.post(
    '/api/ai/classify-document',
    requireRole(['admin', 'editor', 'teacher', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          title?: string;
          fileName?: string;
          metadataTitle?: string;
          metadataAuthor?: string;
          sampleSnippet?: string;
          outlineTitles?: string[];
          campusLevel?: 'geral' | 'superior' | 'medio';
          availableDisciplines?: Array<{ id: string; name: string }>;
        };

        const title = (body.title || '').trim().slice(0, 200);
        const fileName = (body.fileName || '').trim().slice(0, 240);
        const sampleSnippet = (body.sampleSnippet || '').trim().slice(0, 3500);
        if (!title && !fileName && !sampleSnippet) {
          res.status(400).json({ error: 'Forneça o título, nome do arquivo ou trecho do PDF para classificação.' });
          return;
        }

        const ai = getGeminiClient();
        const disciplinesList = Array.isArray(body.availableDisciplines)
          ? body.availableDisciplines.slice(0, 40).map((d) => `${d.id}: ${d.name}`).join('\n')
          : '';

        const prompt = [
          'Analise os metadados e trecho abaixo para sugerir catalogação pedagógica (sempre sujeita à revisão humana do editor/administrador):',
          title ? `Título atual: ${title}` : '',
          fileName ? `Arquivo: ${fileName}` : '',
          body.metadataTitle ? `Título interno PDF: ${body.metadataTitle}` : '',
          body.metadataAuthor ? `Autor PDF: ${body.metadataAuthor}` : '',
          body.campusLevel ? `Escolaridade informada: ${body.campusLevel}` : '',
          Array.isArray(body.outlineTitles) && body.outlineTitles.length
            ? `Sumário detectado: ${body.outlineTitles.slice(0, 12).join(' | ')}`
            : '',
          disciplinesList ? `Disciplinas válidas (escolha um ID exato se compatível):\n${disciplinesList}` : '',
          sampleSnippet ? `Trecho extraído:\n${sampleSnippet}` : '',
          'Retorne JSON com: suggestedTitle, suggestedDisciplineId, suggestedTopic, suggestedCampusLevel ("geral"|"superior"|"medio"), suggestedRelevanceTier ("essencial"|"complementar"|"aprofundamento"), suggestedSummary (2-3 linhas em pt-BR), suggestedKeywords (array de 3 a 8 termos).',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Você é um especialista de catalogação bibliográfica do MEU CAMPUS ALEPA 2026. Nunca invente informações ausentes; baseie-se nos dados reais fornecidos.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedTitle: { type: Type.STRING },
                suggestedDisciplineId: { type: Type.STRING },
                suggestedTopic: { type: Type.STRING },
                suggestedCampusLevel: { type: Type.STRING },
                suggestedRelevanceTier: { type: Type.STRING },
                suggestedSummary: { type: Type.STRING },
                suggestedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'suggestedTitle',
                'suggestedDisciplineId',
                'suggestedTopic',
                'suggestedCampusLevel',
                'suggestedRelevanceTier',
                'suggestedSummary',
                'suggestedKeywords',
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}') as {
          suggestedTitle?: string;
          suggestedDisciplineId?: string;
          suggestedTopic?: string;
          suggestedCampusLevel?: string;
          suggestedRelevanceTier?: string;
          suggestedSummary?: string;
          suggestedKeywords?: string[];
        };

        res.json({
          suggestion: {
            suggestedTitle: String(parsed.suggestedTitle || title || fileName).slice(0, 180),
            suggestedDisciplineId: String(parsed.suggestedDisciplineId || '').slice(0, 80),
            suggestedTopic: String(parsed.suggestedTopic || '').slice(0, 220),
            suggestedCampusLevel: ['geral', 'superior', 'medio'].includes(String(parsed.suggestedCampusLevel))
              ? parsed.suggestedCampusLevel
              : body.campusLevel || 'superior',
            suggestedRelevanceTier: ['essencial', 'complementar', 'aprofundamento'].includes(
              String(parsed.suggestedRelevanceTier)
            )
              ? parsed.suggestedRelevanceTier
              : 'essencial',
            suggestedSummary: String(parsed.suggestedSummary || '').slice(0, 950),
            suggestedKeywords: Array.isArray(parsed.suggestedKeywords)
              ? parsed.suggestedKeywords.slice(0, 10).map((k) => String(k).trim()).filter(Boolean)
              : [],
          },
          requiresHumanReview: true,
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  app.post('/api/ai/split-pdf-disciplines', geminiRateLimiter);
  app.post(
    '/api/ai/split-pdf-disciplines',
    requireRole(['admin', 'editor', 'teacher', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          title?: string;
          fileName?: string;
          pageCount?: number;
          outlineTitles?: string[];
          outlineWithPages?: Array<{ title: string; page?: number }>;
          sampleSnippet?: string;
          campusLevel?: 'geral' | 'superior' | 'medio';
          availableDisciplines?: Array<{ id: string; name: string }>;
        };

        const title = (body.title || '').trim().slice(0, 200);
        const pageCount = Math.max(1, Math.min(2500, Number(body.pageCount) || 100));
        const ai = getGeminiClient();

        const disciplinesList = Array.isArray(body.availableDisciplines) && body.availableDisciplines.length > 0
          ? body.availableDisciplines.map((d) => `- ID "${d.id}": ${d.name}`).join('\n')
          : [
              '- ID "cat_01_portugues": Língua Portuguesa',
              '- ID "cat_03_informatica": Noções de Informática',
              '- ID "cat_04_raciocinio_logico": Raciocínio Lógico',
              '- ID "cat_05_constitucional_adm": Direito Constitucional e Administrativo',
              '- ID "cat_06_processo_legislativo": Processo Legislativo e Regimento Interno',
              '- ID "cat_02_legislacao_etica": Legislação do Estado do Pará e Ética',
            ].join('\n');

        const hasPageNumbers =
          Array.isArray(body.outlineWithPages) &&
          body.outlineWithPages.some((o) => typeof o.page === 'number' && o.page >= 1);

        const outlineList = Array.isArray(body.outlineWithPages) && body.outlineWithPages.length > 0
          ? body.outlineWithPages.map((o) => `* ${o.title} (página ${o.page || 'não indicada'})`).join('\n')
          : Array.isArray(body.outlineTitles) && body.outlineTitles.length > 0
            ? body.outlineTitles.map((t) => `* ${t}`).join('\n')
            : '';

        if (!outlineList && !body.sampleSnippet) {
          res.status(400).json({
            error:
              'Forneça o sumário embutido ou uma amostra textual do PDF para que a IA sugira a divisão sem inventar números de página.',
          });
          return;
        }

        const prompt = [
          'Você é o arquiteto pedagógico do MEU CAMPUS ALEPA 2026.',
          'Sua missão é sugerir a organização de um material em seções por disciplina do Edital da ALEPA 2026.',
          `Título do Material: ${title || body.fileName || 'Apostila Geral ALEPA 2026'}`,
          `Total de Páginas do PDF: ${pageCount}`,
          `Nível do Concurso: ${body.campusLevel || 'superior'}`,
          `Disciplinas disponíveis no sistema:\n${disciplinesList}`,
          outlineList ? `Sumário / Tópicos identificados no documento:\n${outlineList}` : 'Sumário embutido ausente.',
          body.sampleSnippet ? `Amostra de texto:\n${body.sampleSnippet.slice(0, 2500)}` : '',
          'Regras estritas de integridade:',
          hasPageNumbers
            ? '1. Use exclusivamente as páginas reais indicadas no sumário extraído (1 <= startPage <= endPage <= total de páginas). Não invente capítulos ausentes.'
            : '1. Como o documento não informou páginas numéricas no sumário, NÃO invente intervalos falsos de página: defina startPage=1 e endPage=1 para que o curador confirme as páginas antes de publicar.',
          '2. Associe o disciplineId correspondente da lista de disciplinas.',
          '3. Sugira um título claro, resumo objetivo e tópicos do edital efetivamente presentes nas evidências fornecidas.',
          'Retorne JSON estrito com array "sections".',
        ].filter(Boolean).join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Retorne JSON estruturado com seções baseadas apenas nas evidências enviadas. Nunca invente páginas ou conteúdo inexistente.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      disciplineId: { type: Type.STRING },
                      disciplineName: { type: Type.STRING },
                      title: { type: Type.STRING },
                      startPage: { type: Type.INTEGER },
                      endPage: { type: Type.INTEGER },
                      summary: { type: Type.STRING },
                      topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['id', 'disciplineId', 'disciplineName', 'title', 'startPage', 'endPage'],
                  },
                },
              },
              required: ['sections'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{"sections":[]}') as {
          sections?: Array<{
            id?: string;
            disciplineId?: string;
            disciplineName?: string;
            title?: string;
            startPage?: number;
            endPage?: number;
            summary?: string;
            topics?: string[];
          }>;
        };

        const validatedSections = (parsed.sections || []).map((sec, idx) => {
          const sp = hasPageNumbers ? Math.max(1, Math.min(pageCount, Number(sec.startPage) || 1)) : 1;
          const ep = hasPageNumbers ? Math.max(sp, Math.min(pageCount, Number(sec.endPage) || sp)) : 1;
          return {
            id: sec.id || `sec_${idx + 1}`,
            disciplineId: sec.disciplineId || 'cat_01_portugues',
            disciplineName: sec.disciplineName || 'Disciplina',
            title: sec.title || `Seção ${idx + 1}`,
            startPage: sp,
            endPage: ep,
            summary: sec.summary || '',
            topics: Array.isArray(sec.topics) ? sec.topics.slice(0, 10) : [],
            publishedToLibrary: hasPageNumbers,
            requiresPageVerification: !hasPageNumbers,
          };
        });

        res.json({
          sections: validatedSections,
          totalSections: validatedSections.length,
          hasVerifiedPageNumbers: hasPageNumbers,
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  app.post('/api/ai/organize-material', geminiRateLimiter);
  app.post(
    '/api/ai/organize-material',
    requireRole(['admin', 'editor', 'teacher', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          title?: string;
          fileName?: string;
          resourceType?: string;
          campusLevel?: 'geral' | 'superior' | 'medio';
          editalTopic?: string;
          description?: string;
          pageCount?: number;
          durationSeconds?: number;
          outlineWithPages?: Array<{ title: string; page?: number }>;
          outlineTitles?: string[];
          transcriptOrNotes?: string;
          availableDisciplines?: Array<{ id: string; name: string }>;
        };

        const title = (body.title || '').trim().slice(0, 220);
        const fileName = (body.fileName || '').trim().slice(0, 220);
        const transcriptOrNotes = (body.transcriptOrNotes || '').trim().slice(0, 4000);
        if (!title && !fileName && !transcriptOrNotes) {
          res.status(400).json({ error: 'Informe título, arquivo ou texto de apoio para organizar o conteúdo.' });
          return;
        }

        const ai = getGeminiClient();
        const discText = Array.isArray(body.availableDisciplines) && body.availableDisciplines.length > 0
          ? body.availableDisciplines.map((d) => `- "${d.id}": ${d.name}`).join('\n')
          : 'Mantenha o disciplineId compatível com o edital ALEPA 2026.';

        const outlineText = Array.isArray(body.outlineWithPages) && body.outlineWithPages.length > 0
          ? body.outlineWithPages.map((o) => `* ${o.title}${o.page ? ` (pág. ${o.page})` : ''}`).join('\n')
          : Array.isArray(body.outlineTitles) && body.outlineTitles.length > 0
            ? body.outlineTitles.map((t) => `* ${t}`).join('\n')
            : '';

        const prompt = [
          'Você é um curador pedagógico do MEU CAMPUS ALEPA 2026 (Banca CETAP).',
          'Organize os metadados deste conteúdo para revisão humana (editor/professor).',
          `Título atual: ${title || '(sem título)'}`,
          fileName ? `Arquivo: ${fileName}` : '',
          body.resourceType ? `Tipo: ${body.resourceType}` : '',
          `Campus: ${body.campusLevel || 'superior'}`,
          body.editalTopic ? `Tópico atual: ${body.editalTopic}` : '',
          body.description ? `Descrição atual: ${body.description}` : '',
          body.pageCount ? `Total de páginas: ${body.pageCount}` : '',
          body.durationSeconds ? `Duração (seg): ${body.durationSeconds}` : '',
          `Disciplinas disponíveis:\n${discText}`,
          outlineText ? `Sumário extraído:\n${outlineText}` : '',
          transcriptOrNotes ? `Notas / Trecho / Marcações fornecidas:\n${transcriptOrNotes}` : '',
          'Regras:',
          '- Sugira subtitle (subtítulo curto), description (resumo didático de 2-3 linhas), disciplineId, editalTopic, keywords (máx 8), studyRecommendations (3 a 5 passos práticos de estudo) e chapters.',
          '- NUNCA invente números de página ou timestamps (startPage, endPage, startSeconds) se eles NÃO estiverem presentes no sumário ou nas marcações fornecidas; se não houver base numérica, omita startPage/startSeconds.',
          '- Retorne JSON estrito.',
        ].filter(Boolean).join('\n\n');

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Curador pedagógico ALEPA 2026. Retorne JSON válido e jamais invente páginas, leis ou tempos inexistentes.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subtitle: { type: Type.STRING },
                description: { type: Type.STRING },
                disciplineId: { type: Type.STRING },
                editalTopic: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                studyRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                chapters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      summary: { type: Type.STRING },
                      startPage: { type: Type.INTEGER },
                      endPage: { type: Type.INTEGER },
                      startSeconds: { type: Type.INTEGER },
                      endSeconds: { type: Type.INTEGER },
                    },
                    required: ['title'],
                  },
                },
              },
              required: ['subtitle', 'description', 'editalTopic', 'keywords', 'studyRecommendations', 'chapters'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}') as {
          subtitle?: string;
          description?: string;
          disciplineId?: string;
          editalTopic?: string;
          keywords?: string[];
          studyRecommendations?: string[];
          chapters?: Array<{
            title?: string;
            summary?: string;
            startPage?: number;
            endPage?: number;
            startSeconds?: number;
            endSeconds?: number;
          }>;
        };

        const chapters = Array.isArray(parsed.chapters)
          ? parsed.chapters.slice(0, 25).map((ch, idx) => ({
              id: `ch_ai_${Date.now()}_${idx}`,
              title: String(ch.title || `Capítulo ${idx + 1}`).slice(0, 140),
              summary: ch.summary ? String(ch.summary).slice(0, 320) : undefined,
              startPage:
                typeof ch.startPage === 'number' && ch.startPage >= 1
                  ? Math.min(body.pageCount || 2500, Math.round(ch.startPage))
                  : undefined,
              endPage:
                typeof ch.endPage === 'number' && ch.endPage >= 1
                  ? Math.min(body.pageCount || 2500, Math.round(ch.endPage))
                  : undefined,
              startSeconds:
                typeof ch.startSeconds === 'number' && ch.startSeconds >= 0 ? Math.round(ch.startSeconds) : undefined,
              endSeconds:
                typeof ch.endSeconds === 'number' && ch.endSeconds >= 0 ? Math.round(ch.endSeconds) : undefined,
            }))
          : [];

        res.json({
          suggestion: {
            subtitle: String(parsed.subtitle || '').slice(0, 200),
            description: String(parsed.description || '').slice(0, 1200),
            disciplineId: parsed.disciplineId ? String(parsed.disciplineId).slice(0, 80) : undefined,
            editalTopic: String(parsed.editalTopic || '').slice(0, 220),
            keywords: Array.isArray(parsed.keywords)
              ? parsed.keywords.slice(0, 8).map((k) => String(k).trim()).filter(Boolean)
              : [],
            studyRecommendations: Array.isArray(parsed.studyRecommendations)
              ? parsed.studyRecommendations.slice(0, 5).map((r) => String(r).trim()).filter(Boolean)
              : [],
            chapters,
          },
          requiresHumanReview: true,
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  app.post('/api/ai/teacher-assistant', geminiRateLimiter);
  app.post(
    '/api/ai/teacher-assistant',
    requireRole(['admin', 'editor', 'teacher', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          action?: 'draft_lesson' | 'draft_activity_questions' | 'analyze_class_errors';
          disciplineName?: string;
          campusLevel?: 'superior' | 'medio';
          topicTitle?: string;
          contextText?: string;
          questionCount?: number;
        };

        const action = body.action || 'draft_lesson';
        const disciplineName = (body.disciplineName || '').trim().slice(0, 140);
        const campusLevel = body.campusLevel === 'medio' ? 'medio' : 'superior';
        const topicTitle = (body.topicTitle || '').trim().slice(0, 200);
        const contextText = (body.contextText || '').trim().slice(0, 5000);
        const ai = getGeminiClient();

        const teacherRule =
          'Você é o Assistente Pedagógico do Professor no MEU CAMPUS ALEPA 2026 (Banca CETAP). Responda em pt-BR claro e objetivo. Nunca invente artigos de lei ou súmulas. Tudo gerado entra como rascunho para revisão do professor.';

        if (action === 'analyze_class_errors') {
          if (!contextText) {
            res.status(400).json({ error: 'Envie o resumo dos erros ou dificuldades da turma para análise.' });
            return;
          }
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Analise exclusivamente os dados reais de erros/dificuldades abaixo e proponha recomendações de aula de reforço e lista de revisão:\n\n${contextText}`,
            config: { systemInstruction: teacherRule },
          });
          res.json({ action, text: response.text?.trim() || '', model: GEMINI_MODEL });
          return;
        }

        if (action === 'draft_activity_questions') {
          const count = Math.max(1, Math.min(5, Number(body.questionCount) || 3));
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
              disciplineName ? `Disciplina: ${disciplineName}` : '',
              `Nível: ${campusLevel}`,
              topicTitle ? `Assunto: ${topicTitle}` : '',
              contextText ? `Orientação do professor:\n${contextText}` : '',
              `Elabore ${count} questões objetivas (5 alternativas A-E, 1 correta) e 1 questão discursiva sugerida para atividade de turma.`,
            ]
              .filter(Boolean)
              .join('\n\n'),
            config: {
              systemInstruction: teacherRule,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        topicTitle: { type: Type.STRING },
                        statement: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.INTEGER },
                        explanation: { type: Type.STRING },
                        legalBasis: { type: Type.STRING },
                      },
                      required: ['topicTitle', 'statement', 'options', 'correctIndex', 'explanation'],
                    },
                  },
                  discursivePrompt: { type: Type.STRING },
                },
                required: ['questions', 'discursivePrompt'],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}') as {
            questions?: Array<{
              topicTitle?: string;
              statement?: string;
              options?: string[];
              correctIndex?: number;
              explanation?: string;
              legalBasis?: string;
            }>;
            discursivePrompt?: string;
          };

          res.json({
            action,
            questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 5) : [],
            discursivePrompt: String(parsed.discursivePrompt || '').slice(0, 1500),
            model: GEMINI_MODEL,
          });
          return;
        }

        // draft_lesson
        if (!topicTitle && !disciplineName && !contextText) {
          res.status(400).json({ error: 'Informe disciplina, tema ou roteiro base para elaborar a aula.' });
          return;
        }

        const lessonResponse = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            disciplineName ? `Disciplina: ${disciplineName}` : '',
            `Nível: ${campusLevel}`,
            topicTitle ? `Tema da aula: ${topicTitle}` : '',
            contextText ? `Diretrizes do professor:\n${contextText}` : '',
            'Retorne JSON com: title, summary (resumo de 2-3 linhas) e content (roteiro completo da aula em Markdown estruturado com objetivos, explicação didática, pontos de atenção da banca e checklist de revisão).',
          ]
            .filter(Boolean)
            .join('\n\n'),
          config: {
            systemInstruction: teacherRule,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ['title', 'summary', 'content'],
            },
          },
        });

        const parsedLesson = JSON.parse(lessonResponse.text || '{}') as {
          title?: string;
          summary?: string;
          content?: string;
        };

        res.json({
          action: 'draft_lesson',
          draft: {
            title: String(parsedLesson.title || topicTitle || 'Nova Aula').slice(0, 190),
            summary: String(parsedLesson.summary || '').slice(0, 950),
            content: String(parsedLesson.content || '').slice(0, 11500),
          },
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  app.post('/api/ai/admin-assistant', geminiRateLimiter);
  app.post(
    '/api/ai/admin-assistant',
    requireRole(['admin', 'editor', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          prompt?: string;
          platformSnapshot?: string;
        };
        const userPrompt = (body.prompt || '').trim().slice(0, 2500);
        const snapshot = (body.platformSnapshot || '').trim().slice(0, 6000);
        if (!userPrompt) {
          res.status(400).json({ error: 'Digite uma consulta para o Assistente Administrativo.' });
          return;
        }

        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            snapshot ? `DADOS REAIS ATUAIS DA PLATAFORMA:\n${snapshot}` : '',
            `Solicitação administrativa:\n${userPrompt}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
          config: {
            systemInstruction:
              'Você é o Assistente Estratégico Administrativo do MEU CAMPUS ALEPA 2026. Baseie-se estritamente nos dados reais fornecidos no contexto; nunca invente estatísticas, custos exatos não informados ou ações autônomas. Recomende passos claros para decisão humana.',
          },
        });

        res.json({
          reply: response.text?.trim() || '',
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Semantic Document Index Search & Structured Question Extraction
  // ---------------------------------------------------------------------------
  app.post('/api/ai/semantic-index-search', geminiRateLimiter, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        query?: string;
        campus?: string;
        candidates?: Array<{
          chunkId?: string;
          materialId?: string;
          materialTitle?: string;
          pageNumber?: number;
          chapterTitle?: string;
          excerpt?: string;
        }>;
      };

      const query = (body.query || '').trim().slice(0, 300);
      const candidates = Array.isArray(body.candidates)
        ? body.candidates
            .filter((c) => c && typeof c.chunkId === 'string' && typeof c.excerpt === 'string')
            .slice(0, 24)
        : [];

      if (!query || candidates.length === 0) {
        res.status(400).json({ error: 'Informe a consulta e os trechos candidatos reais do documento.' });
        return;
      }

      const semCacheKey = AiResponseCache.buildKey('semantic-index-search', {
        query,
        campus: body.campus || 'superior',
        candidateIds: candidates.map((c) => c.chunkId),
      });
      const cached = aiResponseCache.get(semCacheKey);
      if (cached) {
        aiQuotaManager.recordCacheHit(resolveQuotaIdentity(req));
        res.json({ ...(cached as Record<string, unknown>), cached: true });
        return;
      }

      const ai = getGeminiClient();
      const allowedChunkIds = new Set(candidates.map((c) => String(c.chunkId)));

      const candidateListText = candidates
        .map(
          (c) =>
            `[ID:${c.chunkId}] Material: ${String(c.materialTitle || '').slice(0, 120)}${
              c.pageNumber ? ` | Pág. ${c.pageNumber}` : ''
            }${c.chapterTitle ? ` | Cap.: ${String(c.chapterTitle).slice(0, 100)}` : ''}\nTrecho: ${String(
              c.excerpt || ''
            ).slice(0, 550)}`
        )
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          `Consulta do edital/estudante (${body.campus === 'medio' ? 'Nível Médio' : 'Nível Superior'}): "${query}"`,
          'Selecione e ranqueie até 6 trechos candidatos abaixo que respondam ou correspondam conceitualmente à consulta (incluindo sinônimos jurídicos e terminologia diferente do edital).',
          'REGRA ESTRITA: retorne APENAS IDs exatamente iguais aos fornecidos em [ID:...]. Jamais invente páginas, capítulos ou trechos.',
          candidateListText,
        ].join('\n\n'),
        config: {
          systemInstruction:
            'Indexador semântico ALEPA 2026. Retorne JSON com matches [{ chunkId, relevanceScore (0-100), reason }]. Use estritamente os IDs fornecidos.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chunkId: { type: Type.STRING },
                    relevanceScore: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                  required: ['chunkId', 'relevanceScore', 'reason'],
                },
              },
            },
            required: ['matches'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        matches?: Array<{ chunkId?: string; relevanceScore?: number; reason?: string }>;
      };

      const validMatches = (Array.isArray(parsed.matches) ? parsed.matches : [])
        .filter((m) => m.chunkId && allowedChunkIds.has(String(m.chunkId)))
        .slice(0, 6)
        .map((m) => ({
          chunkId: String(m.chunkId),
          relevanceScore: Math.max(0, Math.min(100, Math.round(Number(m.relevanceScore) || 70))),
          reason: String(m.reason || '').slice(0, 220),
        }));

      const payload = {
        matches: validMatches,
        model: GEMINI_MODEL,
      };
      aiResponseCache.set(semCacheKey, payload);
      res.json(payload);
    } catch (err) {
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/ai/extract-questions', geminiRateLimiter);
  app.post(
    '/api/ai/extract-questions',
    requireRole(['admin', 'editor', 'teacher', 'dev']),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as {
          materialTitle?: string;
          disciplineName?: string;
          campusLevel?: 'superior' | 'medio';
          mode?: 'extract_existing' | 'generate_from_chunks';
          count?: number;
          existingStatements?: string[];
          pages?: Array<{ pageNumber?: number; chapterTitle?: string; text?: string }>;
        };

        const pages = Array.isArray(body.pages)
          ? body.pages
              .filter((p) => p && typeof p.text === 'string' && p.text.trim().length > 20)
              .slice(0, 12)
          : [];

        if (pages.length === 0) {
          res.status(400).json({
            error: 'Envie ao menos um trecho ou página real do material para extrair ou elaborar questões.',
          });
          return;
        }

        const requestedCount = Math.max(1, Math.min(10, Number(body.count) || 5));
        const mode = body.mode === 'extract_existing' ? 'extract_existing' : 'generate_from_chunks';
        const validPageNumbers = pages
          .map((p) => p.pageNumber)
          .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1);

        const ai = getGeminiClient();
        const pagesText = pages
          .map(
            (p, idx) =>
              `=== ${p.pageNumber ? `PÁGINA ${p.pageNumber}` : `BLOCO ${idx + 1}`}${
                p.chapterTitle ? ` · ${String(p.chapterTitle).slice(0, 100)}` : ''
              } ===\n${String(p.text || '').slice(0, 2200)}`
          )
          .join('\n\n');

        const instruction =
          mode === 'extract_existing'
            ? 'Extraia fielmente as questões objetivas presentes nas páginas abaixo (convertendo ou completando para 5 alternativas A-E quando necessário e informando o sourcePage exato onde a questão aparece).'
            : `Com base EXCLUSIVA nas páginas fornecidas abaixo, elabore ${requestedCount} questões objetivas inéditas no estilo Fundação CETAP (5 alternativas A-E, exatamente 1 correta, gabarito comentado e referência real de sourcePage + sourceExcerpt).`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            body.materialTitle ? `Material: ${String(body.materialTitle).slice(0, 160)}` : '',
            body.disciplineName ? `Disciplina: ${String(body.disciplineName).slice(0, 120)}` : '',
            `Campus: ${body.campusLevel === 'medio' ? 'Nível Médio' : 'Nível Superior'}`,
            instruction,
            'REGRAS INEGOCIÁVEIS: Use SOMENTE números de página (sourcePage) listados nos cabeçalhos === PÁGINA N === abaixo. Nunca invente artigos de lei ou páginas. Se houver dúvida no gabarito ou na página, informe confidence menor que 0.7.',
            pagesText,
          ]
            .filter(Boolean)
            .join('\n\n'),
          config: {
            systemInstruction:
              'Extrator estruturado de questões ALEPA 2026 (Banca CETAP). Retorne JSON estrito com array questions.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topicTitle: { type: Type.STRING },
                      statement: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                      legalBasis: { type: Type.STRING },
                      sourcePage: { type: Type.INTEGER },
                      sourceExcerpt: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                    },
                    required: ['topicTitle', 'statement', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}') as {
          questions?: ExtractedQuestionCandidate[];
        };

        const validated = validateExtractedQuestions(
          Array.isArray(parsed.questions) ? parsed.questions : [],
          {
            existingStatements: Array.isArray(body.existingStatements) ? body.existingStatements : [],
            validPageNumbers,
          }
        );

        res.json({
          questions: validated,
          requiresHumanReview: true,
          model: GEMINI_MODEL,
        });
      } catch (err) {
        const mapped = formatGeminiError(err);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SSRF-Hardened PDF & Reader Proxies (PDF, EPUB & Allowlisted HTML Portals)
  // ---------------------------------------------------------------------------
  app.get('/api/materials/pdf-proxy', async (req: Request, res: Response) => {
    const rawParam = typeof req.query.url === 'string' ? req.query.url : '';
    const normalized = normalizeRemoteUrlInput(rawParam);

    if (!normalized) {
      res.status(400).json({ error: 'Informe uma URL pública válida (http:// ou https://) para leitura do PDF.' });
      return;
    }

    try {
      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'MeuCampusALEPA-BookReader/1.0',
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
      };
      if (typeof req.headers.range === 'string' && req.headers.range.startsWith('bytes=')) {
        forwardHeaders.Range = req.headers.range;
      }

      const result = await safeFetchRemoteDocument(normalized, {
        maxBytes: 45 * 1024 * 1024,
        timeoutMs: 25_000,
        maxRedirects: 5,
        acceptKind: 'pdf',
        headers: forwardHeaders,
      });

      const isPdfMagic = isPdfMagicBuffer(result.buffer);
      const isRangeContinuation = result.status === 206 && result.contentType.includes('pdf');
      const looksHtml = looksLikeHtmlBuffer(result.buffer, result.contentType);

      if (looksHtml || (!isPdfMagic && !isRangeContinuation && !result.contentType.includes('application/pdf'))) {
        res.status(415).json({
          kind: 'html_portal',
          error:
            'Este endereço aponta para uma página web/portal ou exige autenticação no Google Drive, não um arquivo PDF direto.',
        });
        return;
      }

      res.status(result.status === 206 ? 206 : 200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="documento.pdf"');
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (result.acceptRanges) res.setHeader('Accept-Ranges', result.acceptRanges);
      if (result.contentRange) res.setHeader('Content-Range', result.contentRange);
      res.setHeader('Content-Length', String(result.buffer.byteLength));
      res.send(result.buffer);
    } catch (err) {
      if (err instanceof RemoteSizeLimitError) {
        res.status(413).json({ kind: 'too_large', error: err.message });
        return;
      }
      if (err instanceof SsrfValidationError) {
        res.status(err.status).json({ kind: err.kind, error: err.message });
        return;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      res.status(isAbort ? 504 : 502).json({
        kind: 'network_error',
        error: isAbort
          ? 'Tempo limite excedido ao carregar o PDF remoto.'
          : 'Não foi possível baixar o PDF do endereço informado.',
      });
    }
  });

  app.get('/api/materials/reader-proxy', async (req: Request, res: Response) => {
    const rawParam = typeof req.query.url === 'string' ? req.query.url : '';
    const requestedKind = req.query.kind === 'epub' ? 'epub' : 'html';
    const normalized = normalizeRemoteUrlInput(rawParam);

    if (!normalized) {
      res.status(400).json({ error: 'Informe uma URL pública válida (http:// ou https://).' });
      return;
    }

    try {
      if (requestedKind === 'epub') {
        const result = await safeFetchRemoteDocument(normalized, {
          maxBytes: 40 * 1024 * 1024,
          timeoutMs: 25_000,
          maxRedirects: 5,
          acceptKind: 'epub',
          headers: {
            'User-Agent': 'MeuCampusALEPA-EpubReader/1.0',
            Accept: 'application/epub+zip,application/zip,application/octet-stream;q=0.9,*/*;q=0.5',
          },
        });

        const isEpubContent =
          result.contentType.includes('epub') ||
          result.contentType.includes('zip') ||
          isZipMagicBuffer(result.buffer);
        if (!isEpubContent || looksLikeHtmlBuffer(result.buffer, result.contentType)) {
          res.status(415).json({
            kind: 'invalid_epub',
            error: 'O recurso retornado não corresponde a um arquivo EPUB válido.',
          });
          return;
        }

        res.status(200);
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Content-Disposition', 'inline; filename="livro.epub"');
        res.setHeader('Cache-Control', 'private, max-age=600');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Length', String(result.buffer.byteLength));
        res.send(result.buffer);
        return;
      }

      // Authorized HTML Portal Mode (strict host allowlist + XSS/script stripping)
      const result = await safeFetchRemoteDocument(normalized, {
        maxBytes: 6 * 1024 * 1024,
        timeoutMs: 18_000,
        maxRedirects: 5,
        acceptKind: 'html_portal',
        headers: {
          'User-Agent': 'MeuCampusALEPA-PortalReader/1.0',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        },
      });

      if (isPdfMagicBuffer(result.buffer)) {
        res.status(415).json({
          kind: 'is_pdf',
          error: 'O link aponta diretamente para um PDF; utilize o leitor de PDF.',
        });
        return;
      }

      const decodedHtml = decodeHtmlBuffer(result.buffer, result.contentType);
      const structured = extractStructuredHtmlPortal(decodedHtml, result.finalUrl);
      res.json(structured);
    } catch (err) {
      if (err instanceof RemoteSizeLimitError) {
        res.status(413).json({ kind: 'too_large', error: err.message });
        return;
      }
      if (err instanceof SsrfValidationError) {
        res.status(err.status).json({ kind: err.kind, error: err.message });
        return;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      res.status(isAbort ? 504 : 502).json({
        kind: 'network_error',
        error: isAbort
          ? 'Tempo limite excedido ao carregar o portal oficial.'
          : 'Não foi possível carregar o conteúdo do portal autorizado.',
      });
    }
  });

  // Explicit JSON 404 for unknown /api/* routes before SPA fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint de API não encontrado.' });
  });

  // Explicit 404 for missing /assets/* files (before SPA HTML fallback)
  const publicAssetsDir = path.join(__dirname, 'public', 'assets');
  if (options?.enableVite === false) {
    app.use('/assets', (req: Request, res: Response) => {
      let relPath = '';
      try {
        relPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
      } catch {
        res.status(400).json({ error: 'Caminho de arquivo inválido.' });
        return;
      }
      const resolved = path.resolve(publicAssetsDir, relPath);
      if (
        !relPath ||
        !resolved.startsWith(publicAssetsDir + path.sep) ||
        !fs.existsSync(resolved) ||
        fs.statSync(resolved).isDirectory()
      ) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
        return;
      }
      res.sendFile(resolved);
    });
  } else if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use('/assets', (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Arquivo estático não encontrado.' });
    });
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  } else {
    app.use('/assets', (req: Request, res: Response, next: NextFunction) => {
      let relPath = '';
      try {
        relPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
      } catch {
        res.status(400).json({ error: 'Caminho de arquivo inválido.' });
        return;
      }
      const resolved = path.resolve(publicAssetsDir, relPath);
      if (
        !relPath ||
        !resolved.startsWith(publicAssetsDir + path.sep) ||
        !fs.existsSync(resolved) ||
        fs.statSync(resolved).isDirectory()
      ) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
        return;
      }
      next();
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-hmr-client-ws',
          enforce: 'post',
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              const transportBlockPattern =
                /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/;
              if (transportBlockPattern.test(code)) {
                return {
                  code: code.replace(
                    transportBlockPattern,
                    'const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, async send() {} });'
                  ),
                  map: null,
                };
              }
            }
            return null;
          },
        },
      ],
    });
    app.use(vite.middlewares);
  }

  // JSON error handler for /api/* (e.g. malformed JSON body or payload too large)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof (err as { status?: unknown })?.status === 'number'
        ? ((err as { status: number }).status)
        : typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
    if (req.path.startsWith('/api/')) {
      res.status(status).json({
        error:
          status === 413
            ? 'O corpo da requisição excede o limite permitido.'
            : status === 400
              ? 'Requisição JSON inválida.'
              : 'Erro interno ao processar a solicitação.',
      });
      return;
    }
    next(err);
  });

  return app;
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.env.VITEST !== 'true' &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Erro fatal ao iniciar servidor:', err);
      process.exit(1);
    });
}
