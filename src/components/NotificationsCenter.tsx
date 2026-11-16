import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCheck,
  Clock,
  Info,
  Megaphone,
  MessageSquare,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NavSection, UserNotification } from '../types';

interface NotificationsCenterProps {
  onNavigate: (tab: NavSection) => void;
}

function formatRelativeOrDate(raw: unknown): string {
  if (!raw) return 'Agora';
  try {
    let dateObj: Date | null = null;
    if (typeof raw === 'string') {
      dateObj = new Date(raw);
    } else if (typeof raw === 'number') {
      dateObj = new Date(raw);
    } else if (typeof (raw as { toDate?: () => Date })?.toDate === 'function') {
      dateObj = (raw as { toDate: () => Date }).toDate();
    }
    if (!dateObj || Number.isNaN(dateObj.getTime())) return 'Recente';
    const diffMin = Math.floor((Date.now() - dateObj.getTime()) / 60_000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h`;
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return 'Recente';
  }
}

function getCategoryIcon(category: UserNotification['category']) {
  switch (category) {
    case 'notice':
      return Megaphone;
    case 'request_update':
      return MessageSquare;
    case 'study_alert':
      return Clock;
    case 'material_update':
      return BookOpen;
    default:
      return Info;
  }
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ onNavigate }) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const visibleItems =
    filterMode === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = async (item: UserNotification) => {
    if (!item.read) {
      await markNotificationRead(item.notificationId || item.id);
    }
    if (item.targetTab) {
      onNavigate(item.targetTab);
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Central de Notificações${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} não lidas)` : ''}`}
        aria-expanded={open}
        title="Notificações e Avisos"
        className="relative min-w-[38px] min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Central de Notificações"
          className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-full sm:mt-2 sm:w-96 max-h-[78vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-900">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Central de Notificações
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {unreadNotificationCount > 0
                  ? `${unreadNotificationCount} não lida(s)`
                  : 'Tudo em dia'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="px-2.5 py-1 rounded-lg bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#0B3321] dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1 hover:opacity-90"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Ler todas
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar notificações"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterMode === 'all'
                  ? 'bg-[#0B3321] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterMode === 'unread'
                  ? 'bg-[#0B3321] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Não lidas ({unreadNotificationCount})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {visibleItems.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-1.5">
                <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {filterMode === 'unread'
                    ? 'Nenhuma notificação não lida.'
                    : 'Nenhuma notificação registrada.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Avisos do edital, respostas a chamados e lembretes aparecem aqui.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleNotificationClick(item)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 ${
                      !item.read ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        item.priority === 'urgente'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300'
                          : item.priority === 'importante'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-[#E8F3EC] text-[#0B3321] dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeOrDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        {!item.read && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
                        )}
                        <span className="text-[10px] font-semibold text-[#146C43] dark:text-emerald-400">
                          {item.read ? 'Lida' : 'Nova · clique para abrir'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
