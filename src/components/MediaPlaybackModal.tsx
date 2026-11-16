import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  ExternalLink,
  Forward,
  Hand,
  Headphones,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StudyMaterial } from '../types';
import { formatDurationSeconds, formatSafePublicUrl } from '../utils/mediaUrls';
import { FullscreenZoomToolbar, useFullscreenZoom } from './ui/CampusPrimitives';

interface MediaPlaybackModalProps {
  material: StudyMaterial;
  initialMode?: 'internal' | 'external';
  initialStartSeconds?: number;
  onClose: () => void;
}

type DetectedMediaKind = 'direct_video' | 'direct_audio' | 'youtube' | 'vimeo' | 'spotify' | 'apple' | 'drive' | 'external';

function inspectMediaUrl(rawUrl: string, resourceType: StudyMaterial['resourceType']): {
  kind: DetectedMediaKind;
  embedBaseUrl: string | null;
  platformLabel: string;
} {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();

  if (/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(url) && resourceType !== 'podcast') {
    return { kind: 'direct_video', embedBaseUrl: url, platformLabel: 'Player de Vídeo Interno' };
  }
  if (/\.(mp3|m4a|ogg|wav|aac)(\?.*)?$/i.test(url)) {
    return { kind: 'direct_audio', embedBaseUrl: url, platformLabel: 'Player de Áudio Interno' };
  }

  const ytWatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytPath = url.match(/youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
  const ytId = ytWatch?.[1] || ytShort?.[1] || ytPath?.[1] || null;
  if (ytId) {
    return {
      kind: 'youtube',
      embedBaseUrl: `https://www.youtube.com/embed/${ytId}`,
      platformLabel: 'YouTube Integrado',
    };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return {
      kind: 'vimeo',
      embedBaseUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      platformLabel: 'Vimeo Integrado',
    };
  }

  const spotifyMatch = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|track|playlist|album)\/([a-zA-Z0-9]+)/i
  );
  if (spotifyMatch) {
    return {
      kind: 'spotify',
      embedBaseUrl: `https://open.spotify.com/embed/${spotifyMatch[1].toLowerCase()}/${spotifyMatch[2]}?utm_source=generator`,
      platformLabel: 'Spotify Integrado',
    };
  }

  if (/podcasts\.apple\.com\//i.test(url)) {
    return {
      kind: 'apple',
      embedBaseUrl: url.replace(/^https:\/\/podcasts\.apple\.com/i, 'https://embed.podcasts.apple.com'),
      platformLabel: 'Apple Podcasts',
    };
  }

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveMatch) {
    return {
      kind: 'drive',
      embedBaseUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      platformLabel: 'Google Drive Integrado',
    };
  }

  return { kind: 'external', embedBaseUrl: null, platformLabel: 'Link Externo' };
}

