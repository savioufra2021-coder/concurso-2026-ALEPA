import React, { useState } from 'react';
import { Download, MoreVertical, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'auth' | 'menu';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  const buttonLabel = isInstallable
    ? 'Instalar App'
    : isIOS
      ? 'Instalar no iPhone'
      : isAndroid
        ? 'Instalar no Android'
        : 'Instalar no Celular';

  const buttonClass =
    variant === 'auth'
      ? 'w-full min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2'
      : variant === 'menu'
        ? 'min-h-[44px] w-full px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-[#0B3321] dark:text-emerald-200 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors'
        : 'min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#0B3321] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors';

  return (
    <>
      <button type="button" onClick={handleClick} className={buttonClass} title="Instalar aplicativo na tela inicial">
        {isInstallable ? <Download className="w-4 h-4 shrink-0 text-[#146C43]" /> : <Smartphone className="w-4 h-4 shrink-0 text-[#146C43]" />}
        {variant === 'header' ? (
          <>
            <span className="sm:hidden">Instalar</span>
            <span className="hidden sm:inline">{buttonLabel}</span>
          </>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#0B3321] text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="pwa-guide-title" className="font-display text-lg font-bold text-slate-900">
                    Instalar no Celular (App)
                  </h3>
                  <p className="text-xs text-slate-500">Funciona como aplicativo nativo na tela inicial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Fechar"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="font-semibold text-slate-900">No iPhone / iPad (Safari):</p>
                <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed">
                  <li>
                    Abra este endereço diretamente no navegador <strong>Safari</strong>.
                  </li>
                  <li className="flex items-center gap-1.5 flex-wrap">
                    <span>Toque no botão</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold">
                      <Share className="w-3.5 h-3.5" /> Compartilhar
                    </span>
                    <span>na barra inferior.</span>
                  </li>
                  <li>
                    Role para baixo e toque em <strong>Adicionar à Tela de Início</strong> → <strong>Adicionar</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-700 bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-[#0B3321]">No Android (Google Chrome):</p>
                <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed">
                  <li>
                    Abra o link diretamente no <strong>Google Chrome</strong> (se abriu pelo WhatsApp, toque em{' '}
                    <strong>Abrir no Chrome</strong>).
                  </li>
                  <li>
                    Toque no menu{' '}
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 font-semibold">
                      <MoreVertical className="w-3.5 h-3.5" /> 3 pontinhos
                    </span>{' '}
                    no canto superior direito do Chrome.
                  </li>
                  <li>
                    Toque em <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial</strong> →{' '}
                    <strong>Instalar</strong>).
                  </li>
                  <li>
                    O ícone <strong>ALEPA 2026</strong> aparecerá junto aos outros apps do seu Android e abrirá em tela
                    cheia, mesmo offline.
                  </li>
                </ol>
              </div>
            )}

            {isInstallable && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await install();
                  if (ok) setShowGuide(false);
                }}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#0B3321] hover:bg-[#134b32] text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Agora</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 py-2 text-xs font-semibold text-slate-800 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Modo Offline — Dados em cache ativos</span>
    </div>
  );
};
