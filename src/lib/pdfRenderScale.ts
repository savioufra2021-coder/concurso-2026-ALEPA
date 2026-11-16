/**
 * Cálculo da densidade de pixels (pixel ratio) do canvas do PDF.
 *
 * O layout (CSS px) da página é fixo; o que muda com o zoom é quantos pixels
 * reais o canvas tem. Assim, ao ampliar por CSS transform, o canvas já foi
 * re-renderizado em resolução suficiente e o texto continua nítido.
 */

/** iOS Safari limita a área do canvas a ~16,7 milhões de pixels. */
export const MAX_CANVAS_PIXELS = 16_000_000;
/** Lado máximo seguro entre navegadores. */
export const MAX_CANVAS_SIDE = 8192;
/** Teto de nitidez extra: acima disso não há ganho perceptível. */
export const MAX_PIXEL_RATIO = 6;

export interface PixelRatioInput {
  /** window.devicePixelRatio real do aparelho. */
  devicePixelRatio: number;
  /** Zoom visual aplicado por CSS transform (1 = sem zoom). */
  zoom: number;
  /** Largura do layout da página, em CSS px. */
  layoutWidth: number;
  /** Altura do layout da página, em CSS px. */
  layoutHeight: number;
}

export function computeCanvasPixelRatio({
  devicePixelRatio,
  zoom,
  layoutWidth,
  layoutHeight,
}: PixelRatioInput): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const z = Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
  const w = Math.max(1, layoutWidth);
  const h = Math.max(1, layoutHeight);

  const wanted = Math.min(dpr * z, MAX_PIXEL_RATIO);
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
  const bySide = MAX_CANVAS_SIDE / Math.max(w, h);

  // Nunca abaixo de 1; arredonda para baixo em 2 casas para não estourar o limite.
  const ratio = Math.min(wanted, byArea, bySide);
  return Math.max(1, Math.floor(ratio * 100) / 100);
}
