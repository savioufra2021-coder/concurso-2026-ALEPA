import { describe, expect, it } from 'vitest';
import { computeCanvasPixelRatio, MAX_CANVAS_PIXELS, MAX_PIXEL_RATIO } from './pdfRenderScale';

describe('computeCanvasPixelRatio', () => {
  it('sem zoom usa o DPR real (sem o antigo teto de 2)', () => {
    expect(computeCanvasPixelRatio({ devicePixelRatio: 3, zoom: 1, layoutWidth: 600, layoutHeight: 850 })).toBe(3);
  });

  it('multiplica DPR pelo zoom', () => {
    expect(computeCanvasPixelRatio({ devicePixelRatio: 2, zoom: 2, layoutWidth: 600, layoutHeight: 850 })).toBe(4);
  });

  it('respeita o teto de nitidez', () => {
    const r = computeCanvasPixelRatio({ devicePixelRatio: 3, zoom: 4, layoutWidth: 200, layoutHeight: 200 });
    expect(r).toBeLessThanOrEqual(MAX_PIXEL_RATIO);
  });

  it('nunca passa o limite de área do canvas (iOS)', () => {
    const w = 720;
    const h = 1018;
    const r = computeCanvasPixelRatio({ devicePixelRatio: 3, zoom: 4, layoutWidth: w, layoutHeight: h });
    expect(w * r * (h * r)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(r).toBeGreaterThanOrEqual(1);
  });

  it('entradas inválidas caem para 1', () => {
    expect(computeCanvasPixelRatio({ devicePixelRatio: NaN, zoom: 0, layoutWidth: 0, layoutHeight: 0 })).toBe(1);
  });
});
