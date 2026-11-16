import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Disc3,
  ExternalLink,
  Library,
  Link2,
  ListMusic,
  Loader2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  LinkedSpotifyProfile,
  SpotifyConfigStatus,
  SpotifyMediaItem,
  SpotifySession,
  fetchSpotifyLibrary,
  fetchSpotifyShowEpisodes,
  fetchSpotifyStatus,
  fetchSpotifyUserPublicPlaylists,
  formatSpotifyDuration,
  loadLinkedSpotifyProfile,
  loadSpotifySession,
  requestSpotifyAuthUrl,
  resolveSpotifyLink,
  saveLinkedSpotifyProfile,
  saveSpotifySession,
  searchSpotifyCatalog,
} from '../lib/spotify';
import { LibraryCategory, LibraryCategoryId } from '../types';

interface SpotifyPanelProps {
  categories: LibraryCategory[];
  selectedCategoryId: LibraryCategoryId;
  onChangeSelectedCategoryId: (id: LibraryCategoryId) => void;
  onPlayItem: (item: SpotifyMediaItem, categoryId: LibraryCategoryId) => void;
  onSaveItemToDiscipline: (item: SpotifyMediaItem, categoryId: LibraryCategoryId) => Promise<void>;
}

const STUDY_PRESET_QUERIES = [
  'Direito Constitucional concurso',
  'Direito Administrativo podcast',
  'Língua Portuguesa concurso',
  'Processo Legislativo podcast',
  'Lo-fi foco estudo',
  'Raciocínio Lógico concurso',
];

function kindLabel(kind: SpotifyMediaItem['kind']): string {
  if (kind === 'episode') return 'Episódio';
  if (kind === 'show') return 'Podcast';
  if (kind === 'playlist') return 'Playlist';
  return 'Faixa';
}

