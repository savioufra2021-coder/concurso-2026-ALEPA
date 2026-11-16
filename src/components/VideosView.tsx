import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Film,
  Filter,
  Globe,
  Layers,
  Lock,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GERAL_LIBRARY_CATEGORIES } from '../data/alepaGeneralLibrary';
import { MEDIO_LIBRARY_CATEGORIES } from '../data/alepaMedioLibrary';
import { LIBRARY_CATEGORIES } from '../data/alepaQuestions';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import {
  buildVideoCategoryGroups,
  filterVideosByScope,
  matchesVideoCategoryGroup,
} from '../lib/filterHelpers';
import {
  CampusLevel,
  LibraryCategory,
  LibraryCategoryId,
  LibraryScope,
  MediaPlaybackPreference,
  StudyMaterial,
} from '../types';
import { ContentOrganizerModal } from './ContentOrganizerModal';
import { MediaPlaybackModal } from './MediaPlaybackModal';
import { PlaybackChoiceModal } from './PlaybackChoiceModal';

type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'vimeo' | 'drive' | 'direct' | 'other';
type VideoFilterScope = 'all' | LibraryScope;

interface VideoPlayerTarget {
  platform: VideoPlatform;
  platformLabel: string;
  embedUrl: string | null;
  youtubeId: string | null;
  thumbnailUrl: string | null;
}

export function normalizeVideoUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
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

export function parseVideoEmbed(rawUrl: string, fallbackInstitution?: string): VideoPlayerTarget {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();
  if (!url) {
    return { platform: 'other', platformLabel: 'Link de Vídeo', embedUrl: null, youtubeId: null, thumbnailUrl: null };
  }

  // Direct video files
  if (/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(url)) {
    return { platform: 'direct', platformLabel: 'Vídeo Direto', embedUrl: url, youtubeId: null, thumbnailUrl: null };
  }

  // YouTube (watch, youtu.be, shorts, live, embed, playlist)
  const ytId = extractYouTubeId(url);
  if (ytId) {
    const label = lower.includes('/shorts/')
      ? 'YouTube Shorts'
      : lower.includes('/live/')
        ? 'YouTube Live'
        : 'YouTube';
    return {
      platform: 'youtube',
      platformLabel: label,
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
      youtubeId: ytId,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    };
  }
  const ytList = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (ytList && lower.includes('youtube.com')) {
    return {
      platform: 'youtube',
      platformLabel: 'YouTube Playlist',
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${ytList[1]}`,
      youtubeId: null,
      thumbnailUrl: null,
    };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { platform: 'youtube', platformLabel: 'YouTube', embedUrl: null, youtubeId: null, thumbnailUrl: null };
  }

  // Instagram (Reels, Posts, IGTV)
  const igMatch = url.match(/instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch) {
    const igKind = igMatch[1].toLowerCase() === 'reels' ? 'reel' : igMatch[1].toLowerCase();
    return {
      platform: 'instagram',
      platformLabel: igKind === 'reel' ? 'Instagram Reels' : 'Instagram',
      embedUrl: `https://www.instagram.com/${igKind}/${igMatch[2]}/embed/`,
      youtubeId: null,
      thumbnailUrl: null,
    };
  }
  if (lower.includes('instagram.com')) {
    return { platform: 'instagram', platformLabel: 'Instagram', embedUrl: null, youtubeId: null, thumbnailUrl: null };
  }

  // TikTok
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i) || url.match(/tiktok\.com\/v\/(\d+)/i);
  if (ttMatch) {
    return {
      platform: 'tiktok',
      platformLabel: 'TikTok',
      embedUrl: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
      youtubeId: null,
      thumbnailUrl: null,
    };
  }
  if (lower.includes('tiktok.com')) {
    return { platform: 'tiktok', platformLabel: 'TikTok', embedUrl: null, youtubeId: null, thumbnailUrl: null };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return {
      platform: 'vimeo',
      platformLabel: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      youtubeId: null,
      thumbnailUrl: null,
    };
  }

  // Google Drive Video
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveMatch) {
    return {
      platform: 'drive',
      platformLabel: 'Google Drive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      youtubeId: null,
      thumbnailUrl: null,
    };
  }
  if (lower.includes('drive.google.com')) {
    return { platform: 'drive', platformLabel: 'Google Drive', embedUrl: null, youtubeId: null, thumbnailUrl: null };
  }

  // Other domains (Kwai, Facebook, hotmart, etc.)
  let hostLabel = fallbackInstitution || 'Link de Vídeo';
  try {
    const parsedHost = new URL(url).hostname.replace(/^www\./, '');
    if (parsedHost.includes('kwai')) hostLabel = 'Kwai';
    else if (parsedHost.includes('facebook') || parsedHost.includes('fb.watch')) hostLabel = 'Facebook';
    else if (!fallbackInstitution) hostLabel = parsedHost;
  } catch {
    // ignore URL parse error
  }

  return {
    platform: 'other',
    platformLabel: hostLabel,
    embedUrl: null,
    youtubeId: null,
    thumbnailUrl: null,
  };
}