export function MediaPlaybackModal({
  material,
  initialMode = 'internal',
  initialStartSeconds,
  onClose,
}: MediaPlaybackModalProps) {
  const { mediaProgressMap, saveMediaProgress } = useAuth();
  const savedRecord = mediaProgressMap[material.id];

  const [mode, setMode] = useState<'internal' | 'external'>(initialMode);
  const [startOffset, setStartOffset] = useState<number>(() =>
    typeof initialStartSeconds === 'number'
      ? Math.max(0, initialStartSeconds)
      : savedRecord?.currentTimeSeconds || 0
  );

  // Direct HTML5 media states & unified fullscreen zoom stage
  const mediaStageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedAtRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(startOffset);
  const [duration, setDuration] = useState<number>(savedRecord?.durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [externalLaunched, setExternalLaunched] = useState(false);
  const [iframePanMode, setIframePanMode] = useState(false);

  const zoom = useFullscreenZoom({
    targetRef: mediaStageRef,
    minScale: 1,
    maxScale: 4,
    step: 0.25,
    onExitFullscreen: () => setIframePanMode(false),
  });

  const mediaInfo = useMemo(
    () => inspectMediaUrl(material.url, material.resourceType),
    [material.url, material.resourceType]
  );
  const safePublicUrl = useMemo(() => formatSafePublicUrl(material.url), [material.url]);

  const chapters = material.chapters || [];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoom.isFullscreen) {
          void zoom.exitFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, zoom.isFullscreen, zoom.exitFullscreen]);

  useEffect(() => {
    if (
      typeof document !== 'undefined' &&
      'pictureInPictureEnabled' in document &&
      Boolean(document.pictureInPictureEnabled)
    ) {
      setPipSupported(true);
    }
  }, []);

  // Sleep timer countdown for audio/podcast playback
  useEffect(() => {
    if (sleepMinutes <= 0) {
      setSleepRemainingSec(0);
      return;
    }
    setSleepRemainingSec(sleepMinutes * 60);
    const interval = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev <= 1) {
          audioRef.current?.pause();
          videoRef.current?.pause();
          setIsPlaying(false);
          setSleepMinutes(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sleepMinutes]);

  // Media Session API for lock-screen / headphone / notification playback controls
  useEffect(() => {
    if (mediaInfo.kind !== 'direct_audio' && mediaInfo.kind !== 'direct_video') return;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const ms = navigator.mediaSession;
      if (typeof MediaMetadata !== 'undefined') {
        ms.metadata = new MediaMetadata({
          title: material.title,
          artist: material.subtitle || material.institution || 'Concurso -ALEPA 2026',
          album: material.editalTopic || 'ALEPA 2026',
        });
      }
      const activeEl = mediaInfo.kind === 'direct_audio' ? audioRef.current : videoRef.current;
      ms.setActionHandler('play', () => {
        void activeEl?.play();
      });
      ms.setActionHandler('pause', () => {
        activeEl?.pause();
      });
      ms.setActionHandler('seekbackward', () => {
        if (activeEl) activeEl.currentTime = Math.max(0, activeEl.currentTime - 15);
      });
      ms.setActionHandler('seekforward', () => {
        if (activeEl) activeEl.currentTime = Math.min(activeEl.duration || Infinity, activeEl.currentTime + 15);
      });
      return () => {
        try {
          ms.setActionHandler('play', null);
          ms.setActionHandler('pause', null);
          ms.setActionHandler('seekbackward', null);
          ms.setActionHandler('seekforward', null);
        } catch {
          // ignore browser cleanup differences
        }
      };
    } catch {
      return undefined;
    }
  }, [mediaInfo.kind, material.title, material.subtitle, material.institution, material.editalTopic]);

  const persistPlaybackPosition = (pos: number, dur: number, completed = false) => {
    const now = Date.now();
    if (!completed && now - lastSavedAtRef.current < 4000) return;
    lastSavedAtRef.current = now;
    void saveMediaProgress(material.id, {
      materialTitle: material.title,
      mediaType: material.resourceType === 'podcast' ? 'audio' : 'video',
      currentTimeSeconds: Math.max(0, Math.round(pos)),
      durationSeconds: Math.max(0, Math.round(dur)),
      progressPercent: completed ? 100 : undefined,
      playbackRate,
      preferredMode: mode,
    });
  };

  const getActiveHtmlEl = (): HTMLMediaElement | null =>
    mediaInfo.kind === 'direct_audio' ? audioRef.current : videoRef.current;

  const handleLoadedMetadata = () => {
    const el = getActiveHtmlEl();
    if (!el) return;
    setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    if (startOffset > 0 && startOffset < (el.duration || Infinity)) {
      el.currentTime = startOffset;
    }
    el.playbackRate = playbackRate;
    el.muted = muted;
    el.volume = volume;
  };

  const handleTimeUpdate = () => {
    const el = getActiveHtmlEl();
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
      const isEndedOrNearEnd = el.currentTime >= el.duration - 2;
      persistPlaybackPosition(el.currentTime, el.duration, isEndedOrNearEnd);
    }
  };

  const handleTogglePlay = () => {
    const el = getActiveHtmlEl();
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  };

  const handleSeekTo = (targetSec: number) => {
    const clamped = Math.max(0, targetSec);
    setStartOffset(clamped);
    setCurrentTime(clamped);
    const el = getActiveHtmlEl();
    if (el) {
      el.currentTime = clamped;
      void el.play();
    }
  };

  const handleSkipBy = (deltaSec: number) => {
    const el = getActiveHtmlEl();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + deltaSec));
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    const el = getActiveHtmlEl();
    if (el) el.playbackRate = rate;
  };

  const handlePictureInPicture = async () => {
    setPipError(null);
    const v = videoRef.current;
    if (!v || typeof v.requestPictureInPicture !== 'function') {
      setPipError('Picture-in-Picture não suportado neste navegador ou aparelho.');
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      setPipError('O navegador bloqueou ou não suporta Picture-in-Picture para este vídeo.');
    }
  };

  const handleFullscreen = async () => {
    await zoom.toggleFullscreen();
  };

  const handleRecordExternalOpen = () => {
    setExternalLaunched(true);
    void saveMediaProgress(material.id, {
      materialTitle: material.title,
      mediaType: material.resourceType === 'podcast' ? 'audio' : 'video',
      preferredMode: 'external',
      openedExternallyAt: new Date().toISOString(),
    });
  };

  const iframeSrc = useMemo(() => {
    if (!mediaInfo.embedBaseUrl) return null;
    if (mediaInfo.kind === 'youtube') {
      const startParam = startOffset > 0 ? `&start=${Math.floor(startOffset)}` : '';
      return `${mediaInfo.embedBaseUrl}?rel=0&playsinline=1${startParam}`;
    }
    if (mediaInfo.kind === 'vimeo') {
      return startOffset > 0 ? `${mediaInfo.embedBaseUrl}#t=${Math.floor(startOffset)}s` : mediaInfo.embedBaseUrl;
    }
    return mediaInfo.embedBaseUrl;
  }, [mediaInfo.embedBaseUrl, mediaInfo.kind, startOffset]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-player-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#0B1712] text-white border border-emerald-900/60 shadow-2xl">
        {/* Top Modal Header */}
        <div className="sticky top-0 z-10 bg-[#0B3321] border-b border-emerald-800/60 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-300">
              <span className="inline-flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5" />
                {mediaInfo.platformLabel}
              </span>
              {material.editalTopic && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[240px]">{material.editalTopic}</span>
                </>
              )}
              {savedRecord && savedRecord.currentTimeSeconds > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono">
                    Último ponto: {formatDurationSeconds(savedRecord.currentTimeSeconds)}
                  </span>
                </>
              )}
            </div>
            <h2
              id="media-player-title"
              className="font-display text-base sm:text-lg font-bold text-white truncate mt-0.5"
            >
              {material.title}
            </h2>
            {material.subtitle && (
              <p className="text-xs text-emerald-100/80 truncate">{material.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'internal' ? 'external' : 'internal')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white whitespace-nowrap"
            >
              {mode === 'internal' ? 'Trocar para externo' : 'Voltar ao player interno'}
            </button>
            <button
              type="button"
              onClick={() => {
                const el = getActiveHtmlEl();
                if (el && Number.isFinite(el.duration) && el.duration > 0) {
                  void saveMediaProgress(material.id, {
                    materialTitle: material.title,
                    mediaType: material.resourceType === 'podcast' ? 'audio' : 'video',
                    currentTimeSeconds: Math.round(el.currentTime),
                    durationSeconds: Math.round(el.duration),
                    playbackRate,
                    preferredMode: mode,
                  });
                }
                onClose();
              }}
              aria-label="Fechar reprodutor"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {mode === 'external' || (!iframeSrc && mediaInfo.kind === 'external') ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-white">Abertura em Aplicativo Externo / Navegador</p>
                <p className="text-xs text-emerald-100/80 leading-relaxed">
                  Ao abrir em outro aplicativo, o tempo exato assistido fora da plataforma não é inventado. Registramos apenas o acesso externo confiável e preservamos o seu último ponto salvo no player interno.
                </p>
              </div>

              {safePublicUrl ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={safePublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleRecordExternalOpen}
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B3321] text-sm font-bold inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir conteúdo no aplicativo / navegador</span>
                  </a>
                  {iframeSrc && (
                    <button
                      type="button"
                      onClick={() => setMode('internal')}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                    >
                      Reproduzir aqui mesmo
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-300">
                  Link externo inválido ou indisponível para este conteúdo.
                </p>
              )}

              {externalLaunched && (
                <p className="text-xs text-emerald-300 font-medium">
                  Acesso externo registrado no seu histórico sem alterar seu progresso interno anterior.
                </p>
              )}
            </div>
          ) : mediaInfo.kind === 'direct_video' && mediaInfo.embedBaseUrl ? (
            <div className="space-y-3">
              <div
                ref={mediaStageRef}
                {...zoom.touchHandlers}
                className={
                  zoom.isFullscreen
                    ? 'fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center overflow-hidden media-zoom-stage pinch-zoom-surface'
                    : 'relative rounded-xl overflow-hidden bg-black border border-white/10 media-zoom-stage pinch-zoom-surface'
                }
              >
                <div
                  style={zoom.transformStyle}
                  className={`zoom-transform-stage w-full flex items-center justify-center ${
                    zoom.isFullscreen ? 'h-full' : ''
                  } ${zoom.scale > 1.02 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <video
                    ref={videoRef}
                    src={mediaInfo.embedBaseUrl}
                    playsInline
                    controls
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => persistPlaybackPosition(duration, duration, true)}
                    className={zoom.isFullscreen ? 'w-full h-full max-h-screen object-contain' : 'w-full aspect-video max-h-[60vh]'}
                  >
                    <track kind="captions" label="Português" srcLang="pt" />
                  </video>
                </div>

                {(zoom.isFullscreen || zoom.scale > 1.02) && (
                  <div className="fixed sm:absolute bottom-4 right-4 left-4 z-30 pointer-events-none flex justify-end pb-safe">
                    <div className="pointer-events-auto">
                      <FullscreenZoomToolbar
                        scale={zoom.scale}
                        minScale={1}
                        maxScale={4}
                        isFullscreen={zoom.isFullscreen}
                        onZoomOut={zoom.zoomOut}
                        onZoomIn={zoom.zoomIn}
                        onResetZoom={zoom.resetZoom}
                        onToggleFullscreen={() => void zoom.toggleFullscreen()}
                        showZoomControls
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom mobile-friendly playback controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-emerald-500 text-[#0B3321] font-bold inline-flex items-center gap-1.5"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkipBy(-10)}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>-10s</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkipBy(10)}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold inline-flex items-center gap-1"
                  >
                    <span>+10s</span>
                    <Forward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateChange(rate)}
                      className={`min-h-[40px] px-2.5 rounded-lg font-mono text-[11px] font-bold ${
                        playbackRate === rate ? 'bg-emerald-500 text-[#0B3321]' : 'bg-white/10 text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                  {pipSupported && (
                    <button
                      type="button"
                      onClick={() => void handlePictureInPicture()}
                      title="Picture-in-Picture"
                      className="min-h-[44px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 inline-flex items-center gap-1"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                      <span className="hidden sm:inline">PiP</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleFullscreen()}
                    title={zoom.isFullscreen ? 'Sair da tela cheia' : 'Tela cheia com zoom'}
                    aria-label={zoom.isFullscreen ? 'Sair da tela cheia' : 'Tela cheia com zoom'}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 inline-flex items-center justify-center gap-1.5 font-semibold"
                  >
                    {zoom.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span className="hidden sm:inline">{zoom.isFullscreen ? 'Restaurar' : 'Tela cheia'}</span>
                  </button>
                </div>
              </div>
              {pipError && <p className="text-xs text-amber-300">{pipError}</p>}
            </div>
          ) : mediaInfo.kind === 'direct_audio' && mediaInfo.embedBaseUrl ? (
            <div className="rounded-2xl bg-[#0B3321]/90 border border-emerald-700/60 p-4 sm:p-5 space-y-4">
              <audio
                ref={audioRef}
                src={mediaInfo.embedBaseUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => persistPlaybackPosition(duration, duration, true)}
                className="hidden"
              />

              {/* Progress scrubber */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  aria-label="Progresso do áudio"
                  min={0}
                  max={duration > 0 ? duration : 100}
                  value={Math.min(currentTime, duration > 0 ? duration : 100)}
                  onChange={(e) => handleSeekTo(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-emerald-200">
                  <span>{formatDurationSeconds(currentTime)}</span>
                  <span>{duration > 0 ? formatDurationSeconds(duration) : '--:--'}</span>
                </div>
              </div>

              {/* Transport + Speed + Volume */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSkipBy(-15)}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>15s</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="min-h-[48px] px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0B3321] text-sm font-bold inline-flex items-center gap-2"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Pausar' : 'Ouvir'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkipBy(15)}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <span>15s</span>
                    <Forward className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateChange(rate)}
                      className={`min-h-[38px] px-2.5 rounded-lg font-mono text-xs font-bold ${
                        playbackRate === rate ? 'bg-emerald-400 text-[#0B3321]' : 'bg-white/10 text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !muted;
                      setMuted(next);
                      if (audioRef.current) audioRef.current.muted = next;
                    }}
                    aria-label={muted ? 'Ativar som' : 'Silenciar'}
                    className="min-h-[38px] min-w-[38px] rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    aria-label="Volume"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      if (audioRef.current) audioRef.current.volume = v;
                    }}
                    className="w-16 accent-emerald-400"
                  />
                </div>
              </div>

              {/* Sleep timer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-200">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Temporizador de desligamento:{' '}
                    {sleepRemainingSec > 0 ? (
                      <strong className="font-mono text-white">{formatDurationSeconds(sleepRemainingSec)}</strong>
                    ) : (
                      'Desativado'
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSleepMinutes(m)}
                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold ${
                        sleepMinutes === m ? 'bg-emerald-400 text-[#0B3321]' : 'bg-white/10 text-white'
                      }`}
                    >
                      {m === 0 ? 'Desligar' : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : iframeSrc ? (
            <div className="space-y-3">
              <div
                ref={mediaStageRef}
                {...zoom.touchHandlers}
                className={
                  zoom.isFullscreen
                    ? 'fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center overflow-hidden media-zoom-stage pinch-zoom-surface'
                    : `relative rounded-xl overflow-hidden bg-black border border-white/10 media-zoom-stage pinch-zoom-surface ${
                        mediaInfo.kind === 'spotify' || mediaInfo.kind === 'apple' ? 'h-[260px]' : 'aspect-video'
                      }`
                }
              >
                <div
                  style={zoom.transformStyle}
                  className={`zoom-transform-stage w-full h-full flex items-center justify-center ${
                    zoom.isFullscreen ? 'max-h-screen' : ''
                  }`}
                >
                  <iframe
                    title={material.title}
                    src={iframeSrc}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    className={`w-full h-full ${
                      zoom.isFullscreen && mediaInfo.kind !== 'spotify' && mediaInfo.kind !== 'apple'
                        ? 'max-h-[92vh] aspect-video'
                        : ''
                    }`}
                  />
                </div>

                {/* Transparent touch-gesture shield for pinch & pan over cross-origin video iframes */}
                {iframePanMode && (
                  <div
                    {...zoom.touchHandlers}
                    aria-label="Modo de pinça e arrasto ativo sobre o vídeo"
                    className="absolute inset-0 z-20 pinch-zoom-surface bg-black/5 cursor-grab active:cursor-grabbing"
                  />
                )}

                {(zoom.isFullscreen || zoom.scale > 1.02) && (
                  <div className="fixed sm:absolute bottom-4 right-4 left-4 z-30 pointer-events-none flex justify-end pb-safe">
                    <div className="pointer-events-auto">
                      <FullscreenZoomToolbar
                        scale={zoom.scale}
                        minScale={1}
                        maxScale={4}
                        isFullscreen={zoom.isFullscreen}
                        onZoomOut={zoom.zoomOut}
                        onZoomIn={zoom.zoomIn}
                        onResetZoom={zoom.resetZoom}
                        onToggleFullscreen={() => void zoom.toggleFullscreen()}
                        showZoomControls
                        extraSlot={
                          <button
                            type="button"
                            onClick={() => setIframePanMode((v) => !v)}
                            title={
                              iframePanMode
                                ? 'Desativar bloqueio de gestos para clicar no player'
                                : 'Ativar modo pinça e arrasto com os dedos'
                            }
                            aria-pressed={iframePanMode}
                            className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold shadow-2xl border backdrop-blur-md inline-flex items-center gap-1.5 transition-colors ${
                              iframePanMode
                                ? 'bg-emerald-500 text-[#0B3321] border-emerald-200'
                                : 'bg-[#0B3321]/85 text-white border-white/20 hover:bg-[#146C43]'
                            }`}
                          >
                            <Hand className="w-4 h-4" />
                            <span>{iframePanMode ? 'Pinça Ativa' : 'Pinça / Mover'}</span>
                          </button>
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-100/80">
                <span className="flex-1 min-w-[200px]">
                  Reprodução incorporada ({mediaInfo.platformLabel}). Clique em qualquer capítulo abaixo para iniciar no tempo exato quando suportado.
                </span>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void zoom.toggleFullscreen()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    {zoom.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span>{zoom.isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia com Zoom'}</span>
                  </button>
                  {safePublicUrl && (
                    <a
                      href={safePublicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleRecordExternalOpen}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 inline-flex items-center gap-1 text-emerald-300 hover:underline font-semibold"
                    >
                      <span>Abrir externo</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Chapters / Time markers */}
          {chapters.length > 0 && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <ListOrdered className="w-4 h-4" />
                <span>Capítulos e Marcações de Tempo ({chapters.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {chapters.map((ch, idx) => {
                  const sec = ch.startSeconds ?? 0;
                  const canJump = typeof ch.startSeconds === 'number';
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      disabled={!canJump}
                      onClick={() => canJump && handleSeekTo(sec)}
                      className="text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-60 border border-white/10 transition-colors space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-emerald-300">
                        <span>Cap. {String(idx + 1).padStart(2, '0')}</span>
                        <span>{canJump ? formatDurationSeconds(sec) : 'Sem timestamp'}</span>
                      </div>
                      <p className="text-xs font-bold text-white truncate">{ch.title}</p>
                      {(ch.summary || ch.description) && (
                        <p className="text-[11px] text-emerald-100/75 line-clamp-2">{ch.summary || ch.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description & Recommendations */}
          {(material.description || (material.studyRecommendations && material.studyRecommendations.length > 0)) && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2.5 text-xs">
              {material.description && (
                <p className="text-emerald-100/90 leading-relaxed">{material.description}</p>
              )}
              {material.studyRecommendations && material.studyRecommendations.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-1">
                  <p className="font-bold text-emerald-300 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Recomendações de Estudo</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-emerald-100/85">
                    {material.studyRecommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
