import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeModePreference } from '../types';

const THEME_OPTIONS: ReadonlyArray<{
  id: ThemeModePreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'light',
    label: 'Modo Claro',
    description: 'Fundo claro padrão',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Modo Escuro',
    description: 'Conforto em ambientes escuros',
    icon: Moon,
  },
  {
    id: 'auto',
    label: 'Automático',
    description: 'Segue o tema do sistema',
    icon: Monitor,
  },
];

export const ThemeSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { preferences, updateStudentPreferences } = useAuth();
  const [open, setOpen] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemPrefersDark(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const currentTheme = preferences.theme || 'light';
  const currentOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];
  const isDarkResolved =
    currentTheme === 'dark' || (currentTheme === 'auto' && systemPrefersDark);

  const handleSelectTheme = (themeId: ThemeModePreference) => {
    setOpen(false);
    if (themeId === currentTheme) return;
    void updateStudentPreferences({ theme: themeId });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Alternar tema da plataforma (atual: ${currentOption.label})`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Tema: ${currentOption.label}`}
        className="relative min-w-[38px] min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center transition-colors"
      >
        {currentTheme === 'auto' ? (
          <Monitor className="w-4 h-4 text-[#146C43] dark:text-emerald-400" />
        ) : isDarkResolved ? (
          <Moon className="w-4 h-4 text-emerald-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Selecionar tema da plataforma"
          className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Tema da plataforma
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Preferência salva automaticamente
            </p>
          </div>
          <div className="p-1.5 space-y-1">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = currentTheme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => handleSelectTheme(option.id)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 transition-colors ${
                    selected
                      ? 'bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-200'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-[#0B3321] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{option.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {option.description}
                    </p>
                  </div>
                  {selected && (
                    <Check className="w-3.5 h-3.5 text-[#146C43] dark:text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
