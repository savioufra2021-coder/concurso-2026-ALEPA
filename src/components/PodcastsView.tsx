import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Headphones,
  Play,
  Plus,
  Radio,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isGeralMaterial } from '../data/alepaGeneralLibrary';
import { MEDIO_LIBRARY_CATEGORIES } from '../data/alepaMedioLibrary';
import { isMedioDisciplineId } from '../data/alepaMedioSyllabus';
import { LIBRARY_CATEGORIES } from '../data/alepaQuestions';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import { CampusLevel, LibraryCategoryId, MediaPlaybackPreference, StudyMaterial } from '../types';
import { SpotifyMediaItem } from '../lib/spotify';
import { ContentOrganizerModal } from './ContentOrganizerModal';
import { MediaPlaybackModal } from './MediaPlaybackModal';
import { PlaybackChoiceModal } from './PlaybackChoiceModal';
import { SpotifyPanel } from './SpotifyPanel';

interface PodcastPlayerTarget {
  mode: 'audio' | 'spotify' | 'youtube' | 'apple' | 'drive' | 'external';
  embedUrl: string | null;
  spotifyKind?: 'episode' | 'show' | 'track' | 'playlist' | 'album';
}

function parsePodcastEmbed(rawUrl: string): PodcastPlayerTarget {
  const url = rawUrl.trim();
  if (!url) return { mode: 'external', embedUrl: null };

  // Direct audio files (.mp3, .m4a, .ogg, .wav, .aac)
  if (/\.(mp3|m4a|ogg|wav|aac)(\?.*)?$/i.test(url)) {
    return { mode: 'audio', embedUrl: url };
  }

  // Spotify URI (spotify:episode:ID, spotify:show:ID, etc.)
  const spotifyUriMatch = url.match(/^spotify:(episode|show|track|playlist|album):([a-zA-Z0-9]+)$/i);
  if (spotifyUriMatch) {
    const kind = spotifyUriMatch[1].toLowerCase() as PodcastPlayerTarget['spotifyKind'];
    return {
      mode: 'spotify',
      spotifyKind: kind,
      embedUrl: `https://open.spotify.com/embed/${kind}/${spotifyUriMatch[2]}?utm_source=generator`,
    };
  }

  // Spotify episode / show / track / playlist / album URL
  const spotifyMatch = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|track|playlist|album)\/([a-zA-Z0-9]+)/i
  );
  if (spotifyMatch) {
    const kind = spotifyMatch[1].toLowerCase() as PodcastPlayerTarget['spotifyKind'];
    return {
      mode: 'spotify',
      spotifyKind: kind,
      embedUrl: `https://open.spotify.com/embed/${kind}/${spotifyMatch[2]}?utm_source=generator`,
    };
  }

  // YouTube / YouTube Music watch, short, live, shorts, playlist
  const ytWatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (ytWatch) {
    return { mode: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytWatch[1]}` };
  }
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytShort) {
    return { mode: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytShort[1]}` };
  }
  const ytShorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (ytShorts) {
    return { mode: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytShorts[1]}` };
  }
  const ytList = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (ytList && url.includes('youtube.com')) {
    return { mode: 'youtube', embedUrl: `https://www.youtube.com/embed/videoseries?list=${ytList[1]}` };
  }

  // Apple Podcasts
  if (/podcasts\.apple\.com\//i.test(url)) {
    return {
      mode: 'apple',
      embedUrl: url.replace(/^https:\/\/podcasts\.apple\.com/i, 'https://embed.podcasts.apple.com'),
    };
  }

  // Google Drive audio file
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return {
      mode: 'drive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  return { mode: 'external', embedUrl: null };
}