export function SpotifyPanel({
  categories,
  selectedCategoryId,
  onChangeSelectedCategoryId,
  onPlayItem,
  onSaveItemToDiscipline,
}: SpotifyPanelProps) {
  const [session, setSession] = useState<SpotifySession | null>(() => loadSpotifySession());
  const [linkedProfile, setLinkedProfile] = useState<LinkedSpotifyProfile>(() =>
    loadLinkedSpotifyProfile()
  );
  const [linkedPublicPlaylists, setLinkedPublicPlaylists] = useState<SpotifyMediaItem[]>([]);
  const [loadingLinkedPlaylists, setLoadingLinkedPlaylists] = useState(false);

  const [quickLinkInput, setQuickLinkInput] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState<SpotifyMediaItem | null>(null);

  const [configStatus, setConfigStatus] = useState<SpotifyConfigStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [blockedPopupUrl, setBlockedPopupUrl] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);

  const [activeTab, setActiveTab] = useState<'search' | 'podcasts' | 'playlists'>('search');
  const [searchQuery, setSearchQuery] = useState('Direito Constitucional concurso');
  const [searchResults, setSearchResults] = useState<SpotifyMediaItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [myShows, setMyShows] = useState<SpotifyMediaItem[]>([]);
  const [myEpisodes, setMyEpisodes] = useState<SpotifyMediaItem[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<SpotifyMediaItem[]>([]);

  const [expandedShowId, setExpandedShowId] = useState<string | null>(null);
  const [showEpisodesMap, setShowEpisodesMap] = useState<Record<string, SpotifyMediaItem[]>>({});
  const [loadingShowId, setLoadingShowId] = useState<string | null>(null);

  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [savedItemIds, setSavedItemIds] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const updateSession = useCallback((next: SpotifySession | null) => {
    setSession(next);
    saveSpotifySession(next);
  }, []);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await fetchSpotifyStatus();
      setConfigStatus(status);
    } catch {
      setConfigStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshLinkedProfilePlaylists = useCallback(
    async (profileId: string, activeSession: SpotifySession | null) => {
      setLoadingLinkedPlaylists(true);
      try {
        const res = await fetchSpotifyUserPublicPlaylists(profileId, activeSession);
        setLinkedPublicPlaylists(res.playlists);
      } catch {
        setLinkedPublicPlaylists([]);
      } finally {
        setLoadingLinkedPlaylists(false);
      }
    },
    []
  );

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (linkedProfile.id) {
      void refreshLinkedProfilePlaylists(linkedProfile.id, session);
    }
  }, [linkedProfile.id, session, refreshLinkedProfilePlaylists]);

  const handleLoadLibrary = useCallback(
    async (activeSession: SpotifySession) => {
      setLoadingLibrary(true);
      setErrorMsg(null);
      try {
        const lib = await fetchSpotifyLibrary(activeSession, updateSession);
        setMyShows(lib.shows);
        setMyEpisodes(lib.episodes);
        setMyPlaylists(lib.playlists);
        setLibraryLoaded(true);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar biblioteca do Spotify.');
      } finally {
        setLoadingLibrary(false);
      }
    },
    [updateSession]
  );

  // Listen to OAuth popup completion via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }

      const data = event.data as
        | { type?: string; payload?: SpotifySession; error?: string }
        | undefined;

      if (!data?.type) return;

      if (data.type === 'SPOTIFY_OAUTH_SUCCESS' && data.payload?.accessToken) {
        updateSession(data.payload);
        if (data.payload.user?.id) {
          const nextLinked: LinkedSpotifyProfile = {
            id: data.payload.user.id,
            displayName: data.payload.user.displayName || data.payload.user.id,
            profileUrl: data.payload.user.profileUrl || `https://open.spotify.com/user/${data.payload.user.id}`,
            homeUrl: 'https://open.spotify.com/intl-pt',
            avatarUrl: data.payload.user.avatarUrl,
          };
          setLinkedProfile(nextLinked);
          saveLinkedSpotifyProfile(nextLinked);
        }
        setConnecting(false);
        setBlockedPopupUrl(null);
        setShowOAuthHelp(false);
        setErrorMsg(null);
        setStatusFeedback(
          `Conta Spotify conectada${
            data.payload.user?.displayName ? ` (${data.payload.user.displayName})` : ''
          }!`
        );
        void handleLoadLibrary(data.payload);
      } else if (data.type === 'SPOTIFY_OAUTH_ERROR') {
        setConnecting(false);
        setErrorMsg(data.error || 'Não foi possível concluir a autenticação no Spotify.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleLoadLibrary, updateSession]);

  // Load user's Spotify library once when switching to library tabs
  useEffect(() => {
    if (session && !libraryLoaded && (activeTab === 'podcasts' || activeTab === 'playlists')) {
      void handleLoadLibrary(session);
    }
  }, [session, libraryLoaded, activeTab, handleLoadLibrary]);

  const handleConnectSpotify = async () => {
    setConnecting(true);
    setErrorMsg(null);
    setStatusFeedback(null);
    setBlockedPopupUrl(null);

    try {
      const authData = await requestSpotifyAuthUrl();
      setConfigStatus((prev) => ({
        configured: authData.configured,
        redirectUri: authData.redirectUri,
        scopes: prev?.scopes || [],
      }));

      if (!authData.configured || !authData.url) {
        setConnecting(false);
        setShowOAuthHelp(true);
        setErrorMsg(
          authData.error ||
            'Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET nas variáveis de ambiente para ativar o login OAuth.'
        );
        return;
      }

      const authWindow = window.open(
        authData.url,
        'spotify_oauth_popup',
        'width=580,height=720,noopener=no'
      );

      if (!authWindow) {
        setConnecting(false);
        setBlockedPopupUrl(authData.url);
        setErrorMsg(
          'O navegador bloqueou a janela popup do Spotify. Clique no botão "Abrir autorização do Spotify" abaixo para continuar.'
        );
      }
    } catch (err) {
      setConnecting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao iniciar conexão com o Spotify.');
    }
  };

  const handleDisconnectSpotify = () => {
    updateSession(null);
    setSearchResults([]);
    setMyShows([]);
    setMyEpisodes([]);
    setMyPlaylists([]);
    setLibraryLoaded(false);
    setExpandedShowId(null);
    setShowEpisodesMap({});
    setStatusFeedback('Sessão OAuth do Spotify desconectada (perfil público mantido como atalho).');
  };

  const handleCopyRedirectUri = async () => {
    const uri = configStatus?.redirectUri || `${window.location.origin}/api/spotify/callback`;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 2200);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleResolveQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLinkInput.trim()) return;

    setResolvingLink(true);
    setErrorMsg(null);
    setStatusFeedback(null);

    try {
      const result = await resolveSpotifyLink(quickLinkInput, session);
      if (result.kind === 'user') {
        setLinkedProfile(result.user);
        saveLinkedSpotifyProfile(result.user);
        setLinkedPublicPlaylists(result.playlists);
        setResolvedMedia(null);
        setQuickLinkInput('');
        setStatusFeedback(
          `Perfil Spotify "${result.user.displayName}" vinculado com sucesso!${
            result.playlists.length > 0
              ? ` ${result.playlists.length} playlist(s) pública(s) carregada(s).`
              : ''
          }`
        );
      } else if (result.kind === 'media') {
        setResolvedMedia(result.item);
        setQuickLinkInput('');
        setStatusFeedback(`Conteúdo "${result.item.title}" pronto para ouvir ou salvar na disciplina.`);
      } else {
        setLinkedProfile((prev) => {
          const next = { ...prev, homeUrl: result.canonicalUrl };
          saveLinkedSpotifyProfile(next);
          return next;
        });
        setQuickLinkInput('');
        setStatusFeedback('Atalho do Spotify Web (PT) atualizado.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar link do Spotify.');
    } finally {
      setResolvingLink(false);
    }
  };

  const handleSearch = async (queryOverride?: string) => {
    if (!session) return;
    const term = (queryOverride ?? searchQuery).trim();
    if (!term) return;

    if (queryOverride !== undefined) {
      setSearchQuery(queryOverride);
    }

    setSearching(true);
    setErrorMsg(null);
    try {
      const items = await searchSpotifyCatalog(term, session, updateSession);
      setSearchResults(items);
      if (items.length === 0) {
        setStatusFeedback(`Nenhum episódio, podcast ou playlist encontrado para "${term}".`);
      } else {
        setStatusFeedback(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao pesquisar no Spotify.');
    } finally {
      setSearching(false);
    }
  };

  const handleToggleShowEpisodes = async (show: SpotifyMediaItem) => {
    if (!session) return;
    if (expandedShowId === show.id) {
      setExpandedShowId(null);
      return;
    }

    setExpandedShowId(show.id);
    if (showEpisodesMap[show.id]) return;

    setLoadingShowId(show.id);
    setErrorMsg(null);
    try {
      const episodes = await fetchSpotifyShowEpisodes(show.id, show.title, session, updateSession);
      setShowEpisodesMap((prev) => ({ ...prev, [show.id]: episodes }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar episódios do podcast.');
    } finally {
      setLoadingShowId(null);
    }
  };

  const handleSaveItem = async (item: SpotifyMediaItem) => {
    setSavingItemId(item.id);
    setErrorMsg(null);
    try {
      await onSaveItemToDiscipline(item, selectedCategoryId);
      setSavedItemIds((prev) => ({ ...prev, [item.id]: true }));
      const targetCat = categories.find((c) => c.id === selectedCategoryId);
      setStatusFeedback(
        `"${item.title}" salvo em ${targetCat ? targetCat.title : 'Podcasts da disciplina'}.`
      );
      window.setTimeout(() => {
        setSavedItemIds((prev) => ({ ...prev, [item.id]: false }));
      }, 2600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar item do Spotify.');
    } finally {
      setSavingItemId(null);
    }
  };

  const renderMediaCard = (item: SpotifyMediaItem, allowExpandEpisodes = false) => {
    const duration = formatSpotifyDuration(item.durationMs);
    const isSaving = savingItemId === item.id;
    const isSaved = Boolean(savedItemIds[item.id]);
    const isExpanded = expandedShowId === item.id;
    const childEpisodes = showEpisodesMap[item.id] || [];

    return (
      <div
        key={`${item.kind}-${item.id}`}
        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3"
      >
        <div className="flex items-start gap-3">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[#0B3321] text-emerald-300 flex items-center justify-center shrink-0">
              <Disc3 className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="font-semibold text-[#1DB954] bg-emerald-950 px-2 py-0.5 rounded-md">
                {kindLabel(item.kind)}
              </span>
              {duration && <span className="text-slate-500 tabular-nums">{duration}</span>}
              {item.releaseDate && <span className="text-slate-400 tabular-nums">{item.releaseDate}</span>}
            </div>
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 mt-1 line-clamp-2">
              {item.title}
            </h3>
            <p className="text-xs text-slate-600 truncate mt-0.5">{item.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPlayItem(item, selectedCategoryId)}
              className="min-h-[36px] px-3 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Ouvir aqui</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveItem(item)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 border transition-colors ${
                isSaved
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 hover:border-[#0B3321] text-slate-800'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo na disciplina</span>
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-[#146C43]" />
                  <span>Salvar na disciplina</span>
                </>
              )}
            </button>

            {allowExpandEpisodes && item.kind === 'show' && (
              <button
                type="button"
                onClick={() => void handleToggleShowEpisodes(item)}
                className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-1"
              >
                <span>{isExpanded ? 'Ocultar episódios' : 'Ver episódios'}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <span>Spotify</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {allowExpandEpisodes && isExpanded && (
          <div className="pt-2 border-t border-slate-200 space-y-2">
            {loadingShowId === item.id ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#0B3321]" />
                <span>Carregando episódios recentes...</span>
              </div>
            ) : childEpisodes.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">Nenhum episódio listado para este programa.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {childEpisodes.map((ep) => {
                  const epDuration = formatSpotifyDuration(ep.durationMs);
                  const epSaved = Boolean(savedItemIds[ep.id]);
                  return (
                    <div
                      key={ep.id}
                      className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{ep.title}</p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {ep.releaseDate || 'Episódio'}
                          {epDuration ? ` · ${epDuration}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onPlayItem(ep, selectedCategoryId)}
                          className="min-h-[32px] px-2.5 py-1 bg-[#0B3321] text-white text-[11px] font-semibold rounded-md inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Ouvir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveItem(ep)}
                          className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold rounded-md border inline-flex items-center gap-1 ${
                            epSaved
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-[#0B3321]'
                          }`}
                        >
                          {epSaved ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          <span>{epSaved ? 'Salvo' : 'Salvar'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 text-[#1DB954] flex items-center justify-center shrink-0">
            <Disc3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Conexão com Spotify
              </h2>
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                  session
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-emerald-50 text-[#0B3321] border border-emerald-200'
                }`}
              >
                {session ? 'OAuth Conectado' : 'Perfil Vinculado'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Acesse seu perfil Spotify, cole links de episódios, podcasts ou playlists para ouvir aqui e salvar nas
              disciplinas, ou conecte sua conta via OAuth para busca e biblioteca completa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!session ? (
            <button
              type="button"
              disabled={connecting || loadingStatus}
              onClick={() => void handleConnectSpotify()}
              className="min-h-[40px] px-4 py-2 bg-[#1DB954] hover:bg-[#1aa34a] disabled:opacity-60 text-slate-950 text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Disc3 className="w-4 h-4" />
                  <span>Conectar conta (OAuth)</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={loadingLibrary}
                onClick={() => void handleLoadLibrary(session)}
                className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLibrary ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectSpotify}
                className="min-h-[38px] px-3 py-1.5 border border-slate-300 hover:border-red-300 hover:bg-red-50 text-slate-700 hover:text-red-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Linked Spotify Profile + Direct Shortcuts (Works immediately, with or without OAuth) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {linkedProfile.avatarUrl ? (
              <img
                src={linkedProfile.avatarUrl}
                alt={linkedProfile.displayName}
                className="w-11 h-11 rounded-full object-cover border border-slate-300 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#0B3321] text-emerald-300 font-display font-bold text-sm flex items-center justify-center shrink-0">
                {linkedProfile.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#146C43] inline-flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Conta Spotify vinculada</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 truncate">
                  ID: {linkedProfile.id}
                </span>
              </div>
              <p className="font-display text-base font-bold text-slate-900 truncate">
                {linkedProfile.displayName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={linkedProfile.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <span>Meu Perfil Spotify</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={linkedProfile.homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-3.5 py-1.5 bg-white border border-slate-300 hover:border-[#0B3321] text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <span>Spotify Web (PT)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {!session && !loadingStatus && configStatus && !configStatus.configured && (
              <button
                type="button"
                onClick={() => setShowOAuthHelp((prev) => !prev)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 underline"
              >
                {showOAuthHelp ? 'Ocultar guia OAuth' : 'Configurar OAuth'}
              </button>
            )}
          </div>
        </div>

        {/* Target Discipline + Quick Link Importer (works for episodes, shows, playlists, tracks, or another user profile) */}
        <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label htmlFor="spotify-quick-link" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-[#146C43]" />
              <span>Importar link direto do Spotify (episódio, podcast, playlist, faixa ou perfil)</span>
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor="spotify-target-cat" className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                Disciplina destino:
              </label>
              <select
                id="spotify-target-cat"
                value={selectedCategoryId}
                onChange={(e) => onChangeSelectedCategoryId(e.target.value as LibraryCategoryId)}
                className="min-h-[34px] px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.order).padStart(2, '0')} · {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={(e) => void handleResolveQuickLink(e)} className="flex flex-col sm:flex-row gap-2">
            <input
              id="spotify-quick-link"
              value={quickLinkInput}
              onChange={(e) => setQuickLinkInput(e.target.value)}
              placeholder="Cole aqui um link: https://open.spotify.com/episode/... ou playlist/... ou user/..."
              className="flex-1 min-h-[40px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
            />
            <button
              type="submit"
              disabled={resolvingLink || !quickLinkInput.trim()}
              className="min-h-[40px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              {resolvingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              <span>{resolvingLink ? 'Carregando...' : 'Carregar do Spotify'}</span>
            </button>
          </form>

          {resolvedMedia && (
            <div className="pt-1">
              {renderMediaCard(resolvedMedia, false)}
            </div>
          )}

          {loadingLinkedPlaylists ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B3321]" />
              <span>Buscando playlists públicas de {linkedProfile.displayName}...</span>
            </div>
          ) : (
            linkedPublicPlaylists.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Playlists públicas de {linkedProfile.displayName} ({linkedPublicPlaylists.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {linkedPublicPlaylists.map((pl) => renderMediaCard(pl, false))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Collapsible OAuth setup guide when SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not yet set */}
      {!session && showOAuthHelp && configStatus && !configStatus.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2.5 text-xs text-amber-950">
          <p className="font-semibold">
            Para habilitar busca e sincronização automática via OAuth (Spotify Developer Dashboard + Secrets):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-900">
            <li>
              Crie ou abra seu aplicativo em{' '}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline inline-flex items-center gap-1"
              >
                <span>developer.spotify.com/dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              .
            </li>
            <li>Adicione a Redirect URI exata abaixo nas configurações do app no Spotify:</li>
          </ol>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
            <code className="text-[11px] font-mono text-slate-900 break-all flex-1">
              {configStatus.redirectUri}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyRedirectUri()}
              className="min-h-[32px] px-3 py-1 bg-[#0B3321] text-white text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 shrink-0"
            >
              {copiedUri ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUri ? 'Copiado!' : 'Copiar URL'}</span>
            </button>
          </div>
          <p className="text-[11px] text-amber-900">
            Defina <code className="font-mono font-semibold">SPOTIFY_CLIENT_ID</code> e{' '}
            <code className="font-mono font-semibold">SPOTIFY_CLIENT_SECRET</code> nas variáveis de ambiente (Secrets)
            e clique em <strong>Conectar conta (OAuth)</strong>.
          </p>
        </div>
      )}

      {blockedPopupUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-emerald-950 font-medium">
            Clique para abrir a tela oficial de autorização do Spotify em uma nova aba:
          </span>
          <a
            href={blockedPopupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[36px] px-4 py-1.5 bg-[#1DB954] text-slate-950 font-bold rounded-lg inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Abrir autorização do Spotify</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900">
          {errorMsg}
        </div>
      )}

      {statusFeedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 font-medium">
          {statusFeedback}
        </div>
      )}

      {/* Connected OAuth Spotify Workspace */}
      {session && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* Sub-navigation tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'search'
                  ? 'bg-[#0B3321] border-[#0B3321] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar no Spotify</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('podcasts')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'podcasts'
                  ? 'bg-[#0B3321] border-[#0B3321] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>Meus Podcasts & Episódios ({myShows.length + myEpisodes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('playlists')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'playlists'
                  ? 'bg-[#0B3321] border-[#0B3321] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Minhas Playlists ({myPlaylists.length})</span>
            </button>
          </div>

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-3.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSearch();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex.: Direito Constitucional, Regimento Interno, Lo-fi foco..."
                  className="flex-1 min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="min-h-[42px] px-5 py-2 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 shrink-0"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{searching ? 'Buscando...' : 'Buscar no Spotify'}</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 inline-flex items-center gap-1 mr-1">
                  <Sparkles className="w-3 h-3 text-[#146C43]" />
                  Sugestões ALEPA:
                </span>
                {STUDY_PRESET_QUERIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => void handleSearch(preset)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 bg-slate-50 hover:border-[#0B3321] hover:bg-emerald-50 text-slate-700 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map((item) => renderMediaCard(item, false))}
                </div>
              )}
            </div>
          )}

          {/* My Podcasts & Saved Episodes Tab */}
          {activeTab === 'podcasts' && (
            <div className="space-y-4">
              {loadingLibrary ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0B3321]" />
                  <span>Carregando seus podcasts e episódios salvos no Spotify...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Programas seguidos ({myShows.length})
                    </h3>
                    {myShows.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Nenhum podcast seguido encontrado na sua conta Spotify. Use a aba "Buscar no Spotify" para
                        encontrar episódios.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {myShows.map((show) => renderMediaCard(show, true))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Episódios salvos ({myEpisodes.length})
                    </h3>
                    {myEpisodes.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum episódio salvo em "Seus Episódios" no Spotify.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {myEpisodes.map((ep) => renderMediaCard(ep, false))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* My Playlists Tab */}
          {activeTab === 'playlists' && (
            <div className="space-y-3">
              {loadingLibrary ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0B3321]" />
                  <span>Carregando suas playlists do Spotify...</span>
                </div>
              ) : myPlaylists.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma playlist encontrada na sua conta Spotify. Você também pode pesquisar playlists de foco na aba
                  "Buscar no Spotify".
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myPlaylists.map((pl) => renderMediaCard(pl, false))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
