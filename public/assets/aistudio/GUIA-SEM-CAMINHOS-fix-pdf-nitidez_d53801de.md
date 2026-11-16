# Correção do PDF borrado ao ampliar: guia SEM depender de caminhos

Use este guia quando o `.patch` não encaixar (pasta diferente, versão diferente do projeto
ou IA sem acesso ao repositório). Tudo é localizado **pelo conteúdo do texto**, não pelo caminho.

> Observação: a correção altera só **2 arquivos existentes** (o que contém `PdfCanvasSheet`
> e o CSS global) e cria **2 arquivos novos**. O `CampusPrimitives.tsx` **não** precisa ser alterado.

## 0. Prompt para colar na IA

```
Preciso corrigir PDF borrado ao ampliar no leitor do meu app React.
NÃO dependa de caminhos de arquivo: localize os arquivos pelo conteúdo, com
  grep -rl "function PdfCanvasSheet" .          (arquivo A: leitor)
  grep -rl "zoom-transform-stage" .             (arquivo B: CSS global; pegue o .css)
Se o grep não achar nada, me pergunte onde está o projeto e PARE (não invente arquivos).
Depois execute as etapas 1 a 6 do arquivo GUIA-SEM-CAMINHOS-fix-pdf-nitidez.md, na ordem,
alterando somente o que está descrito. Sem refatorar, sem renomear, sem novas dependências.
Ao final rode: npm run lint && npx vitest run && npm run build e mostre a saída.
```

## 1. Localizar os arquivos

```bash
grep -rl "function PdfCanvasSheet" --include=*.tsx .   # = ARQUIVO A (leitor)
grep -rl "zoom-transform-stage" --include=*.css .      # = ARQUIVO B (CSS global)
```

Se nenhum resultado aparecer, o projeto aberto pela IA **não é o ALEPA** (ou está em
outra pasta). Abra a pasta correta (a que tem `package.json` e `src/`) e repita.

## 2. Criar arquivo novo: `src/lib/pdfRenderScale.ts`

(Se não existir `src/lib`, crie a pasta, ou use a pasta de utilitários do projeto e
ajuste o import da etapa 3.)

```ts
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
```

## 3. No ARQUIVO A: adicionar o import

Logo **depois** da linha:

```ts
import { FullscreenZoomToolbar, useFullscreenZoom } from './ui/CampusPrimitives';
```

adicionar:

```ts
import { computeCanvasPixelRatio } from '../lib/pdfRenderScale';
```

(Ajuste o caminho relativo conforme a localização real dos dois arquivos.)

## 4. No ARQUIVO A: substituir o componente `PdfCanvasSheet`

Substitua **tudo** desde a linha `interface PdfCanvasSheetProps {` até a chave `}` que fecha
a função `PdfCanvasSheet` (o trecho termina logo antes de `export function BookReaderModal`),
por este bloco completo:

```tsx
interface PdfCanvasSheetProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  targetWidth: number;
  scaleOverride?: number;
  /** Zoom visual (CSS transform) já assentado; define a nitidez do canvas. 1 = sem zoom. */
  zoomRender?: number;
  theme: BookReaderTheme;
  allowDownload: boolean;
  onTextSelected?: (quote: string, pageNum: number) => void;
  className?: string;
}

function PdfCanvasSheet({
  pdfDoc,
  pageNumber,
  targetWidth,
  scaleOverride,
  zoomRender = 1,
  theme,
  allowDownload,
  onTextSelected,
  className = '',
}: PdfCanvasSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
  const hasRenderedRef = useRef(false);
  const textDocRef = useRef<PDFDocumentProxy | null>(null);
  const textKeyRef = useRef('');
  const [rendering, setRendering] = useState(true);
  const [dims, setDims] = useState<{ w: number; h: number }>({
    w: Math.max(260, Math.round(targetWidth)),
    h: Math.round(Math.max(260, targetWidth) * 1.414),
  });

  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      // Spinner só na 1ª renderização; refinamentos de zoom são silenciosos.
      if (!hasRenderedRef.current) setRendering(true);
      try {
        renderTaskRef.current?.cancel();
      } catch {
        // ignore cancel
      }

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const computedScale = scaleOverride
          ? scaleOverride
          : Math.max(0.45, Math.min(2.4, Math.max(260, targetWidth) / baseViewport.width));

        const viewport = page.getViewport({ scale: computedScale });
        const w = Math.floor(viewport.width);
        const h = Math.floor(viewport.height);
        setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        // Nitidez: DPR real do aparelho x zoom visual, com limites de memória.
        const pixelRatio = computeCanvasPixelRatio({
          devicePixelRatio: window.devicePixelRatio || 1,
          zoom: zoomRender,
          layoutWidth: w,
          layoutHeight: h,
        });
        const pxW = Math.max(1, Math.floor(w * pixelRatio));
        const pxH = Math.max(1, Math.floor(h * pixelRatio));

        // Renderiza fora da tela e só então troca, evitando piscar ao refinar.
        const offscreen = document.createElement('canvas');
        offscreen.width = pxW;
        offscreen.height = pxH;

        const task = page.render({
          canvas: offscreen,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
        });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) {
          offscreen.width = 0;
          offscreen.height = 0;
          return;
        }

        canvas.width = pxW;
        canvas.height = pxH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
        offscreen.width = 0;
        offscreen.height = 0;
        hasRenderedRef.current = true;

        // Camada de texto é vetorial: só refaz quando a página/escala de layout muda.
        const textKey = `${pageNumber}:${computedScale}`;
        const textContainer = textLayerRef.current;
        const textUpToDate = textDocRef.current === pdfDoc && textKeyRef.current === textKey;
        if (textContainer && !textUpToDate) {
          try {
            textLayerInstanceRef.current?.cancel();
          } catch {
            // ignore cancel
          }
          textContainer.innerHTML = '';
          textContainer.style.setProperty('--total-scale-factor', String(viewport.scale));
          textContainer.style.width = `${w}px`;
          textContainer.style.height = `${h}px`;

          const textContent = await page.getTextContent();
          if (cancelled) return;

          const tl = new TextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport,
          });
          textLayerInstanceRef.current = tl;
          await tl.render();
          textDocRef.current = pdfDoc;
          textKeyRef.current = textKey;
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          // Graceful fallback; canvas keeps clean surface
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel();
      } catch {
        // ignore
      }
      try {
        textLayerInstanceRef.current?.cancel();
      } catch {
        // ignore
      }
    };
  }, [pdfDoc, pageNumber, targetWidth, scaleOverride, zoomRender]);

  const handleMouseUp = () => {
    if (!onTextSelected) return;
    const sel = window.getSelection()?.toString().replace(/\s+/g, ' ').trim();
    if (sel && sel.length >= 4) {
      onTextSelected(sel.slice(0, 480), pageNumber);
    }
  };

  return (
    <div
      onContextMenu={allowDownload ? undefined : (e) => e.preventDefault()}
      onMouseUp={handleMouseUp}
      style={{ width: dims.w, height: dims.h }}
      className={`relative select-text overflow-hidden bg-white ${className}`}
    >
      <canvas
        ref={canvasRef}
        style={{ filter: THEME_STYLES[theme].canvasFilter }}
        className="block w-full h-full"
      />
      <div ref={textLayerRef} className="pdf-text-layer" />
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
          <Loader2 className="w-5 h-5 animate-spin text-[#146C43]" />
        </div>
      )}
    </div>
  );
}
```