export function YouTubeBrandIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function PlatformIcon({ platform, className = 'w-4 h-4' }: { platform: VideoPlatform; className?: string }) {
  if (platform === 'youtube') {
    return <YouTubeBrandIcon className={className} />;
  }
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
        <defs>
          <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F58529" />
            <stop offset="50%" stopColor="#DD2A7B" />
            <stop offset="100%" stopColor="#8134AF" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="#FFFFFF" strokeWidth="1.9" />
        <circle cx="17.3" cy="6.7" r="1.2" fill="#FFFFFF" />
      </svg>
    );
  }
  if (platform === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#0F172A" />
        <path
          fill="#25F4EE"
          d="M15.7 5.2c.7 1.1 1.7 1.9 3 2.1v2.5c-1.2 0-2.3-.3-3.2-.9v5.2a4.6 4.6 0 1 1-4.6-4.6c.4 0 .7 0 1 .1v2.5a2.1 2.1 0 1 0 1.4 2V4.5h2.4v.7z"
        />
        <path
          fill="#FE2C55"
          d="M16.3 5.8c.7 1 1.7 1.7 2.9 1.9v2.4c-1.2 0-2.3-.3-3.2-.9v5.1a4.5 4.5 0 0 1-4.5 4.5c-1.2 0-2.3-.5-3.1-1.2a4.5 4.5 0 0 0 6.8-3.9V4.8h1.1v1z"
          opacity="0.7"
        />
      </svg>
    );
  }
  return <Video className={`${className} text-emerald-700 shrink-0`} />;
}

