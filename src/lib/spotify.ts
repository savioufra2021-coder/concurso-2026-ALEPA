export interface SpotifyUserProfile {
  id: string;
  displayName: string;
  email: string;
  product: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  user: SpotifyUserProfile | null;
}

export interface SpotifyConfigStatus {
  configured: boolean;
  redirectUri: string;
  scopes: string[];
}

export interface SpotifyMediaItem {
  id: string;
  kind: 'episode' | 'show' | 'playlist' | 'track';
  title: string;
  subtitle: string;
  description?: string;
  url: string;
  embedUrl: string;
  imageUrl?: string;
  durationMs?: number;
  releaseDate?: string;
}

export interface LinkedSpotifyProfile {
  id: string;
  displayName: string;
  profileUrl: string;
  homeUrl: string;
  avatarUrl?: string;
}

const SPOTIFY_STORAGE_KEY = 'alepa_spotify_session_v1';
const SPOTIFY_LINKED_PROFILE_KEY = 'alepa_spotify_linked_profile_v1';

export const DEFAULT_LINKED_SPOTIFY_PROFILE: LinkedSpotifyProfile = {
  id: '31yuxhm76roopqxllenj34n7o5qa',
  displayName: 'Savio Baia',
  profileUrl: 'https://open.spotify.com/user/31yuxhm76roopqxllenj34n7o5qa',
  homeUrl: 'https://open.spotify.com/intl-pt',
};

export function loadLinkedSpotifyProfile(): LinkedSpotifyProfile {
  try {
    const raw = localStorage.getItem(SPOTIFY_LINKED_PROFILE_KEY);
    if (!raw) return DEFAULT_LINKED_SPOTIFY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<LinkedSpotifyProfile>;
    if (!parsed.id || !parsed.profileUrl) return DEFAULT_LINKED_SPOTIFY_PROFILE;
    return {
      id: parsed.id,
      displayName: parsed.displayName || parsed.id,
      profileUrl: parsed.profileUrl,
      homeUrl: parsed.homeUrl || 'https://open.spotify.com/intl-pt',
      avatarUrl: parsed.avatarUrl,
    };
  } catch {
    return DEFAULT_LINKED_SPOTIFY_PROFILE;
  }
}