function getPlatformLabel(rawUrl: string, fallbackInstitution?: string): string {
  const lower = rawUrl.toLowerCase();
  if (lower.includes('spotify.com')) return 'Spotify';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube / YT Music';
  if (lower.includes('podcasts.apple.com')) return 'Apple Podcasts';
  if (lower.includes('deezer.com')) return 'Deezer';
  if (lower.includes('drive.google.com')) return 'Google Drive Áudio';
  if (/\.(mp3|m4a|ogg|wav|aac)(\?|$)/i.test(lower)) return 'Áudio Direto';
  return fallbackInstitution || 'Portal de Podcast';
}

export function PodcastsView({ campus }: { campus: CampusLevel }) {
  const {
    materials,
    addMaterial,
    deleteMaterial,
    user,
    profile,
    isAdmin,
    canPublishShared,
    preferences,
    updateStudentPreferences,
    mediaProgressMap,
    saveMediaProgress,
  } = useAuth();

  const isMedio = campus === 'medio';
  const activeCategories = isMedio ? MEDIO_LIBRARY_CATEGORIES : LIBRARY_CATEGORIES;

  const [selectedCategory, setSelectedCategory] = useState<'all' | LibraryCategoryId>('all');
  const [showEmptyDisciplines, setShowEmptyDisciplines] = useState(true);

  // Quick Add Podcast Form State
  const [categoryId, setCategoryId] = useState<LibraryCategoryId>(
    isMedio ? MEDIO_LIBRARY_CATEGORIES[0].id : LIBRARY_CATEGORIES[5].id
  );
  const [title, setTitle] = useState('');
  const [podcastUrl, setPodcastUrl] = useState('');
  const [editalTopic, setEditalTopic] = useState('');
  const [channelName, setChannelName] = useState('');
  const [notes, setNotes] = useState('');
  const [isOfficial, setIsOfficial] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Active Embedded Player & Unified Playback Modal / Organizer State
  const [activePodcast, setActivePodcast] = useState<StudyMaterial | null>(null);
  const [playbackChoiceTarget, setPlaybackChoiceTarget] = useState<{
    material: StudyMaterial;
    startSeconds?: number;
  } | null>(null);
  const [modalPlayer, setModalPlayer] = useState<{
    material: StudyMaterial;
    mode: 'internal' | 'external';
    startSeconds?: number;
  } | null>(null);
  const [organizingPodcast, setOrganizingPodcast] = useState<StudyMaterial | null>(null);

  useEffect(() => {
    setSelectedCategory('all');
    setCategoryId(isMedio ? MEDIO_LIBRARY_CATEGORIES[0].id : LIBRARY_CATEGORIES[5].id);
    setActivePodcast(null);
  }, [isMedio]);

  const allPodcasts = useMemo(
    () =>
      materials.filter((m) => {
        if (m.resourceType !== 'podcast') return false;
        if (m.campusLevel === 'geral' || isGeralMaterial(m)) return true;
        if (m.campusLevel === 'medio') return isMedio;
        if (m.campusLevel === 'superior') return !isMedio;
        const belongsToMedio =
          isMedioDisciplineId(m.disciplineId) || Boolean(m.libraryCategoryId?.startsWith('nm_cat_'));
        return isMedio ? belongsToMedio : !belongsToMedio;
      }),
    [materials, isMedio]
  );

  const podcastsByCategory = useMemo(() => {
    const map: Record<string, StudyMaterial[]> = {};
    activeCategories.forEach((cat) => {
      map[cat.id] = [];
    });

    const geralToDisciplineId: Record<string, string> = isMedio
      ? {
          geral_portugues: 'nm_portugues',
          geral_raciocinio_logico: 'nm_raciocinio_logico',
          geral_informatica: 'nm_informatica',
          geral_constitucional: 'nm_01_04_constitucional',
          geral_administrativo: 'nm_01_04_administrativo',
          geral_legislacao_alepa: 'nm_legislacao_etica',
          geral_etica: 'nm_legislacao_etica',
          geral_tecnica_legislativa: 'nm_01_04_tecnica_legislativa',
        }
      : {
          geral_portugues: 'portugues',
          geral_raciocinio_logico: 'raciocinio_logico',
          geral_informatica: 'informatica',
          geral_constitucional: 'direito_constitucional',
          geral_administrativo: 'direito_administrativo',
          geral_legislacao_alepa: 'legislacao_etica',
          geral_etica: 'legislacao_etica',
          geral_tecnica_legislativa: 'processo_legislativo',
        };

    allPodcasts.forEach((pod) => {
      if (pod.libraryCategoryId && map[pod.libraryCategoryId]) {
        map[pod.libraryCategoryId].push(pod);
        return;
      }
      const mappedDiscId = geralToDisciplineId[pod.disciplineId] || pod.disciplineId;
      const fallbackCat = activeCategories.find((c) => c.disciplineId === mappedDiscId);
      if (fallbackCat) {
        map[fallbackCat.id].push(pod);
      } else {
        map[activeCategories[0].id].push(pod);
      }
    });

    return map;
  }, [allPodcasts, activeCategories, isMedio]);

  const visibleCategories = useMemo(() => {
    return activeCategories.filter((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) return false;
      if (!showEmptyDisciplines && (podcastsByCategory[cat.id]?.length || 0) === 0) return false;
      return true;
    });
  }, [activeCategories, selectedCategory, showEmptyDisciplines, podcastsByCategory]);

  const handleAddPodcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !podcastUrl.trim()) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const cat = activeCategories.find((c) => c.id === categoryId) || activeCategories[0];
      const todayIso = new Date().toISOString().slice(0, 10);

      await addMaterial({
        title: title.trim(),
        disciplineId: cat.disciplineId,
        libraryCategoryId: cat.id,
        editalTopic: editalTopic.trim() || cat.title,
        resourceType: 'podcast',
        fileType: 'video',
        institution: channelName.trim() || getPlatformLabel(podcastUrl),
        url: podcastUrl.trim(),
        pricing: 'gratuito',
        publishedAt: todayIso,
        lastVerifiedAt: todayIso,
        linkStatus: 'ativo',
        isOfficialContent: isOfficial,
        description: notes.trim(),
        isShared,
      });

      // Keep selected discipline so user can add multiple podcasts to the same discipline smoothly
      setTitle('');
      setPodcastUrl('');
      setEditalTopic('');
      setNotes('');
      setFeedback(`Podcast adicionado em "${cat.title}". Você pode cadastrar mais episódios nesta mesma disciplina.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar podcast.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFocusDisciplineForm = (catId: LibraryCategoryId) => {
    setCategoryId(catId);
    const formEl = document.getElementById('podcast-add-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const launchPodcastPlayback = (pod: StudyMaterial, mode: 'internal' | 'external', startSeconds?: number) => {
    setModalPlayer({ material: pod, mode, startSeconds });
    if (mode === 'external') {
      void saveMediaProgress(pod.id, {
        materialTitle: pod.title,
        mediaType: 'audio',
        preferredMode: 'external',
        openedExternallyAt: new Date().toISOString(),
      });
    }
  };

  const handleOpenPodcast = (pod: StudyMaterial, startSeconds?: number) => {
    const pref = preferences.mediaPlaybackPreference || 'ask';
    if (pref === 'ask') {
      setPlaybackChoiceTarget({ material: pod, startSeconds });
      return;
    }
    launchPodcastPlayback(pod, pref === 'external' ? 'external' : 'internal', startSeconds);
  };

  const handlePlaybackChoice = (mode: 'internal' | 'external', savePreference?: MediaPlaybackPreference) => {
    if (!playbackChoiceTarget) return;
    const { material, startSeconds } = playbackChoiceTarget;
    if (savePreference) {
      void updateStudentPreferences({ mediaPlaybackPreference: savePreference });
    }
    setPlaybackChoiceTarget(null);
    launchPodcastPlayback(material, mode, startSeconds);
  };

  const handlePlaySpotifyItem = (item: SpotifyMediaItem, targetCatId: LibraryCategoryId) => {
    const cat = activeCategories.find((c) => c.id === targetCatId) || activeCategories[0];
    setActivePodcast({
      id: `spotify_preview_${item.kind}_${item.id}`,
      ownerId: user?.uid || profile?.uid || 'spotify',
      title: item.title,
      disciplineId: cat.disciplineId,
      libraryCategoryId: cat.id,
      editalTopic: item.subtitle,
      resourceType: 'podcast',
      fileType: 'video',
      institution: 'Spotify',
      url: item.url,
      description: item.description || '',
      isShared: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSpotifyItemToDiscipline = async (
    item: SpotifyMediaItem,
    targetCatId: LibraryCategoryId
  ) => {
    const cat = activeCategories.find((c) => c.id === targetCatId) || activeCategories[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    await addMaterial({
      title: item.title,
      disciplineId: cat.disciplineId,
      libraryCategoryId: cat.id,
      editalTopic: item.subtitle || cat.title,
      resourceType: 'podcast',
      fileType: 'video',
      institution: 'Spotify',
      url: item.url,
      pricing: 'gratuito',
      publishedAt: item.releaseDate || todayIso,
      lastVerifiedAt: todayIso,
      linkStatus: 'ativo',
      isOfficialContent: false,
      description: item.description ? item.description.slice(0, 240) : `${item.subtitle} · Importado do Spotify`,
      isShared: false,
    });
  };

  const playerTarget = activePodcast ? parsePodcastEmbed(activePodcast.url) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
            {isMedio
              ? 'ALEPA 2026 – Nível Médio · Cargo 04 – Assistência Administrativa (PL.AL.060) · Múltiplos episódios por disciplina'
              : 'ALEPA 2026 – Nível Superior · Cargo 03 – Técnico Legislativo (PL.AL.102) · Múltiplos episódios por disciplina'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Podcasts & Aulas em Áudio ({isMedio ? 'Nível Médio' : 'Nível Superior'})
          </h1>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          Total cadastrado: <strong className="text-slate-900 dark:text-slate-100">{allPodcasts.length}</strong>{' '}
          {allPodcasts.length === 1 ? 'podcast' : 'podcasts'}
        </div>
      </div>

      {/* Active Embedded Podcast Player */}
      {activePodcast && playerTarget && (
        <section className="bg-[#0B3321] text-white rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <Radio className="w-4 h-4 shrink-0" />
                <span>
                  Tocando agora ·{' '}
                  {activeCategories.find((c) => c.id === activePodcast.libraryCategoryId)?.title ||
                    getDisciplineShortName(activePodcast.disciplineId)}
                </span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white mt-1 truncate">
                {activePodcast.title}
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                {getPlatformLabel(activePodcast.url, activePodcast.institution)}
                {activePodcast.editalTopic ? ` · ${activePodcast.editalTopic}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={activePodcast.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <span>Abrir externo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setActivePodcast(null)}
                aria-label="Fechar player"
                className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {playerTarget.mode === 'audio' && playerTarget.embedUrl ? (
            <audio controls autoPlay src={playerTarget.embedUrl} className="w-full" />
          ) : playerTarget.embedUrl ? (
            <iframe
              title={activePodcast.title}
              src={playerTarget.embedUrl}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className={`w-full rounded-xl border border-white/15 bg-slate-950 ${
                playerTarget.mode === 'spotify'
                  ? playerTarget.spotifyKind === 'playlist' ||
                    playerTarget.spotifyKind === 'show' ||
                    playerTarget.spotifyKind === 'album'
                    ? 'h-[352px]'
                    : 'h-[160px]'
                  : playerTarget.mode === 'apple'
                    ? 'h-[160px]'
                    : 'h-[260px] sm:h-[320px]'
              }`}
            />
          ) : (
            <div className="p-4 rounded-xl bg-white/10 text-xs text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>
                Este link abre diretamente no aplicativo ou portal de áudio de origem (
                {getPlatformLabel(activePodcast.url)}).
              </span>
              <a
                href={activePodcast.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-4 py-1.5 bg-white text-[#0B3321] font-semibold rounded-xl inline-flex items-center gap-1.5 shrink-0"
              >
                <span>Ouvir no portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </section>
      )}

      {/* Conexão OAuth com Spotify + Busca + Biblioteca */}
      <SpotifyPanel
        categories={activeCategories}
        selectedCategoryId={categoryId}
        onChangeSelectedCategoryId={setCategoryId}
        onPlayItem={handlePlaySpotifyItem}
        onSaveItemToDiscipline={handleSaveSpotifyItemToDiscipline}
      />

      {/* Add Multiple Podcasts Form */}
      <section id="podcast-add-form" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Headphones className="w-5 h-5 text-[#0B3321] dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Cadastrar Novo Link de Podcast por Disciplina
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Adicione quantos episódios quiser por disciplina (Spotify, YouTube, Apple Podcasts, Deezer, Google Drive
              ou MP3). Todos ficam salvos na sua conta em nuvem.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddPodcast} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="pod-cat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Disciplina / Categoria ({isMedio ? 'Nível Médio · 1–11' : 'Nível Superior · 1–10'})
              </label>
              <select
                id="pod-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value as LibraryCategoryId)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.order).padStart(2, '0')} · {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pod-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Título do episódio / podcast
              </label>
              <input
                id="pod-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Ep. 04 – Comissões e Quóruns na ALEPA"
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="pod-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Link do podcast
              </label>
              <input
                id="pod-url"
                type="url"
                required
                value={podcastUrl}
                onChange={(e) => setPodcastUrl(e.target.value)}
                placeholder="https://open.spotify.com/episode/... ou https://youtu.be/..."
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="pod-topic" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tópico do edital (opcional)
              </label>
              <input
                id="pod-topic"
                value={editalTopic}
                onChange={(e) => setEditalTopic(e.target.value)}
                placeholder="Ex.: Tramitação de proposições e LC 95/98"
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="pod-channel" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Canal / Programa (opcional)
              </label>
              <input
                id="pod-channel"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Ex.: Rádio Senado / Spotify Direito"
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="pod-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Observação rápida (opcional)
              </label>
              <input
                id="pod-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Ouvir no deslocamento · 25 min"
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOfficial}
                  onChange={(e) => setIsOfficial(e.target.checked)}
                />
                <span>Fonte oficial (Senado / Câmara / ALEPA / Escola de Governo)</span>
              </label>

              {canPublishShared && (
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                  />
                  <span>Compartilhar com a turma</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-5 py-2 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Salvando...' : 'Adicionar podcast à disciplina'}</span>
            </button>
          </div>
        </form>

        {feedback && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium">
            {feedback}
          </div>
        )}
      </section>

      {/* Filter by Discipline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#0B3321] border-[#0B3321] text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            Todas ({allPodcasts.length})
          </button>

          {activeCategories.map((cat) => {
            const count = podcastsByCategory[cat.id]?.length || 0;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[#0B3321] border-[#0B3321] text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {String(cat.order).padStart(2, '0')} · {cat.title.split(' e ')[0]}{' '}
                <span className="font-mono tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={showEmptyDisciplines}
            onChange={(e) => setShowEmptyDisciplines(e.target.checked)}
          />
          <span>Exibir disciplinas sem episódios</span>
        </label>
      </div>

      {/* Grouped Podcasts per Discipline (supports multiple episodes per discipline) */}
      <div className="space-y-4">
        {visibleCategories.map((cat) => {
          const list = podcastsByCategory[cat.id] || [];
          return (
            <section
              key={cat.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#0B3321] dark:text-emerald-400 font-semibold tabular-nums">
                    <span>{String(cat.order).padStart(2, '0')}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {list.length} {list.length === 1 ? 'podcast cadastrado' : 'podcasts cadastrados'}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{cat.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleFocusDisciplineForm(cat.id)}
                  className="min-h-[38px] px-3.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:border-[#0B3321] dark:hover:border-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                  <span>Adicionar podcast aqui</span>
                </button>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Nenhum podcast vinculado a esta disciplina ainda. Clique em "Adicionar podcast aqui" para incluir o
                  primeiro episódio.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((pod, idx) => {
                    const uid = user?.uid || profile?.uid;
                    const canDelete = !pod.isSystemDefault && (isAdmin || pod.ownerId === uid);
                    const canOrganize = canPublishShared || (!pod.isSystemDefault && pod.ownerId === uid);
                    const isPlaying = activePodcast?.id === pod.id || modalPlayer?.material.id === pod.id;
                    const platform = getPlatformLabel(pod.url, pod.institution);
                    const mediaProg = mediaProgressMap[pod.id];

                    return (
                      <article
                        key={pod.id}
                        className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                          isPlaying
                            ? 'border-[#0B3321] dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/60'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-semibold text-[#0B3321] dark:text-emerald-400 tabular-nums">
                              #{String(idx + 1).padStart(2, '0')} · {platform}
                            </span>
                            <span
                              className={
                                pod.isOfficialContent ? 'font-semibold text-[#146C43] dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                              }
                            >
                              {pod.isOfficialContent ? 'Oficial' : 'Complementar'}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{pod.title}</h3>
                          {pod.subtitle && (
                            <p className="text-xs font-medium text-[#146C43] dark:text-emerald-400">
                              {pod.subtitle}
                            </p>
                          )}
                          {mediaProg && mediaProg.progressPercent > 0 && (
                            <p className="text-[11px] font-mono tabular-nums text-[#146C43] dark:text-emerald-400 font-semibold">
                              Progresso salvo: {mediaProg.progressPercent}%
                            </p>
                          )}
                          {pod.editalTopic && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Assunto:</span> {pod.editalTopic}
                            </p>
                          )}
                          {pod.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{pod.description}</p>
                          )}
                          {pod.chapters && pod.chapters.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1.5">
                              {pod.chapters.slice(0, 4).map((ch) => (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={() => handleOpenPodcast(pod, ch.startSeconds)}
                                  className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                                >
                                  {ch.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPodcast(pod)}
                              className="min-h-[36px] px-3 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>
                                {isPlaying
                                  ? 'No tocador'
                                  : mediaProg && mediaProg.currentTimeSeconds > 0
                                    ? 'Continuar áudio'
                                    : 'Ouvir agora'}
                              </span>
                            </button>

                            <a
                              href={pod.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[36px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
                            >
                              <span>Abrir link</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          <div className="flex items-center gap-1">
                            {canOrganize && (
                              <button
                                type="button"
                                onClick={() => setOrganizingPodcast(pod)}
                                aria-label="Organizar capítulos e metadados"
                                className="min-h-[36px] px-2.5 flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B3321] dark:text-emerald-300 hover:bg-white dark:hover:bg-slate-900"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Organizar</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (activePodcast?.id === pod.id) setActivePodcast(null);
                                  void deleteMaterial(pod.id);
                                }}
                                aria-label="Excluir podcast"
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {playbackChoiceTarget && (
        <PlaybackChoiceModal
          material={playbackChoiceTarget.material}
          currentPreference={preferences.mediaPlaybackPreference || 'ask'}
          onChooseInternal={(savePref) => handlePlaybackChoice('internal', savePref)}
          onChooseExternal={(savePref) => handlePlaybackChoice('external', savePref)}
          onClose={() => setPlaybackChoiceTarget(null)}
        />
      )}

      {modalPlayer && (
        <MediaPlaybackModal
          material={modalPlayer.material}
          initialMode={modalPlayer.mode}
          initialStartSeconds={modalPlayer.startSeconds}
          onClose={() => setModalPlayer(null)}
        />
      )}

      {organizingPodcast && (
        <ContentOrganizerModal
          material={organizingPodcast}
          campus={campus}
          onClose={() => setOrganizingPodcast(null)}
        />
      )}
    </div>
  );
}