export function VideosView({
  campus,
  onSummarizeWithGemini,
}: {
  campus: CampusLevel;
  onSummarizeWithGemini?: (target: {
    mode: 'video';
    materialId?: string;
    url?: string;
    title?: string;
    disciplineId?: string;
  }) => void;
}) {
  const {
    materials,
    addMaterial,
    deleteMaterial,
    user,
    profile,
    isAdmin,
    canPublishShared,
    canAccessTeacherPanel,
    loginWithGoogle,
    preferences,
    updateStudentPreferences,
    mediaProgressMap,
    saveMediaProgress,
  } = useAuth();

  const canCreateVideo = canPublishShared || canAccessTeacherPanel;
  const isMedio = campus === 'medio';
  const [libraryScope, setLibraryScope] = useState<VideoFilterScope>('all');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | VideoPlatform>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Collapsible filter panels (always collapsed by default)
  const [levelFilterOpen, setLevelFilterOpen] = useState(false);
  const [platformFilterOpen, setPlatformFilterOpen] = useState(false);
  const [disciplineFilterOpen, setDisciplineFilterOpen] = useState(false);

  // Add Video Form State
  const [formScope, setFormScope] = useState<LibraryScope>(isMedio ? 'medio' : 'superior');
  const [categoryId, setCategoryId] = useState<LibraryCategoryId>(
    isMedio ? MEDIO_LIBRARY_CATEGORIES[0].id : LIBRARY_CATEGORIES[0].id
  );
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [editalTopic, setEditalTopic] = useState('');
  const [channelName, setChannelName] = useState('');
  const [notes, setNotes] = useState('');
  const [isShared, setIsShared] = useState<boolean>(canPublishShared);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Active Video Player & Modal Playback / Organizer State
  const [activeVideo, setActiveVideo] = useState<StudyMaterial | null>(null);
  const [playbackChoiceTarget, setPlaybackChoiceTarget] = useState<{
    material: StudyMaterial;
    startSeconds?: number;
  } | null>(null);
  const [modalPlayer, setModalPlayer] = useState<{
    material: StudyMaterial;
    mode: 'internal' | 'external';
    startSeconds?: number;
  } | null>(null);
  const [organizingVideo, setOrganizingVideo] = useState<StudyMaterial | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const playerSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nextFormScope: LibraryScope = isMedio ? 'medio' : 'superior';
    setFormScope(nextFormScope);
    setCategoryId(isMedio ? MEDIO_LIBRARY_CATEGORIES[0].id : LIBRARY_CATEGORIES[0].id);
  }, [isMedio]);

  useEffect(() => {
    setIsShared(canPublishShared);
  }, [canPublishShared]);

  const formCategories =
    formScope === 'geral'
      ? GERAL_LIBRARY_CATEGORIES
      : formScope === 'medio'
        ? MEDIO_LIBRARY_CATEGORIES
        : LIBRARY_CATEGORIES;

  const allVideoMaterials = useMemo(() => {
    return materials.filter((m) => {
      return (
        m.resourceType === 'video' ||
        m.fileType === 'video' ||
        /youtube\.com|youtu\.be|instagram\.com|tiktok\.com|vimeo\.com|fb\.watch|kwai/i.test(m.url)
      );
    });
  }, [materials]);

  const scopeCounts = useMemo(
    () => ({
      all: allVideoMaterials.length,
      geral: filterVideosByScope(allVideoMaterials, 'geral').length,
      superior: filterVideosByScope(allVideoMaterials, 'superior').length,
      medio: filterVideosByScope(allVideoMaterials, 'medio').length,
    }),
    [allVideoMaterials]
  );

  const videoMaterials = useMemo(
    () => filterVideosByScope(allVideoMaterials, libraryScope),
    [allVideoMaterials, libraryScope]
  );

  const platformFilteredVideos = useMemo(() => {
    if (platformFilter === 'all') return videoMaterials;
    return videoMaterials.filter((v) => parseVideoEmbed(v.url, v.institution).platform === platformFilter);
  }, [videoMaterials, platformFilter]);

  const categoryGroups = useMemo(
    () => buildVideoCategoryGroups(libraryScope, platformFilteredVideos),
    [libraryScope, platformFilteredVideos]
  );

  const filteredVideos = useMemo(() => {
    if (selectedCategory === 'all') return platformFilteredVideos;
    return platformFilteredVideos.filter((v) => matchesVideoCategoryGroup(v, selectedCategory, categoryGroups));
  }, [platformFilteredVideos, selectedCategory, categoryGroups]);

  const activePlayer = activeVideo ? parseVideoEmbed(activeVideo.url, activeVideo.institution) : null;
  const formUrlPreview = useMemo(
    () => parseVideoEmbed(normalizeVideoUrl(videoUrl), channelName),
    [videoUrl, channelName]
  );

  const launchMediaPlayback = (vid: StudyMaterial, mode: 'internal' | 'external', startSeconds?: number) => {
    setModalPlayer({ material: vid, mode, startSeconds });
    if (mode === 'external') {
      void saveMediaProgress(vid.id, {
        materialTitle: vid.title,
        mediaType: 'video',
        preferredMode: 'external',
        openedExternallyAt: new Date().toISOString(),
      });
    }
  };

  const handleOpenPlayer = (vid: StudyMaterial, startSeconds?: number) => {
    const pref = preferences.mediaPlaybackPreference || 'ask';
    if (pref === 'ask') {
      setPlaybackChoiceTarget({ material: vid, startSeconds });
      return;
    }
    launchMediaPlayback(vid, pref === 'external' ? 'external' : 'internal', startSeconds);
  };

  const handlePlaybackChoice = (mode: 'internal' | 'external', savePreference?: MediaPlaybackPreference) => {
    if (!playbackChoiceTarget) return;
    const { material, startSeconds } = playbackChoiceTarget;
    if (savePreference) {
      void updateStudentPreferences({ mediaPlaybackPreference: savePreference });
    }
    setPlaybackChoiceTarget(null);
    launchMediaPlayback(material, mode, startSeconds);
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const cleanUrl = normalizeVideoUrl(videoUrl);
      if (!cleanUrl) {
        throw new Error('Cole o link do vídeo (YouTube, Instagram, TikTok ou outro link).');
      }
      try {
        // Validate URL syntax before saving to Firestore
        new URL(cleanUrl);
      } catch {
        throw new Error('Informe um link válido (ex.: https://www.youtube.com/watch?v=...).');
      }

      const parsed = parseVideoEmbed(cleanUrl, channelName.trim());
      const selectedCat = formCategories.find((c) => c.id === categoryId) || formCategories[0];

      await addMaterial({
        title: title.trim() || `${parsed.platformLabel} · ${selectedCat.title}`,
        disciplineId: selectedCat.disciplineId,
        libraryCategoryId: selectedCat.id,
        editalTopic: editalTopic.trim() || selectedCat.title,
        resourceType: 'video',
        fileType: 'video',
        institution: channelName.trim() || parsed.platformLabel,
        url: cleanUrl,
        pricing: 'gratuito',
        linkStatus: 'ativo',
        isOfficialContent: false,
        description: notes.trim(),
        isShared: canPublishShared ? isShared : false,
      });

      setTitle('');
      setVideoUrl('');
      setEditalTopic('');
      setChannelName('');
      setNotes('');
      setShowAddForm(false);
      if (libraryScope !== 'all') {
        setLibraryScope(formScope);
      }
      setFeedback(
        canPublishShared && isShared
          ? `Vídeo (${parsed.platformLabel}) salvo no banco de dados e visível para todos!`
          : user
            ? `Vídeo (${parsed.platformLabel}) salvo na sua conta no banco de dados!`
            : 'Vídeo salvo localmente neste aparelho. Entre com sua conta Google para salvar na nuvem e compartilhar com todos.'
      );
    } catch (err) {
      let friendly = 'Erro ao salvar vídeo no banco de dados.';
      if (err instanceof Error) {
        if (err.message.startsWith('{')) {
          friendly = 'Não foi possível salvar no Firestore. Verifique sua conexão e permissões da conta.';
        } else {
          friendly = err.message;
        }
      }
      setFeedback(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
            Videoaulas, Reels e Dicas · YouTube, Instagram, TikTok e Demais Links
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Vídeos & Aulas por Link
          </h1>
        </div>

        {canCreateVideo && (
          <button
            type="button"
            aria-expanded={showAddForm}
            onClick={() => setShowAddForm((v) => !v)}
            className="min-h-[42px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Ocultar formulário' : 'Adicionar vídeo'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-950 dark:text-emerald-200">
          {feedback}
        </div>
      )}

      {/* Embedded Active Video Player */}
      {activeVideo && activePlayer && (
        <section
          ref={playerSectionRef}
          className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3 border border-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2.5">
              <div className="mt-0.5 bg-white rounded-lg p-1 shrink-0">
                <PlatformIcon platform={activePlayer.platform} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-300">
                  {activePlayer.platformLabel} · {getDisciplineShortName(activeVideo.disciplineId)}
                </p>
                <h2 className="font-display text-base sm:text-lg font-bold truncate">{activeVideo.title}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={activeVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Abrir no app / link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                aria-label="Fechar vídeo"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activePlayer.platform === 'direct' && activePlayer.embedUrl ? (
            <div className="relative w-full aspect-video max-h-[520px] rounded-xl overflow-hidden bg-black">
              <video
                key={activeVideo.id}
                controls
                playsInline
                autoPlay
                src={activePlayer.embedUrl}
                className="w-full h-full object-contain bg-black"
              />
            </div>
          ) : activePlayer.embedUrl ? (
            <div className="w-full flex justify-center bg-black rounded-xl overflow-hidden">
              {activePlayer.platform === 'tiktok' || activePlayer.platform === 'instagram' ? (
                <iframe
                  key={activeVideo.id}
                  title={activeVideo.title}
                  src={activePlayer.embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full max-w-[400px] h-[min(540px,70vh)] border-0 bg-white"
                />
              ) : (
                <div className="relative w-full aspect-video max-h-[520px]">
                  <iframe
                    key={activeVideo.id}
                    title={activeVideo.title}
                    src={activePlayer.embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-800/80 text-center space-y-3">
              <p className="text-sm text-slate-200">
                Este link ({activePlayer.platformLabel}) abre diretamente no aplicativo ou navegador de origem.
              </p>
              <a
                href={activeVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-5 py-2 bg-[#146C43] hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                <span>Assistir {activeVideo.title}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </section>
      )}

      {/* Quick Add Video Form (restricted to authorized publishers/teachers) */}
      {canCreateVideo && showAddForm && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-[#146C43] dark:text-emerald-400">Adicionar por Link</p>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Incluir Vídeo do YouTube, Instagram, TikTok ou Outro Link
              </h2>
            </div>

            {videoUrl.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <PlatformIcon platform={formUrlPreview.platform} className="w-4 h-4" />
                <span>{formUrlPreview.platformLabel} detectado</span>
              </span>
            )}
          </div>

          <form onSubmit={handleAddVideo} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link do vídeo (YouTube, Instagram, TikTok, Drive, MP4, etc.)
                </label>
                <input
                  type="text"
                  inputMode="url"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... | instagram.com/reel/... | tiktok.com/..."
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título do vídeo / aula (opcional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Dica rápida de Processo Legislativo (ou deixe vazio)"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B3321]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Aba de destino</label>
                <select
                  value={formScope}
                  onChange={(e) => {
                    const next = e.target.value as LibraryScope;
                    setFormScope(next);
                    const nextList =
                      next === 'geral'
                        ? GERAL_LIBRARY_CATEGORIES
                        : next === 'medio'
                          ? MEDIO_LIBRARY_CATEGORIES
                          : LIBRARY_CATEGORIES;
                    setCategoryId(nextList[0].id);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="geral">Geral (Comum aos 2 níveis)</option>
                  <option value="superior">Conteúdo · Nível Superior (Cargo 03)</option>
                  <option value="medio">Conteúdo · Nível Médio (Cargo 04)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Disciplina</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value as LibraryCategoryId)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  {formCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {String(cat.order).padStart(2, '0')} · {cat.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Perfil / Canal (opcional)</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Ex.: @professor / Canal YouTube"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assunto / tópico (opcional)</label>
                <input
                  type="text"
                  value={editalTopic}
                  onChange={(e) => setEditalTopic(e.target.value)}
                  placeholder="Ex.: Poder Legislativo, Crase, Regimento Interno"
                  className="w-full min-h-[40px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Observação (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Assistir antes de fazer questões"
                  className="w-full min-h-[40px] px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Live YouTube preview before saving */}
            {formUrlPreview.youtubeId && formUrlPreview.thumbnailUrl && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                  <img
                    src={formUrlPreview.thumbnailUrl}
                    alt="Prévia do YouTube"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                    <YouTubeBrandIcon className="w-4 h-4" />
                    <span>Prévia pronta: ícone do YouTube + Play</span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    {canPublishShared && isShared
                      ? 'Ao salvar, ficará visível para todos os usuários e visitantes.'
                      : 'Será salvo na sua biblioteca.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {canPublishShared ? (
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                  />
                  <span>Compartilhar vídeo para todos (familiares, turma e visitantes)</span>
                </label>
              ) : user && !user.emailVerified ? (
                <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Confirme seu e-mail ou entre com Google para publicar para todos.</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>Modo visitante salva só neste aparelho.</span>
                  <button
                    type="button"
                    onClick={() => void loginWithGoogle()}
                    className="font-semibold text-[#0B3321] dark:text-emerald-400 underline"
                  >
                    Entrar com Google
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 bg-[#0B3321] hover:bg-[#134b32] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                <span>{submitting ? 'Salvando...' : 'Salvar vídeo'}</span>
              </button>
            </div>
          </form>

          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-950 dark:text-emerald-200">
              {feedback}
            </div>
          )}
        </section>
      )}

      {/* Collapsible Scope, Platform & Discipline Filters */}
      {(() => {
        const levelOptions = [
          { id: 'all' as const, label: `Todos (${scopeCounts.all})` },
          { id: 'geral' as const, label: `Geral (${scopeCounts.geral})` },
          { id: 'superior' as const, label: `Superior (${scopeCounts.superior})` },
          { id: 'medio' as const, label: `Médio (${scopeCounts.medio})` },
        ];
        const platformOptions = [
          { id: 'all' as const, label: 'Todas plataformas' },
          { id: 'youtube' as const, label: 'YouTube' },
          { id: 'instagram' as const, label: 'Instagram' },
          { id: 'tiktok' as const, label: 'TikTok' },
          { id: 'other' as const, label: 'Outros links' },
        ];
        const activeLevelLabel = levelOptions.find((l) => l.id === libraryScope)?.label || `Todos (${scopeCounts.all})`;
        const activePlatformLabel = platformOptions.find((p) => p.id === platformFilter)?.label || 'Todas plataformas';
        const activeGroup = categoryGroups.find((g) => g.key === selectedCategory);
        const activeDisciplineLabel = activeGroup
          ? `${activeGroup.title} (${activeGroup.count})`
          : `Todas (${platformFilteredVideos.length})`;

        return (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Filtrar por nível */}
              <button
                type="button"
                aria-expanded={levelFilterOpen}
                aria-controls="videos-level-filter-panel"
                onClick={() => {
                  setLevelFilterOpen((prev) => !prev);
                  setPlatformFilterOpen(false);
                  setDisciplineFilterOpen(false);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-[#146C43] text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                <span>Filtrar por nível:</span>
                <span className="text-[#0B3321] dark:text-emerald-300 font-bold">{activeLevelLabel}</span>
                {levelFilterOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {/* 2. Plataforma */}
              <button
                type="button"
                aria-expanded={platformFilterOpen}
                aria-controls="videos-platform-filter-panel"
                onClick={() => {
                  setPlatformFilterOpen((prev) => !prev);
                  setLevelFilterOpen(false);
                  setDisciplineFilterOpen(false);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-[#146C43] text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
              >
                {platformFilter === 'youtube' ? (
                  <YouTubeBrandIcon className="w-3.5 h-3.5" />
                ) : (
                  <Filter className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                )}
                <span>Plataforma:</span>
                <span className="text-[#0B3321] dark:text-emerald-300 font-bold">{activePlatformLabel}</span>
                {platformFilterOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {/* 3. Filtrar por disciplina */}
              <button
                type="button"
                aria-expanded={disciplineFilterOpen}
                aria-controls="videos-discipline-filter-panel"
                onClick={() => {
                  setDisciplineFilterOpen((prev) => !prev);
                  setLevelFilterOpen(false);
                  setPlatformFilterOpen(false);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-[#146C43] text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                <span>Filtrar por disciplina:</span>
                <span className="text-[#0B3321] dark:text-emerald-300 font-bold truncate max-w-[180px] sm:max-w-none">
                  {activeDisciplineLabel}
                </span>
                {disciplineFilterOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-auto">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'vídeo' : 'vídeos'}
              </span>
            </div>

            {/* Collapsible Panel: Nível */}
            {levelFilterOpen && (
              <div
                id="videos-level-filter-panel"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-1.5"
              >
                {levelOptions.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setLibraryScope(sc.id);
                      setSelectedCategory('all');
                      setLevelFilterOpen(false);
                    }}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      libraryScope === sc.id
                        ? 'bg-[#0B3321] border-[#0B3321] text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#146C43]'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            )}

            {/* Collapsible Panel: Plataforma */}
            {platformFilterOpen && (
              <div
                id="videos-platform-filter-panel"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-1.5"
              >
                {platformOptions.map((pf) => (
                  <button
                    key={pf.id}
                    type="button"
                    onClick={() => {
                      setPlatformFilter(pf.id);
                      setPlatformFilterOpen(false);
                    }}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                      platformFilter === pf.id
                        ? 'bg-[#0B3321] border-[#0B3321] text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#146C43]'
                    }`}
                  >
                    {pf.id === 'youtube' && <YouTubeBrandIcon className="w-3.5 h-3.5" />}
                    {pf.id === 'instagram' && <PlatformIcon platform="instagram" className="w-3.5 h-3.5" />}
                    {pf.id === 'tiktok' && <PlatformIcon platform="tiktok" className="w-3.5 h-3.5" />}
                    <span>{pf.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Collapsible Panel: Disciplina (deduplicated) */}
            {disciplineFilterOpen && (
              <div
                id="videos-discipline-filter-panel"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setDisciplineFilterOpen(false);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedCategory === 'all'
                      ? 'border-[#0B3321] bg-[#0B3321] text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#146C43]'
                  }`}
                >
                  Todas ({platformFilteredVideos.length})
                </button>
                {categoryGroups.map((group) => {
                  const active = selectedCategory === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(active ? 'all' : group.key);
                        setDisciplineFilterOpen(false);
                      }}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'border-[#0B3321] bg-[#0B3321] text-white font-semibold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#146C43]'
                      }`}
                    >
                      {group.title} ({group.count})
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-400 space-y-2">
          <Film className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <p className="font-medium text-slate-800 dark:text-slate-200">Nenhum vídeo cadastrado nesta seleção ainda.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cole acima qualquer link do YouTube, Instagram (Reels/Post), TikTok, Vimeo, Drive ou aula web.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVideos.map((vid) => {
            const parsed = parseVideoEmbed(vid.url, vid.institution);
            const uid = user?.uid || profile?.uid;
            const canDelete = !vid.isSystemDefault && (isAdmin || vid.ownerId === uid);
            const canOrganize = canPublishShared || (!vid.isSystemDefault && vid.ownerId === uid);
            const isPublicVisible = Boolean(vid.isShared || vid.isSystemDefault);
            const showThumb = Boolean(parsed.thumbnailUrl && !brokenThumbs[vid.id]);
            const mediaProg = mediaProgressMap[vid.id];

            return (
              <article
                key={vid.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                {/* Clickable Visual Preview with Platform Icon + Thumbnail + Play Overlay */}
                <button
                  type="button"
                  onClick={() => handleOpenPlayer(vid)}
                  className="group relative w-full aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-[#0B3321] overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0B3321]"
                  aria-label={`Dar play em ${vid.title}`}
                >
                  {showThumb && parsed.thumbnailUrl ? (
                    <img
                      src={parsed.thumbnailUrl}
                      alt={vid.title}
                      loading="lazy"
                      onError={() => setBrokenThumbs((prev) => ({ ...prev, [vid.id]: true }))}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/80">
                      <PlatformIcon platform={parsed.platform} className="w-10 h-10" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

                  {/* Top-left Platform Badge with Icon */}
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 text-slate-900 text-xs font-bold shadow-sm">
                    <PlatformIcon platform={parsed.platform} className="w-4 h-4" />
                    <span>{parsed.platformLabel}</span>
                  </div>

                  {/* Top-right Visibility Badge */}
                  <div
                    className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold shadow-sm ${
                      isPublicVisible
                        ? 'bg-emerald-950/85 text-emerald-200 border border-emerald-500/40'
                        : 'bg-amber-950/85 text-amber-200 border border-amber-500/40'
                    }`}
                  >
                    {isPublicVisible ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    <span>{isPublicVisible ? 'Para todos' : 'Só você'}</span>
                  </div>

                  {/* Center Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110 ${
                        parsed.platform === 'youtube'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#0B3321] text-white border-2 border-white/80'
                      }`}
                    >
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                  </div>
                </button>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0B3321] dark:text-emerald-400 inline-flex items-center gap-1.5">
                        <PlatformIcon platform={parsed.platform} className="w-3.5 h-3.5" />
                        <span>{vid.institution || parsed.platformLabel}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 truncate">{getDisciplineShortName(vid.disciplineId)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenPlayer(vid)}
                      className="flex items-start gap-2.5 text-left group w-full"
                    >
                      <span className="mt-0.5 w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-300 group-hover:bg-[#0B3321] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0B3321] dark:group-hover:text-emerald-400 transition-colors">
                          {vid.title}
                        </h3>
                        {vid.subtitle && (
                          <p className="text-xs font-medium text-[#146C43] dark:text-emerald-400 mt-0.5">
                            {vid.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                    {mediaProg && mediaProg.progressPercent > 0 && (
                      <p className="text-[11px] font-mono tabular-nums text-[#146C43] dark:text-emerald-400 font-semibold">
                        Progresso salvo: {mediaProg.progressPercent}%
                      </p>
                    )}
                    {vid.editalTopic && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Assunto: </span>
                        {vid.editalTopic}
                      </p>
                    )}
                    {vid.description && <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{vid.description}</p>}
                    {vid.chapters && vid.chapters.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {vid.chapters.slice(0, 4).map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => handleOpenPlayer(vid, ch.startSeconds)}
                            className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 hover:border-[#146C43]"
                          >
                            {ch.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPlayer(vid)}
                        className="min-h-[38px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{mediaProg && mediaProg.currentTimeSeconds > 0 ? 'Continuar' : 'Dar Play'}</span>
                      </button>

                      <a
                        href={vid.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span>Abrir link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {onSummarizeWithGemini && (
                        <button
                          type="button"
                          onClick={() =>
                            onSummarizeWithGemini({
                              mode: 'video',
                              materialId: vid.id,
                              url: vid.url,
                              title: vid.title,
                              disciplineId: vid.disciplineId,
                            })
                          }
                          className="min-h-[38px] px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400" />
                          <span>Resumir no Gemini</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {canOrganize && (
                        <button
                          type="button"
                          onClick={() => setOrganizingVideo(vid)}
                          aria-label="Organizar capítulos e metadados"
                          className="min-h-[38px] px-2.5 flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B3321] dark:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Organizar</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void deleteMaterial(vid.id)}
                          aria-label="Excluir vídeo"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

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

      {organizingVideo && (
        <ContentOrganizerModal
          material={organizingVideo}
          campus={campus}
          onClose={() => setOrganizingVideo(null)}
        />
      )}
    </div>
  );
}
