import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold text-[var(--brand-primary)] dark:text-emerald-400 tracking-tight">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'brand' | 'success' | 'warning';
}) {
  const valClass =
    accent === 'brand'
      ? 'text-[#0B3321] dark:text-emerald-300'
      : accent === 'success'
        ? 'text-[#16A34A] dark:text-emerald-400'
        : accent === 'warning'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="campus-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1 ${valClass}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  rightSlot,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`campus-card bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {(title || rightSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            {title && (
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
      <div className="w-11 h-11 rounded-2xl bg-[#E8F3EC] dark:bg-emerald-950/60 text-[#146C43] dark:text-emerald-300 flex items-center justify-center mx-auto">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
}

export interface ZoomOffset {
  x: number;
  y: number;
}

export interface UseFullscreenZoomOptions {
  targetRef: React.RefObject<HTMLElement | null>;
  gestureTargetRef?: React.RefObject<HTMLElement | null>;
  minScale?: number;
  maxScale?: number;
  step?: number;
  enableKeyboardShortcuts?: boolean;
  enableWheelZoom?: boolean;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

export interface FullscreenZoomState {
  scale: number;
  translate: ZoomOffset;
  isFullscreen: boolean;
  isNativeFullscreen: boolean;
  isGesturing: boolean;
  transformStyle: React.CSSProperties;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoomScale: (nextScale: number) => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  wasPinchGesture: () => boolean;
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchMove: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchCancel: () => void;
  };
}

function getTouchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function isInteractiveInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
    return true;
  }
  return false;
}

