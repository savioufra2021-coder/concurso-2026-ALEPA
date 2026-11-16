import React, { useEffect, useState } from 'react';
import { Headphones, Video } from 'lucide-react';
import { CampusLevel } from '../types';
import { GeminiTargetPreset } from './GeminiSummaryView';
import { PodcastsView } from './PodcastsView';
import { VideosView } from './VideosView';

interface MediaHubViewProps {
  campus: CampusLevel;
  initialTab?: 'videos' | 'podcasts';
  onSummarizeWithGemini?: (target: GeminiTargetPreset) => void;
}

export function MediaHubView({
  campus,
  initialTab = 'videos',
  onSummarizeWithGemini,
}: MediaHubViewProps) {
  const [activeMediaTab, setActiveMediaTab] = useState<'videos' | 'podcasts'>(initialTab);

  useEffect(() => {
    setActiveMediaTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-5">
      {/* Unified Header for Student Environment Area 3: Vídeos e Podcasts */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#146C43] dark:text-emerald-400">
            Ambiente do Estudante · Área 3
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Vídeos e Podcasts
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Aulas e conteúdos em áudio organizados por disciplina e assunto do edital ALEPA 2026.
          </p>
        </div>

        {/* Dedicated icon+label tabs (no grouped icons) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveMediaTab('videos')}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              activeMediaTab === 'videos'
                ? 'bg-[#0B3321] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
            }`}
          >
            <Video className="w-4 h-4 shrink-0" />
            <span>Videoaulas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMediaTab('podcasts')}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              activeMediaTab === 'podcasts'
                ? 'bg-[#0B3321] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
            }`}
          >
            <Headphones className="w-4 h-4 shrink-0" />
            <span>Podcasts & Áudio</span>
          </button>
        </div>
      </div>

      {activeMediaTab === 'videos' ? (
        <VideosView campus={campus} onSummarizeWithGemini={onSummarizeWithGemini} />
      ) : (
        <PodcastsView campus={campus} />
      )}
    </div>
  );
}