export function saveLinkedSpotifyProfile(profile: LinkedSpotifyProfile): void {
  try {
    localStorage.setItem(SPOTIFY_LINKED_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSpotifySession(): SpotifySession | null {
  try {
    const raw = localStorage.getItem(SPOTIFY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SpotifySession>;
    if (!parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || '',
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0,
      scope: parsed.scope || '',
      user: parsed.user || null,
    };
  } catch {
    return null;
  }
}

export function saveSpotifySession(session: SpotifySession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SPOTIFY_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SPOTIFY_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage quota errors
  }
}

export function formatSpotifyDuration(durationMs?: number): string {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) return '';
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export async function fetchSpotifyStatus(): Promise<SpotifyConfigStatus> {
  const res = await fetch('/api/spotify/status');
  if (!res.ok) {
    throw new Error('Não foi possível consultar a configuração do Spotify no servidor.');
  }
  return (await res.json()) as SpotifyConfigStatus;
}

export async function requestSpotifyAuthUrl(): Promise<{
  configured: boolean;
  redirectUri: string;
  url?: string;
  error?: string;
}> {
  const res = await fetch('/api/spotify/auth/url');
  const json = (await res.json()) as {
    configured?: boolean;
    redirectUri?: string;
    url?: string;
    error?: string;
  };
  return {
    configured: Boolean(json.configured),
    redirectUri: json.redirectUri || `${window.location.origin}/api/spotify/callback`,
    url: json.url,
    error: json.error,
  };
}

export async function refreshSpotifySession(session: SpotifySession): Promise<SpotifySession> {
  if (!session.refreshToken) {
    throw new Error('Sessão Spotify expirada. Reconecte sua conta.');
  }
  const res = await fetch('/api/spotify/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  const data = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  };

  if (!res.ok || !data.accessToken) {
    throw new Error(data.error || 'Não foi possível renovar a sessão do Spotify.');
  }

  const next: SpotifySession = {
    ...session,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || session.refreshToken,
    expiresAt: data.expiresAt || Date.now() + 3500 * 1000,
  };
  saveSpotifySession(next);
  return next;
}

async function fetchWithSpotifyAuth<T>(
  path: string,
  session: SpotifySession,
  onSessionUpdate: (next: SpotifySession | null) => void
): Promise<T> {
  let activeSession = session;
  if (activeSession.expiresAt && Date.now() >= activeSession.expiresAt - 30_000) {
    activeSession = await refreshSpotifySession(activeSession);
    onSessionUpdate(activeSession);
  }

  const doRequest = (token: string) =>
    fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await doRequest(activeSession.accessToken);
  if (res.status === 401 && activeSession.refreshToken) {
    activeSession = await refreshSpotifySession(activeSession);
    onSessionUpdate(activeSession);
    res = await doRequest(activeSession.accessToken);
  }

  if (res.status === 401) {
    saveSpotifySession(null);
    onSessionUpdate(null);
    throw new Error('Sua conexão com o Spotify expirou. Clique em "Conectar com Spotify" novamente.');
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Erro ao acessar o Spotify (${res.status}).`);
  }
  return data;
}

interface RawSpotifyImage {
  url?: string;
}

interface RawSpotifyEpisode {
  id?: string;
  name?: string;
  description?: string;
  duration_ms?: number;
  release_date?: string;
  images?: RawSpotifyImage[];
  external_urls?: { spotify?: string };
  show?: { name?: string; publisher?: string; images?: RawSpotifyImage[] };
}

interface RawSpotifyShow {
  id?: string;
  name?: string;
  publisher?: string;
  description?: string;
  total_episodes?: number;
  images?: RawSpotifyImage[];
  external_urls?: { spotify?: string };
}

interface RawSpotifyPlaylist {
  id?: string;
  name?: string;
  description?: string;
  owner?: { display_name?: string };
  tracks?: { total?: number };
  images?: RawSpotifyImage[];
  external_urls?: { spotify?: string };
}

interface RawSpotifyTrack {
  id?: string;
  name?: string;
  duration_ms?: number;
  artists?: Array<{ name?: string }>;
  album?: { name?: string; images?: RawSpotifyImage[] };
  external_urls?: { spotify?: string };
}

function mapEpisode(ep: RawSpotifyEpisode, fallbackShowName?: string): SpotifyMediaItem | null {
  if (!ep?.id || !ep?.name) return null;
  const showName = ep.show?.name || fallbackShowName || 'Podcast Spotify';
  return {
    id: ep.id,
    kind: 'episode',
    title: ep.name,
    subtitle: showName,
    description: ep.description || '',
    url: ep.external_urls?.spotify || `https://open.spotify.com/episode/${ep.id}`,
    embedUrl: `https://open.spotify.com/embed/episode/${ep.id}?utm_source=generator`,
    imageUrl: ep.images?.[0]?.url || ep.show?.images?.[0]?.url,
    durationMs: ep.duration_ms,
    releaseDate: ep.release_date,
  };
}

function mapShow(show: RawSpotifyShow): SpotifyMediaItem | null {
  if (!show?.id || !show?.name) return null;
  const countLabel =
    typeof show.total_episodes === 'number' ? ` · ${show.total_episodes} episódios` : '';
  return {
    id: show.id,
    kind: 'show',
    title: show.name,
    subtitle: `${show.publisher || 'Programa Spotify'}${countLabel}`,
    description: show.description || '',
    url: show.external_urls?.spotify || `https://open.spotify.com/show/${show.id}`,
    embedUrl: `https://open.spotify.com/embed/show/${show.id}?utm_source=generator`,
    imageUrl: show.images?.[0]?.url,
  };
}

function mapPlaylist(pl: RawSpotifyPlaylist): SpotifyMediaItem | null {
  if (!pl?.id || !pl?.name) return null;
  const trackCount = typeof pl.tracks?.total === 'number' ? ` · ${pl.tracks.total} faixas` : '';
  return {
    id: pl.id,
    kind: 'playlist',
    title: pl.name,
    subtitle: `${pl.owner?.display_name || 'Spotify'}${trackCount}`,
    description: pl.description || '',
    url: pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`,
    embedUrl: `https://open.spotify.com/embed/playlist/${pl.id}?utm_source=generator`,
    imageUrl: pl.images?.[0]?.url,
  };
}

function mapTrack(tr: RawSpotifyTrack): SpotifyMediaItem | null {
  if (!tr?.id || !tr?.name) return null;
  const artists = (tr.artists || [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(', ');
  return {
    id: tr.id,
    kind: 'track',
    title: tr.name,
    subtitle: artists || tr.album?.name || 'Spotify',
    url: tr.external_urls?.spotify || `https://open.spotify.com/track/${tr.id}`,
    embedUrl: `https://open.spotify.com/embed/track/${tr.id}?utm_source=generator`,
    imageUrl: tr.album?.images?.[0]?.url,
    durationMs: tr.duration_ms,
  };
}

export async function searchSpotifyCatalog(
  query: string,
  session: SpotifySession,
  onSessionUpdate: (next: SpotifySession | null) => void
): Promise<SpotifyMediaItem[]> {
  const qs = new URLSearchParams({
    q: query.trim(),
    type: 'episode,show,playlist,track',
  });
  const data = await fetchWithSpotifyAuth<{
    episodes?: { items?: Array<RawSpotifyEpisode | null> };
    shows?: { items?: Array<RawSpotifyShow | null> };
    playlists?: { items?: Array<RawSpotifyPlaylist | null> };
    tracks?: { items?: Array<RawSpotifyTrack | null> };
  }>(`/api/spotify/search?${qs.toString()}`, session, onSessionUpdate);

  const episodes = (data.episodes?.items || [])
    .filter((i): i is RawSpotifyEpisode => Boolean(i))
    .map((ep) => mapEpisode(ep))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  const shows = (data.shows?.items || [])
    .filter((i): i is RawSpotifyShow => Boolean(i))
    .map((sh) => mapShow(sh))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  const playlists = (data.playlists?.items || [])
    .filter((i): i is RawSpotifyPlaylist => Boolean(i))
    .map((pl) => mapPlaylist(pl))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  const tracks = (data.tracks?.items || [])
    .filter((i): i is RawSpotifyTrack => Boolean(i))
    .map((tr) => mapTrack(tr))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  return [...episodes, ...shows, ...playlists, ...tracks];
}

export async function fetchSpotifyLibrary(
  session: SpotifySession,
  onSessionUpdate: (next: SpotifySession | null) => void
): Promise<{
  shows: SpotifyMediaItem[];
  episodes: SpotifyMediaItem[];
  playlists: SpotifyMediaItem[];
}> {
  const data = await fetchWithSpotifyAuth<{
    shows?: Array<{ show?: RawSpotifyShow } | RawSpotifyShow>;
    episodes?: Array<{ episode?: RawSpotifyEpisode } | RawSpotifyEpisode>;
    playlists?: Array<RawSpotifyPlaylist | null>;
  }>('/api/spotify/library', session, onSessionUpdate);

  const shows = (data.shows || [])
    .map((item) => ('show' in item && item.show ? item.show : (item as RawSpotifyShow)))
    .map((sh) => mapShow(sh))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  const episodes = (data.episodes || [])
    .map((item) => ('episode' in item && item.episode ? item.episode : (item as RawSpotifyEpisode)))
    .map((ep) => mapEpisode(ep))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  const playlists = (data.playlists || [])
    .filter((i): i is RawSpotifyPlaylist => Boolean(i))
    .map((pl) => mapPlaylist(pl))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  return { shows, episodes, playlists };
}

export async function fetchSpotifyShowEpisodes(
  showId: string,
  showTitle: string,
  session: SpotifySession,
  onSessionUpdate: (next: SpotifySession | null) => void
): Promise<SpotifyMediaItem[]> {
  const data = await fetchWithSpotifyAuth<{ items?: Array<RawSpotifyEpisode | null> }>(
    `/api/spotify/shows/${encodeURIComponent(showId)}/episodes`,
    session,
    onSessionUpdate
  );
  return (data.items || [])
    .filter((i): i is RawSpotifyEpisode => Boolean(i))
    .map((ep) => mapEpisode(ep, showTitle))
    .filter((i): i is SpotifyMediaItem => Boolean(i));
}

export type ResolvedSpotifyResult =
  | {
      kind: 'user';
      user: LinkedSpotifyProfile;
      playlists: SpotifyMediaItem[];
      hasApiPlaylists: boolean;
    }
  | {
      kind: 'media';
      item: SpotifyMediaItem;
    }
  | {
      kind: 'home';
      canonicalUrl: string;
      title: string;
    };

export async function resolveSpotifyLink(
  rawUrl: string,
  session?: SpotifySession | null
): Promise<ResolvedSpotifyResult> {
  const headers: Record<string, string> = {};
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(`/api/spotify/resolve?url=${encodeURIComponent(rawUrl.trim())}`, {
    headers,
  });

  const data = (await res.json()) as {
    error?: string;
    kind?: 'user' | 'media' | 'home';
    user?: { id: string; displayName?: string; profileUrl: string; avatarUrl?: string };
    playlists?: Array<RawSpotifyPlaylist | null>;
    hasApiPlaylists?: boolean;
    item?: SpotifyMediaItem;
    canonicalUrl?: string;
    title?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível ler este link do Spotify.');
  }

  if (data.kind === 'user' && data.user) {
    const mappedPlaylists = (data.playlists || [])
      .filter((p): p is RawSpotifyPlaylist => Boolean(p))
      .map((pl) => mapPlaylist(pl))
      .filter((i): i is SpotifyMediaItem => Boolean(i));

    return {
      kind: 'user',
      user: {
        id: data.user.id,
        displayName: data.user.displayName || data.user.id,
        profileUrl: data.user.profileUrl,
        homeUrl: 'https://open.spotify.com/intl-pt',
        avatarUrl: data.user.avatarUrl,
      },
      playlists: mappedPlaylists,
      hasApiPlaylists: Boolean(data.hasApiPlaylists),
    };
  }

  if (data.kind === 'media' && data.item) {
    return {
      kind: 'media',
      item: data.item,
    };
  }

  return {
    kind: 'home',
    canonicalUrl: data.canonicalUrl || 'https://open.spotify.com/intl-pt',
    title: data.title || 'Spotify Web (Brasil / PT)',
  };
}

export async function fetchSpotifyUserPublicPlaylists(
  userId: string,
  session?: SpotifySession | null
): Promise<{ playlists: SpotifyMediaItem[]; requiresAuth: boolean }> {
  const headers: Record<string, string> = {};
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  const res = await fetch(`/api/spotify/users/${encodeURIComponent(userId)}/playlists`, {
    headers,
  });
  const data = (await res.json()) as {
    items?: Array<RawSpotifyPlaylist | null>;
    requiresAuth?: boolean;
  };
  const playlists = (data.items || [])
    .filter((p): p is RawSpotifyPlaylist => Boolean(p))
    .map((pl) => mapPlaylist(pl))
    .filter((i): i is SpotifyMediaItem => Boolean(i));

  return {
    playlists,
    requiresAuth: Boolean(data.requiresAuth),
  };
}