export function useFullscreenZoom({
  targetRef,
  gestureTargetRef,
  minScale = 1,
  maxScale = 4,
  step = 0.25,
  enableKeyboardShortcuts = true,
  enableWheelZoom = true,
  onEnterFullscreen,
  onExitFullscreen,
}: UseFullscreenZoomOptions): FullscreenZoomState {
  const [scale, setScaleState] = useState<number>(minScale);
  const [translate, setTranslateState] = useState<ZoomOffset>({ x: 0, y: 0 });
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isSoftwareFullscreen, setIsSoftwareFullscreen] = useState(false);
  const [isGesturing, setIsGesturing] = useState(false);

  const scaleRef = useRef<number>(minScale);
  const translateRef = useRef<ZoomOffset>({ x: 0, y: 0 });
  const pinchStartRef = useRef<{
    distance: number;
    scale: number;
    centerX: number;
    centerY: number;
    translate: ZoomOffset;
  } | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    translate: ZoomOffset;
  } | null>(null);
  const didPinchRef = useRef<boolean>(false);
  const lastPanEndTimeRef = useRef<number>(0);

  const isFullscreen = isNativeFullscreen || isSoftwareFullscreen;
  const isFullscreenRef = useRef(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  const clampScale = useCallback(
    (value: number) => Math.max(minScale, Math.min(maxScale, Number(value.toFixed(3)))),
    [minScale, maxScale]
  );

  const clampTranslate = useCallback(
    (offset: ZoomOffset, targetScale: number): ZoomOffset => {
      if (targetScale <= minScale + 0.01) {
        return { x: 0, y: 0 };
      }
      const host = gestureTargetRef?.current || targetRef.current;
      const cw = host?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 390);
      const ch = host?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);
      const maxX = Math.max(60, (cw * (targetScale - 1)) / 2 + 80);
      const maxY = Math.max(60, (ch * (targetScale - 1)) / 2 + 120);
      return {
        x: Math.max(-maxX, Math.min(maxX, offset.x)),
        y: Math.max(-maxY, Math.min(maxY, offset.y)),
      };
    },
    [gestureTargetRef, targetRef, minScale]
  );

  const applyScaleAndTranslate = useCallback(
    (nextScaleRaw: number, nextTranslateRaw?: ZoomOffset) => {
      const nextScale = clampScale(nextScaleRaw);
      const nextTranslate = clampTranslate(nextTranslateRaw ?? translateRef.current, nextScale);
      scaleRef.current = nextScale;
      translateRef.current = nextTranslate;
      setScaleState(nextScale);
      setTranslateState(nextTranslate);
    },
    [clampScale, clampTranslate]
  );

  const zoomIn = useCallback(() => {
    applyScaleAndTranslate(scaleRef.current + step);
  }, [applyScaleAndTranslate, step]);

  const zoomOut = useCallback(() => {
    applyScaleAndTranslate(scaleRef.current - step);
  }, [applyScaleAndTranslate, step]);

  const resetZoom = useCallback(() => {
    applyScaleAndTranslate(minScale, { x: 0, y: 0 });
  }, [applyScaleAndTranslate, minScale]);

  const setZoomScale = useCallback(
    (nextScale: number) => {
      applyScaleAndTranslate(nextScale);
    },
    [applyScaleAndTranslate]
  );

  // Sync native browser Fullscreen API state (with Safari webkit fallback)
  useEffect(() => {
    const syncFullscreen = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
        null;
      const active = Boolean(fsEl);
      setIsNativeFullscreen(active);
      if (active) {
        onEnterFullscreen?.();
      } else {
        onExitFullscreen?.();
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen as EventListener);
    };
  }, [onEnterFullscreen, onExitFullscreen]);

  const enterFullscreen = useCallback(async () => {
    const el = targetRef.current as
      | (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    try {
      if (el?.requestFullscreen) {
        await el.requestFullscreen();
        setIsSoftwareFullscreen(false);
        return;
      }
      if (el?.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        setIsSoftwareFullscreen(false);
        return;
      }
    } catch {
      // Fallback gracefully inside iFrame / iOS Safari where native Fullscreen is restricted
    }
    setIsSoftwareFullscreen(true);
    onEnterFullscreen?.();
  }, [targetRef, onEnterFullscreen]);

  const exitFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // ignore exit failure
    }
    setIsSoftwareFullscreen(false);
    resetZoom();
    onExitFullscreen?.();
  }, [resetZoom, onExitFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreenRef.current) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  // Non-passive wheel & touchmove prevention so Ctrl+Wheel & 2-finger pinch control modal stage smoothly
  useEffect(() => {
    const host = gestureTargetRef?.current || targetRef.current;
    if (!host) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.16 : -0.16;
      applyScaleAndTranslate(scaleRef.current + delta);
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1 && scaleRef.current > minScale + 0.02 && !isInteractiveInputTarget(e.target)) {
        e.preventDefault();
      }
    };

    if (enableWheelZoom) {
      host.addEventListener('wheel', handleNativeWheel, { passive: false });
    }
    host.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    return () => {
      if (enableWheelZoom) {
        host.removeEventListener('wheel', handleNativeWheel);
      }
      host.removeEventListener('touchmove', handleNativeTouchMove);
    };
  }, [gestureTargetRef, targetRef, applyScaleAndTranslate, minScale, enableWheelZoom]);

  // Desktop keyboard shortcuts (+, -, 0)
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveInputTarget(e.target) || isInteractiveInputTarget(document.activeElement)) {
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' && (scaleRef.current > minScale + 0.01 || isFullscreenRef.current || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, zoomIn, zoomOut, resetZoom, minScale]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length === 2) {
        didPinchRef.current = true;
        panStartRef.current = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = getTouchDistance(t1, t2);
        pinchStartRef.current = {
          distance: Math.max(10, dist),
          scale: scaleRef.current,
          centerX: (t1.clientX + t2.clientX) / 2,
          centerY: (t1.clientY + t2.clientY) / 2,
          translate: translateRef.current,
        };
        setIsGesturing(true);
      } else if (e.touches.length === 1 && scaleRef.current > minScale + 0.02) {
        const t = e.touches[0];
        panStartRef.current = {
          x: t.clientX,
          y: t.clientY,
          translate: translateRef.current,
        };
        setIsGesturing(true);
      }
    },
    [minScale]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.max(10, getTouchDistance(t1, t2));
        const currentCenterX = (t1.clientX + t2.clientX) / 2;
        const currentCenterY = (t1.clientY + t2.clientY) / 2;

        if (!pinchStartRef.current) {
          didPinchRef.current = true;
          pinchStartRef.current = {
            distance: currentDist,
            scale: scaleRef.current,
            centerX: currentCenterX,
            centerY: currentCenterY,
            translate: translateRef.current,
          };
          return;
        }

        const ratio = currentDist / pinchStartRef.current.distance;
        const nextScale = pinchStartRef.current.scale * ratio;
        const dx = currentCenterX - pinchStartRef.current.centerX;
        const dy = currentCenterY - pinchStartRef.current.centerY;
        applyScaleAndTranslate(nextScale, {
          x: pinchStartRef.current.translate.x + dx,
          y: pinchStartRef.current.translate.y + dy,
        });
      } else if (e.touches.length === 1 && panStartRef.current && scaleRef.current > minScale + 0.02) {
        const t = e.touches[0];
        const dx = t.clientX - panStartRef.current.x;
        const dy = t.clientY - panStartRef.current.y;
        applyScaleAndTranslate(scaleRef.current, {
          x: panStartRef.current.translate.x + dx,
          y: panStartRef.current.translate.y + dy,
        });
      }
    },
    [applyScaleAndTranslate, minScale]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (e.touches.length < 2) {
        if (pinchStartRef.current) {
          lastPanEndTimeRef.current = Date.now();
        }
        pinchStartRef.current = null;
      }
      if (e.touches.length === 1 && scaleRef.current > minScale + 0.02) {
        panStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          translate: translateRef.current,
        };
      } else if (e.touches.length === 0) {
        panStartRef.current = null;
        setIsGesturing(false);
        window.setTimeout(() => {
          didPinchRef.current = false;
        }, 120);
      }
    },
    [minScale]
  );

  const onTouchCancel = useCallback(() => {
    pinchStartRef.current = null;
    panStartRef.current = null;
    didPinchRef.current = false;
    setIsGesturing(false);
  }, []);

  const wasPinchGesture = useCallback(() => {
    return didPinchRef.current || Date.now() - lastPanEndTimeRef.current < 180;
  }, []);

  const transformStyle = useMemo<React.CSSProperties>(
    () => ({
      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
      transformOrigin: 'center center',
      transition: isGesturing ? 'none' : 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
    }),
    [translate.x, translate.y, scale, isGesturing]
  );

  return {
    scale,
    translate,
    isFullscreen,
    isNativeFullscreen,
    isGesturing,
    transformStyle,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomScale,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    wasPinchGesture,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  };
}

