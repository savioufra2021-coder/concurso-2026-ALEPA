import React, { useEffect, useState } from 'react';
import { ExternalLink, Headphones, Play, Smartphone, Video, X } from 'lucide-react';
import { MediaPlaybackPreference, StudyMaterial } from '../types';
import { formatSafePublicUrl } from '../utils/mediaUrls';

interface PlaybackChoiceModalProps {
  material: StudyMaterial;
  currentPreference: MediaPlaybackPreference;
  onChooseInternal: (savePreference?: MediaPlaybackPreference) => void;
  onChooseExternal: (savePreference?: MediaPlaybackPreference) => void;
  onClose: () => void;
}

function getExternalAppHint(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'Abrir no app YouTube / navegador';
  if (lower.includes('spotify.com') || lower.startsWith('spotify:')) return 'Abrir no app Spotify / navegador';
  if (lower.includes('podcasts.apple.com')) return 'Abrir no Apple Podcasts / navegador';
  if (lower.includes('instagram.com')) return 'Abrir no Instagram / navegador';
  if (lower.includes('tiktok.com')) return 'Abrir no TikTok / navegador';
  if (lower.includes('drive.google.com')) return 'Abrir no Google Drive / navegador';
  return 'Abrir no navegador ou player do aparelho';
}

export function PlaybackChoiceModal({
  material,
  currentPreference,
  onChooseInternal,
  onChooseExternal,
  onClose,
}: PlaybackChoiceModalProps) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const safeExternalUrl = formatSafePublicUrl(material.url);
  const isAudio = material.resourceType === 'podcast';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="playback-choice-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 p-0 sm:p-4 backdrop-blur-xs"
    >
      <button
        type="button"
        aria-label="Fechar escolha de reprodução"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 pb-safe">
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#0B3321] text-emerald-300 flex items-center justify-center shrink-0">
              {isAudio ? <Headphones className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#146C43] dark:text-emerald-400">
                Onde deseja reproduzir?
              </p>
              <h2
                id="playback-choice-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2"
              >
                {material.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onChooseInternal(rememberChoice ? 'internal' : undefined)}
            className="w-full min-h-[60px] p-4 rounded-2xl bg-[#0B3321] hover:bg-[#146C43] text-white text-left flex items-center justify-between gap-3 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Reproduzir no próprio Concurso -ALEPA 2026</p>
                <p className="text-xs text-emerald-100/85">
                  Player integrado com capítulos, velocidade e retomada do ponto
                </p>
              </div>
            </div>
          </button>

          {safeExternalUrl ? (
            <button
              type="button"
              onClick={() => onChooseExternal(rememberChoice ? 'external' : undefined)}
              className="w-full min-h-[60px] p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-[#146C43] text-slate-900 dark:text-slate-100 text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#146C43] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">Abrir em outro aplicativo</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {getExternalAppHint(material.url)}
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              Este material não possui um link externo HTTP válido compatível com abertura em outro aplicativo. Utilize o player interno acima.
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="w-4 h-4 rounded accent-[#0B3321]"
          />
          <span>
            Salvar esta escolha como minha preferência padrão (pode alterar a qualquer momento nas Configurações)
          </span>
        </label>

        {currentPreference !== 'ask' && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Preferência atual configurada:{' '}
            <strong>
              {currentPreference === 'internal' ? 'Player interno' : 'Aplicativo externo'}
            </strong>
          </p>
        )}
      </div>
    </div>
  );
}
