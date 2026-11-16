import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Monitor,
  Send,
  Share2,
  Smartphone,
  Users,
  X,
} from 'lucide-react';

export function getPublicAppBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://ais-pre-ce7hmnmretsjplv6k3rggc-538369928080.us-west2.run.app';
  }
  return window.location.origin.replace('://ais-dev-', '://ais-pre-');
}

interface ShareAppButtonProps {
  variant?: 'header' | 'card' | 'menu';
}

export function ShareAppButton({ variant = 'header' }: ShareAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'main' | 'family' | null>(null);

  const publicAppUrl = useMemo(() => getPublicAppBaseUrl(), []);
  const familyAppUrl = useMemo(() => `${publicAppUrl}/?acesso=familiar`, [publicAppUrl]);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async (text: string, type: 'main' | 'family') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType((prev) => (prev === type ? null : prev)), 2500);
    } catch {
      setCopiedType(null);
    }
  };

  const handleNativeShare = async (url: string, title: string, text: string) => {
    if (!canNativeShare) return;
    try {
      await navigator.share({ title, text, url });
    } catch {
      // ignore user cancel
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Compartilhar link para acessar pelo PC ou Celular"
        className={
          variant === 'card'
            ? 'min-h-[42px] px-4 py-2 bg-[#146C43] hover:bg-[#0B3321] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap'
            : variant === 'menu'
              ? 'min-h-[44px] w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap'
              : 'min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0'
        }
      >
        <Share2 className="w-4 h-4 text-[#146C43] dark:text-emerald-400 shrink-0" />
        <span className={variant === 'header' ? 'hidden sm:inline' : ''}>Compartilhar</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-app-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B3321] text-emerald-300 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="share-app-title" className="font-display text-lg font-bold text-slate-900">
                    Link para Acessar pelo PC ou Celular
                  </h2>
                  <p className="text-xs text-slate-600">
                    Envie o link abaixo pelo WhatsApp ou copie para abrir em qualquer aparelho
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Link Principal PC e Celular */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B3321]">
                  <Smartphone className="w-4 h-4 text-[#146C43]" />
                  <Monitor className="w-4 h-4 text-[#146C43]" />
                  <span>Link Geral (PC e Celular)</span>
                </div>
                <span className="text-[11px] font-mono text-[#146C43] font-semibold">App completo</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 font-mono text-[11px] text-slate-800 break-all select-all">
                {publicAppUrl}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy(publicAppUrl, 'main')}
                  className="min-h-[38px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  {copiedType === 'main' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'main' ? 'Link copiado!' : 'Copiar link'}</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Acesse a plataforma de estudos Concurso ALEPA 2026 pelo celular ou PC: ${publicAppUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3.5 py-1.5 bg-[#146C43] hover:bg-[#0B3321] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                {canNativeShare && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleNativeShare(
                        publicAppUrl,
                        'Concurso ALEPA 2026',
                        'Acesse a plataforma de estudos Concurso ALEPA 2026 pelo celular ou PC:'
                      )
                    }
                    className="min-h-[38px] px-3.5 py-1.5 bg-white border border-slate-300 hover:border-[#0B3321] text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartilhar</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Link para Familiares */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Users className="w-4 h-4 text-[#146C43]" />
                  <span>Link Direto para Familiares</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">Aba Familiares</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all">
                {familyAppUrl}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy(familyAppUrl, 'family')}
                  className="min-h-[38px] px-3.5 py-1.5 bg-white border border-slate-300 hover:border-[#0B3321] text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  {copiedType === 'family' ? (
                    <Check className="w-3.5 h-3.5 text-[#146C43]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedType === 'family' ? 'Copiado!' : 'Copiar link familiar'}</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Acesse nossa área compartilhada de estudos ALEPA 2026 (PC ou celular): ${familyAppUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3.5 py-1.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar no WhatsApp</span>
                </a>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-slate-800">Dica para instalar no celular:</p>
              <p>
                No <strong>Android (Chrome)</strong> toque em <em>Instalar aplicativo</em>; no{' '}
                <strong>iPhone (Safari)</strong> toque em <em>Compartilhar → Adicionar à Tela de Início</em>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