export interface FullscreenZoomToolbarProps {
  scale: number;
  minScale?: number;
  maxScale?: number;
  isFullscreen: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  showZoomControls?: boolean;
  extraSlot?: React.ReactNode;
  className?: string;
}

export function FullscreenZoomToolbar({
  scale,
  minScale = 1,
  maxScale = 4,
  isFullscreen,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onToggleFullscreen,
  showZoomControls,
  extraSlot,
  className = '',
}: FullscreenZoomToolbarProps) {
  const displayZoomControls = showZoomControls ?? (isFullscreen || scale > minScale + 0.01);
  const pct = Math.round(scale * 100);

  return (
    <div
      role="toolbar"
      aria-label="Controles de zoom e tela cheia"
      className={`flex flex-wrap items-center justify-end gap-2 ${className}`}
    >
      {displayZoomControls && (
        <div className="inline-flex items-center gap-1 rounded-2xl bg-[#0B3321]/85 dark:bg-slate-950/85 backdrop-blur-md text-white px-2 py-1.5 shadow-2xl border border-white/20">
          <button
            type="button"
            disabled={scale <= minScale + 0.01}
            onClick={onZoomOut}
            title="Reduzir zoom (-)"
            aria-label="Reduzir zoom"
            className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-white/15 active:bg-white/25 disabled:opacity-40 flex items-center justify-center transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onResetZoom}
            title="Restaurar zoom 100% (tecla 0)"
            aria-label={`Zoom atual ${pct}%. Toque para resetar para 100%`}
            className="min-h-[44px] min-w-[56px] px-2.5 rounded-xl hover:bg-white/15 active:bg-white/25 font-mono text-xs font-bold tabular-nums inline-flex items-center justify-center gap-1 transition-colors"
          >
            <span>{pct}%</span>
            {scale > minScale + 0.01 && <RotateCcw className="w-3 h-3 opacity-80" />}
          </button>

          <button
            type="button"
            disabled={scale >= maxScale - 0.01}
            onClick={onZoomIn}
            title="Aumentar zoom (+)"
            aria-label="Aumentar zoom"
            className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-white/15 active:bg-white/25 disabled:opacity-40 flex items-center justify-center transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      )}

      {extraSlot}

      <button
        type="button"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
        aria-label={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#0B3321]/90 hover:bg-[#146C43] active:scale-95 text-white text-xs font-bold shadow-2xl border border-white/25 backdrop-blur-md inline-flex items-center gap-2 transition-all"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        <span>{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
      </button>
    </div>
  );
}