## 5. No ARQUIVO A: três edições pequenas

**5.1** Logo depois da linha `const isFullscreen = zoom.isFullscreen;` (dentro de
`BookReaderModal`) acrescentar:

```tsx
  // Zoom "assentado": o canvas só é re-renderizado em alta resolução quando o
  // gesto/zoom termina (durante a pinça o CSS transform mantém a fluidez).
  const [renderZoom, setRenderZoom] = useState(1);
  useEffect(() => {
    if (zoom.isGesturing) return;
    const id = window.setTimeout(() => {
      setRenderZoom(Math.max(1, Math.ceil(zoom.scale * 4) / 4));
    }, 220);
    return () => window.clearTimeout(id);
  }, [zoom.scale, zoom.isGesturing]);
```

**5.2** Existem **4** usos de `<PdfCanvasSheet ... />` com a linha
`scaleOverride={zoomScale > 0 ? zoomScale : undefined}`. Em **cada um dos 4**, logo abaixo
dessa linha, adicionar (mesma indentação):

```tsx
zoomRender={renderZoom}
```

**5.3** No `<div>` que contém `zoom-transform-stage pdf-zoom-stage pinch-zoom-surface`
(usa `style={zoom.transformStyle}`), no final do template string do `className`, acrescentar
`${zoom.isGesturing ? 'is-gesturing' : ''}`. Resultado:

```tsx
className={`zoom-transform-stage pdf-zoom-stage pinch-zoom-surface w-full flex-1 flex flex-col items-center ${
  zoom.scale > 1.02 ? 'cursor-grab active:cursor-grabbing' : ''
} ${zoom.isGesturing ? 'is-gesturing' : ''}`}
```

## 6. No ARQUIVO B (CSS): trocar a regra

Trocar:

```css
.zoom-transform-stage {
  will-change: transform;
  transform-origin: center center;
}
```

por:

```css
.zoom-transform-stage {
  transform-origin: center center;
}

/* will-change fixa a rasterização na escala inicial e borra o conteúdo ampliado.
   Só é ativado enquanto o gesto de pinça está em andamento. */
.zoom-transform-stage.is-gesturing {
  will-change: transform;
}
```

## 7. (Opcional) teste unitário: `src/lib/pdfRenderScale.test.ts`

```ts
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
```

## 8. Validação

```bash
npm run lint
npx vitest run src/lib/pdfRenderScale.test.ts
npm run build
```

Teste manual: abra um PDF, dê zoom de 3x a 4x (pinça ou botão +) e **solte**. Em ~0,3 s o
texto deve ficar nítido; os botões A-/A+ (60 a 220%) continuam funcionando.

## Se algo não existir no seu projeto

| Sintoma | Significa | O que fazer |
|---|---|---|
| `grep` não acha `PdfCanvasSheet` | Versão diferente/outro projeto | Envie o arquivo do leitor de PDF para eu adaptar |
| `useFullscreenZoom` não tem `isGesturing` | Hook mais antigo | Envie o `CampusPrimitives.tsx` desse projeto |
| `page.render` sem `canvas:` (usa `canvasContext`) | pdf.js em versão antiga | No bloco da etapa 4, troque `canvas: offscreen` por `canvasContext: offscreen.getContext('2d')!` |
