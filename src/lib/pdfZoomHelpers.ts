export const MIN_PDF_ZOOM = 0.5;
export const MAX_PDF_ZOOM = 2.5;
export const PDF_ZOOM_STEP = 0.15;
export const PDF_WHEEL_ZOOM_STEP = 0.1;

export const PDF_ZOOM_PRESETS = [
  { label: 'Ajustar', value: 0 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
] as const;

export function clampPdfZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, Number(scale.toFixed(2))));
}

export function stepPdfZoom(
  currentZoomScale: number,
  delta: number,
  fitScaleEstimate = 1
): number {
  const safeFit =
    Number.isFinite(fitScaleEstimate) && fitScaleEstimate > 0 ? fitScaleEstimate : 1;
  const base = currentZoomScale === 0 ? safeFit : currentZoomScale;
  return clampPdfZoom(base + delta);
}

export function computeCenteredScrollLeft(
  scrollWidth: number,
  clientWidth: number
): number {
  if (
    !Number.isFinite(scrollWidth) ||
    !Number.isFinite(clientWidth) ||
    scrollWidth <= clientWidth
  ) {
    return 0;
  }
  return Math.max(0, Math.round((scrollWidth - clientWidth) / 2));
}

export function computePdfPageWidth(options: {
  measuredWidth: number;
  isExpanded: boolean;
  mode: 'single' | 'spread' | 'original';
}): number {
  const safeWidth = Math.max(220, Math.floor(options.measuredWidth));
  if (options.mode === 'spread') {
    const cap = options.isExpanded ? 580 : 460;
    return Math.max(220, Math.min(cap, Math.floor((safeWidth - 56) / 2)));
  }
  if (options.mode === 'original') {
    const cap = options.isExpanded ? 1160 : 880;
    return Math.max(220, Math.min(cap, safeWidth - 24));
  }
  const cap = options.isExpanded ? 860 : 680;
  return Math.max(220, Math.min(cap, safeWidth - 24));
}

export function formatZoomBadge(zoomScale: number): string {
  if (zoomScale === 0) return 'Ajustar';
  return `${Math.round(zoomScale * 100)}%`;
}
