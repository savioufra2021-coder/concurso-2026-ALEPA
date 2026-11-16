import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Highlighter,
  History,
  ListTree,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  StickyNote,
  Sun,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getDisciplineShortName } from '../data/alepaSyllabus';
import { parseGoogleWorkspaceUrl } from '../lib/googleWorkspace';
import {
  classifyMaterialOpeningMode,
  loadAndParseEpub,
  loadAndParseHtmlPortal,
  type ParsedStructuredBook,
} from '../lib/epubAndHtmlEngine';
import {
  extractPdfOutline,
  extractStructuredPageContent,
  getMaterialProgressKey,
  isAllowedHtmlPortalUrl,
  loadPdfDocument,
  PdfOutlineNode,
  PdfSearchHit,
  PdfSourceError,
  resolvePdfDocumentSource,
  searchPdfDocument,
  StructuredPageContent,
} from '../lib/pdfBookEngine';
import {
  BookReaderMode,
  BookReaderTheme,
  HighlightColor,
  ReaderAnnotation,
  ReaderBookmark,
  ReaderHighlight,
  StudyMaterial,
} from '../types';
import { FullscreenZoomToolbar, useFullscreenZoom } from './ui/CampusPrimitives';
import { computeCanvasPixelRatio } from '../lib/pdfRenderScale';
import {
  computeCenteredScrollLeft,
  computePdfPageWidth,
  formatZoomBadge,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  PDF_WHEEL_ZOOM_STEP,
  PDF_ZOOM_PRESETS,
  PDF_ZOOM_STEP,
  stepPdfZoom,
} from '../lib/pdfZoomHelpers';

type SidebarTab = 'outline' | 'bookmarks' | 'highlights' | 'annotations' | 'search';

interface BookReaderModalProps {
  material: StudyMaterial;
  initialPage?: number;
  initialChapterId?: string;
  initialSearchQuery?: string;
  onClose: () => void;
  onSummarizeWithGemini?: (target: {
    mode: 'pdf';
    materialId?: string;
    url?: string;
    title?: string;
    disciplineId?: string;
  }) => void;
}

const HIGHLIGHT_SWATCHES: Record<
  HighlightColor,
  { label: string; dot: string; bg: string; border: string }
> = {
  amber: {
    label: 'Amarelo',
    dot: 'bg-amber-400',
    bg: 'bg-amber-50 text-amber-950',
    border: 'border-amber-200',
  },
  emerald: {
    label: 'Verde',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 text-emerald-950',
    border: 'border-emerald-200',
  },
  sky: {
    label: 'Azul',
    dot: 'bg-sky-500',
    bg: 'bg-sky-50 text-sky-950',
    border: 'border-sky-200',
  },
  rose: {
    label: 'Rosa',
    dot: 'bg-rose-500',
    bg: 'bg-rose-50 text-rose-950',
    border: 'border-rose-200',
  },
};

const THEME_STYLES: Record<
  BookReaderTheme,
  {
    label: string;
    shellBg: string;
    headerBg: string;
    panelBg: string;
    surfaceBg: string;
    pageCard: string;
    textMain: string;
    textMuted: string;
    border: string;
    canvasFilter: string;
  }
> = {
  paper: {
    label: 'Papel',
    shellBg: 'bg-[#EEF2F0]',
    headerBg: 'bg-white text-slate-900 border-slate-200',
    panelBg: 'bg-white text-slate-900 border-slate-200',
    surfaceBg: 'bg-[#E5ECE8]',
    pageCard: 'bg-white text-slate-900 border-slate-200/90 shadow-md',
    textMain: 'text-slate-900',
    textMuted: 'text-slate-500',
    border: 'border-slate-200',
    canvasFilter: 'none',
  },
  sepia: {
    label: 'Sépia',
    shellBg: 'bg-[#EFE6D5]',
    headerBg: 'bg-[#FAF3E6] text-[#3B2F1E] border-[#DFD2BA]',
    panelBg: 'bg-[#FAF3E6] text-[#3B2F1E] border-[#DFD2BA]',
    surfaceBg: 'bg-[#E8DEC9]',
    pageCard: 'bg-[#FBF6EC] text-[#382C1C] border-[#DFD2BA] shadow-md',
    textMain: 'text-[#382C1C]',
    textMuted: 'text-[#77664F]',
    border: 'border-[#DFD2BA]',
    canvasFilter: 'sepia(0.22) brightness(0.97)',
  },
  night: {
    label: 'Noturno',
    shellBg: 'bg-[#090F1A]',
    headerBg: 'bg-[#0F172A] text-slate-100 border-slate-800',
    panelBg: 'bg-[#0F172A] text-slate-100 border-slate-800',
    surfaceBg: 'bg-[#070B13]',
    pageCard: 'bg-[#131C2E] text-slate-100 border-slate-700/80 shadow-lg',
    textMain: 'text-slate-100',
    textMuted: 'text-slate-400',
    border: 'border-slate-800',
    canvasFilter: 'invert(0.88) hue-rotate(180deg) brightness(0.95) contrast(0.96)',
  },
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  onScaleResolved?: (scale: number) => void;
  onLayoutChanged?: () => void;
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
  onScaleResolved,
  onLayoutChanged,
  className = '',
}: PdfCanvasSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
  const hasRenderedRef = useRef(false);
  const textDocRef = useRef<PDFDocumentProxy | null>(null);
  const textKeyRef = useRef('');
  const onScaleResolvedRef = useRef(onScaleResolved);
  onScaleResolvedRef.current = onScaleResolved;
  const onLayoutChangedRef = useRef(onLayoutChanged);
  onLayoutChangedRef.current = onLayoutChanged;
  const [rendering, setRendering] = useState(true);
  const [dims, setDims] = useState<{ w: number; h: number }>({
    w: Math.max(220, Math.round(targetWidth)),
    h: Math.round(Math.max(220, targetWidth) * 1.414),
  });

  useEffect(() => {
    onLayoutChangedRef.current?.();
  }, [dims.w, dims.h]);

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
          : Math.max(0.45, Math.min(2.5, Math.max(220, targetWidth) / baseViewport.width));

        onScaleResolvedRef.current?.(computedScale);

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
      className={`relative shrink-0 select-text overflow-hidden bg-white ${className}`}
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

export function BookReaderModal({
  material,
  initialPage,
  initialChapterId,
  initialSearchQuery,
  onClose,
  onSummarizeWithGemini,
}: BookReaderModalProps) {
  const {
    readingProgressMap,
    saveReadingProgress,
    workspaceAccessToken,
    connectGoogleWorkspace,
  } = useAuth();

  const progressKey = getMaterialProgressKey(material.id);
  const initialSaved = readingProgressMap[progressKey] || readingProgressMap[material.id];
  const allowDownload = material.allowDownload !== false;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportAreaRef = useRef<HTMLDivElement | null>(null);
  const structuredCacheRef = useRef<Map<number, StructuredPageContent>>(new Map());
  const searchTextCacheRef = useRef<Map<number, string>>(new Map());
  const searchAbortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const structuredBookRef = useRef<ParsedStructuredBook | null>(null);
  const initialDeepSearchAppliedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<PdfSourceError['code'] | null>(null);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [drivePreviewId, setDrivePreviewId] = useState<string | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [structuredBook, setStructuredBook] = useState<ParsedStructuredBook | null>(null);
  const [numPages, setNumPages] = useState<number>(initialSaved?.totalPages || material.pageCount || 1);
  const [resolvedFileName, setResolvedFileName] = useState<string>(material.fileName || material.title);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | undefined>(material.fileSizeBytes);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [outline, setOutline] = useState<PdfOutlineNode[]>([]);

  // Viewport & responsive detection
  const [viewportSize, setViewportSize] = useState<{ width: number; isDesktop: boolean; isTabletOrDesktop: boolean }>(
    () => ({
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
      isTabletOrDesktop: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
    })
  );
  const [measuredWidth, setMeasuredWidth] = useState<number>(760);

  // Active reader settings & reading state
  const matchedChapterPage = useMemo(() => {
    if (!initialChapterId || !material.chapters?.length) return undefined;
    const ch = material.chapters.find((c) => c.id === initialChapterId);
    return ch?.startPage && ch.startPage >= 1 ? ch.startPage : undefined;
  }, [initialChapterId, material.chapters]);

  const initialPageVal = Math.max(
    1,
    typeof initialPage === 'number' && initialPage >= 1
      ? Math.round(initialPage)
      : matchedChapterPage || initialSaved?.lastPage || material.startPage || 1
  );
  const [currentPage, setCurrentPage] = useState<number>(initialPageVal);
  const [pageInput, setPageInput] = useState<string>(String(initialPageVal));
  const [readingMode, setReadingMode] = useState<BookReaderMode>(initialSaved?.readingMode || 'book');
  const [cleanReading, setCleanReading] = useState<boolean>(false);
  const [bookSpread, setBookSpread] = useState<'auto' | 'single' | 'double'>('auto');
  const [theme, setTheme] = useState<BookReaderTheme>(initialSaved?.theme || 'paper');
  const [fontSize, setFontSize] = useState<number>(initialSaved?.fontSize || 17);
  const [lineHeight, setLineHeight] = useState<number>(initialSaved?.lineHeight || 1.65);
  const [maxWidthCh, setMaxWidthCh] = useState<number>(initialSaved?.maxWidthCh || 68);
  const [zoomScale, setZoomScale] = useState<number>(0); // 0 = ajustar à largura
  const [isExpanded, setIsExpanded] = useState<boolean>(true); // true = Tela Cheia por padrão
  const lastFitScaleRef = useRef<number>(1);
  const centerScrollRequestedRef = useRef<boolean>(false);
  const [hideAllToolbars, setHideAllToolbars] = useState<boolean>(() => {
    try {
      return localStorage.getItem('alepa_reader_hide_toolbars') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHideAllToolbars = useCallback(() => {
    setHideAllToolbars((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('alepa_reader_hide_toolbars', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleEnterNativeFullscreen = useCallback(() => {
    setIsExpanded(true);
    centerScrollRequestedRef.current = true;
  }, []);

  const handleExitNativeFullscreen = useCallback(() => {
    setIsExpanded(false);
    centerScrollRequestedRef.current = true;
  }, []);

  const zoom = useFullscreenZoom({
    targetRef: rootRef,
    gestureTargetRef: viewportAreaRef,
    minScale: 1,
    maxScale: 3,
    step: 0.25,
    enableKeyboardShortcuts: false,
    enableWheelZoom: false,
    onEnterFullscreen: handleEnterNativeFullscreen,
    onExitFullscreen: handleExitNativeFullscreen,
  });
  const isFullscreen = zoom.isFullscreen;
  const expandedActive = isExpanded || isFullscreen;

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

  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>(initialSaved?.bookmarks || []);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>(initialSaved?.highlights || []);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>(initialSaved?.annotations || []);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Tools sidebar / drawer — fechado por padrão no modo compacto
  const [panelOpen, setPanelOpen] = useState<boolean>(() =>
    Boolean(initialSearchQuery && initialSearchQuery.trim().length >= 2)
  );
  const [activeTab, setActiveTab] = useState<SidebarTab>('outline');

  // Reflow reading content state
  const [readingContent, setReadingContent] = useState<StructuredPageContent | null>(null);
  const [loadingReadingPage, setLoadingReadingPage] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [searchHits, setSearchHits] = useState<PdfSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Highlight & Annotation composer state
  const [selectedQuote, setSelectedQuote] = useState<{ quote: string; page: number } | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('amber');
  const [highlightNote, setHighlightNote] = useState('');
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const themeStyle = THEME_STYLES[theme];

  // Track window resize & available reading area width
  const wasDesktopRef = useRef<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  useEffect(() => {
    const updateMetrics = () => {
      const w = window.innerWidth;
      const nowDesktop = w >= 1024;
      if (wasDesktopRef.current && !nowDesktop) {
        setPanelOpen(false);
      }
      wasDesktopRef.current = nowDesktop;
      setViewportSize({
        width: w,
        isDesktop: nowDesktop,
        isTabletOrDesktop: w >= 768,
      });
      if (viewportAreaRef.current) {
        setMeasuredWidth(Math.max(240, viewportAreaRef.current.clientWidth - 24));
      }
    };
    updateMetrics();
    const raf = window.requestAnimationFrame(updateMetrics);
    window.addEventListener('resize', updateMetrics);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [panelOpen, isFullscreen, isExpanded]);

  useEffect(() => {
    if (!viewportAreaRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setMeasuredWidth(Math.max(240, Math.floor(entry.contentRect.width - 24)));
      }
    });
    ro.observe(viewportAreaRef.current);
    return () => ro.disconnect();
  }, [loadingDoc, isExpanded]);

  const centerPdfViewportHorizontally = useCallback(() => {
    const el = viewportAreaRef.current;
    if (!el) return;
    el.scrollLeft = computeCenteredScrollLeft(el.scrollWidth, el.clientWidth);
  }, []);

  const handleSheetLayoutChanged = useCallback(() => {
    if (!centerScrollRequestedRef.current) return;
    window.requestAnimationFrame(() => {
      centerPdfViewportHorizontally();
      centerScrollRequestedRef.current = false;
    });
  }, [centerPdfViewportHorizontally]);

  const handleSheetScaleResolved = useCallback((scale: number) => {
    if (zoomScale === 0 && Number.isFinite(scale) && scale > 0) {
      lastFitScaleRef.current = scale;
    }
  }, [zoomScale]);

  const applyZoomPreset = useCallback(
    (presetValue: number) => {
      zoom.resetZoom();
      centerScrollRequestedRef.current = true;
      setZoomScale(presetValue);
    },
    [zoom]
  );

  const applyZoomStep = useCallback(
    (delta: number) => {
      zoom.resetZoom();
      centerScrollRequestedRef.current = true;
      setZoomScale((prev) => stepPdfZoom(prev, delta, lastFitScaleRef.current));
    },
    [zoom]
  );

  useEffect(() => {
    if (!centerScrollRequestedRef.current) return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        centerPdfViewportHorizontally();
        centerScrollRequestedRef.current = false;
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [zoomScale, expandedActive, readingMode, bookSpread, measuredWidth, centerPdfViewportHorizontally]);

  // Ctrl + roda do mouse no desktop: aplica zoom sem atrapalhar rolagem normal do PDF
  useEffect(() => {
    const el = viewportAreaRef.current;
    if (!el) return;
    const handleCtrlWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (structuredBookRef.current || (readingMode !== 'book' && readingMode !== 'original')) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY < 0 ? PDF_WHEEL_ZOOM_STEP : -PDF_WHEEL_ZOOM_STEP;
      zoom.resetZoom();
      centerScrollRequestedRef.current = true;
      setZoomScale((prev) => stepPdfZoom(prev, delta, lastFitScaleRef.current));
    };
    el.addEventListener('wheel', handleCtrlWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleCtrlWheel);
  }, [readingMode, loadingDoc, zoom]);

  const handleToggleExpand = useCallback(async () => {
    centerScrollRequestedRef.current = true;
    if (expandedActive) {
      setIsExpanded(false);
      if (isFullscreen) {
        await zoom.exitFullscreen();
      }
      return;
    }
    setIsExpanded(true);
    if (viewportSize.isDesktop) {
      await zoom.enterFullscreen();
    }
  }, [expandedActive, isFullscreen, viewportSize.isDesktop, zoom]);

  const toggleFullscreen = async () => {
    await handleToggleExpand();
  };

  // Load PDF, EPUB or Authorized HTML Portal document
  const loadDocument = useCallback(
    async (tokenOverride?: string | null) => {
      setLoadingDoc(true);
      setLoadError(null);
      setErrorCode(null);
      structuredCacheRef.current.clear();
      searchTextCacheRef.current.clear();
      structuredBookRef.current = null;
      setStructuredBook(null);

      if (pdfDocRef.current) {
        try {
          await pdfDocRef.current.loadingTask.destroy();
        } catch {
          // ignore
        }
        pdfDocRef.current = null;
        setPdfDoc(null);
      }
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      const parsedDrive = parseGoogleWorkspaceUrl(material.url);
      if (parsedDrive.kind === 'drive_file' && parsedDrive.id) {
        setDrivePreviewId(parsedDrive.id);
        setLoadingDoc(false);
        return;
      }

      if (material.pendingDefinition) {
        setErrorCode('LOAD_FAILED');
        setLoadError('Este item está reservado com definição pendente aguardando confirmação no catálogo.');
        setLoadingDoc(false);
        return;
      }

      const mode = classifyMaterialOpeningMode(material);

      const applyStructuredBook = (book: ParsedStructuredBook) => {
        structuredBookRef.current = book;
        setStructuredBook(book);
        setNumPages(book.units.length);
        setOutline(book.outline);
        if (book.blobUrlForDownload) {
          blobUrlRef.current = book.blobUrlForDownload;
          setDownloadBlobUrl(book.blobUrlForDownload);
        } else {
          setDownloadBlobUrl(null);
        }
        setReadingMode('reading');
        const matchedUnit = initialChapterId
          ? book.units.find((u) => u.chapterId === initialChapterId)?.unitNumber
          : undefined;
        setCurrentPage((prev) => {
          const target = matchedUnit || prev;
          const clamped = Math.max(1, Math.min(book.units.length, target));
          setPageInput(String(clamped));
          return clamped;
        });
      };

      try {
        if (mode === 'epub') {
          const book = await loadAndParseEpub({
            url: material.url,
            fileName: material.fileName,
            title: material.title,
            workspaceAccessToken: tokenOverride ?? workspaceAccessToken,
          });
          applyStructuredBook(book);
          return;
        }

        if (mode === 'html_portal') {
          const book = await loadAndParseHtmlPortal(material.url, material.title);
          applyStructuredBook(book);
          return;
        }

        if (mode === 'external') {
          setErrorCode('LOAD_FAILED');
          setLoadError('Este endereço abre no portal de origem ou aplicativo correspondente.');
          return;
        }

        const source = await resolvePdfDocumentSource({
          url: material.url,
          fileName: material.fileName,
          workspaceAccessToken: tokenOverride ?? workspaceAccessToken,
        });
        if (source.blobUrlForDownload) {
          blobUrlRef.current = source.blobUrlForDownload;
          setDownloadBlobUrl(source.blobUrlForDownload);
        } else {
          setDownloadBlobUrl(null);
        }
        if (source.resolvedFileName) setResolvedFileName(source.resolvedFileName);
        if (source.fileSizeBytes) setFileSizeBytes(source.fileSizeBytes);

        const doc = await loadPdfDocument(source);
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        setCurrentPage((prev) => {
          const clamped = Math.max(1, Math.min(doc.numPages, prev));
          setPageInput(String(clamped));
          return clamped;
        });

        const parsedOutline = await extractPdfOutline(doc);
        setOutline(parsedOutline);
      } catch (err) {
        if (
          err instanceof PdfSourceError &&
          err.code === 'HTML_PORTAL' &&
          isAllowedHtmlPortalUrl(material.url)
        ) {
          try {
            const book = await loadAndParseHtmlPortal(material.url, material.title);
            applyStructuredBook(book);
            return;
          } catch (portalErr) {
            setErrorCode('HTML_PORTAL');
            setLoadError(
              portalErr instanceof Error
                ? portalErr.message
                : 'Não foi possível extrair o conteúdo desta página oficial.'
            );
            return;
          }
        }

        if (err instanceof PdfSourceError) {
          setErrorCode(err.code);
          setLoadError(err.message);
        } else {
          setErrorCode('LOAD_FAILED');
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar este documento no leitor integrado.'
          );
        }
      } finally {
        setLoadingDoc(false);
      }
    },
    [material, initialChapterId, workspaceAccessToken]
  );

  useEffect(() => {
    initialDeepSearchAppliedRef.current = false;
    void loadDocument();
    return () => {
      searchAbortRef.current?.abort();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (pdfDocRef.current) {
        void pdfDocRef.current.loadingTask.destroy();
        pdfDocRef.current = null;
      }
      structuredBookRef.current = null;
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [loadDocument]);

  // Reflow reading extraction with LRU cache (max 25 pages) for PDFs, or direct chapter unit for EPUB/HTML
  useEffect(() => {
    if (structuredBook) {
      const unit = structuredBook.units[currentPage - 1] || structuredBook.units[0];
      if (unit) {
        setReadingContent({
          pageNumber: unit.unitNumber,
          blocks: unit.blocks,
          plainText: unit.plainText,
          charCount: unit.plainText.replace(/\s+/g, '').length,
          isLikelyScanned: false,
        });
      }
      return;
    }

    if (!pdfDoc || readingMode !== 'reading') return;
    let cancelled = false;

    const loadStructured = async () => {
      const cached = structuredCacheRef.current.get(currentPage);
      if (cached) {
        setReadingContent(cached);
        return;
      }
      setLoadingReadingPage(true);
      try {
        const extracted = await extractStructuredPageContent(pdfDoc, currentPage);
        if (cancelled) return;
        const cache = structuredCacheRef.current;
        if (cache.size >= 25) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(currentPage, extracted);
        setReadingContent(extracted);
      } catch {
        if (!cancelled) {
          setReadingContent({
            pageNumber: currentPage,
            blocks: [],
            plainText: '',
            charCount: 0,
            isLikelyScanned: true,
          });
        }
      } finally {
        if (!cancelled) setLoadingReadingPage(false);
      }
    };

    void loadStructured();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, structuredBook, currentPage, readingMode]);

  // Persist ReadingProgress helper
  const latestStateRef = useRef({
    currentPage,
    numPages,
    readingMode,
    fontSize,
    lineHeight,
    maxWidthCh,
    theme,
    bookmarks,
    highlights,
    annotations,
  });
  latestStateRef.current = {
    currentPage,
    numPages,
    readingMode,
    fontSize,
    lineHeight,
    maxWidthCh,
    theme,
    bookmarks,
    highlights,
    annotations,
  };

  const flushProgress = useCallback(
    async (overrides?: Partial<typeof latestStateRef.current>) => {
      if (!pdfDocRef.current && !structuredBookRef.current && numPages <= 1) return;
      const snap = { ...latestStateRef.current, ...overrides };
      const safeTotal = Math.max(1, snap.numPages);
      const safePage = Math.max(1, Math.min(safeTotal, snap.currentPage));
      const pct = Math.max(1, Math.min(100, Math.round((safePage / safeTotal) * 100)));

      setSaveStatus('saving');
      try {
        await saveReadingProgress(material.id, {
          materialTitle: material.title,
          lastPage: safePage,
          totalPages: safeTotal,
          progressPercent: pct,
          readingMode: snap.readingMode,
          fontSize: snap.fontSize,
          lineHeight: snap.lineHeight,
          maxWidthCh: snap.maxWidthCh,
          theme: snap.theme,
          bookmarks: snap.bookmarks,
          highlights: snap.highlights,
          annotations: snap.annotations,
          lastReadAt: new Date().toISOString(),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [material.id, material.title, numPages, saveReadingProgress]
  );

  // Debounced auto-save when page/mode/typography/theme changes
  useEffect(() => {
    if (loadingDoc || (!pdfDoc && !structuredBook)) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushProgress();
    }, 650);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    loadingDoc,
    pdfDoc,
    structuredBook,
    currentPage,
    numPages,
    readingMode,
    fontSize,
    lineHeight,
    maxWidthCh,
    theme,
    flushProgress,
  ]);

  const handleRequestClose = async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pdfDocRef.current || structuredBookRef.current) {
      await flushProgress();
    }
    try {
      await zoom.exitFullscreen();
    } catch {
      // ignore
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
    onClose();
  };

  // Determine spread count in Book mode
  const useTwoPageSpread = useMemo(() => {
    if (structuredBook) return false;
    if (readingMode !== 'book') return false;
    if (!viewportSize.isTabletOrDesktop || measuredWidth < 680) return false;
    if (bookSpread === 'single') return false;
    if (bookSpread === 'double') return numPages > 1;
    // auto: 2-page spread when viewport has comfortable width (>= 860px inside reader)
    return measuredWidth >= 820 && numPages > 1;
  }, [structuredBook, readingMode, viewportSize.isTabletOrDesktop, measuredWidth, bookSpread, numPages]);

  const stepSize = useTwoPageSpread ? 2 : 1;

  const goToPage = useCallback(
    (target: number) => {
      const clamped = Math.max(1, Math.min(numPages, Math.round(target)));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      setSelectedQuote(null);
    },
    [numPages]
  );

  const goNext = useCallback(() => {
    goToPage(Math.min(numPages, currentPage + stepSize));
  }, [currentPage, numPages, stepSize, goToPage]);

  const goPrev = useCallback(() => {
    goToPage(Math.max(1, currentPage - stepSize));
  }, [currentPage, stepSize, goToPage]);

  // Keyboard navigation & PDF zoom shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        if (selectedQuote) {
          setSelectedQuote(null);
          return;
        }
        if (cleanReading) {
          setCleanReading(false);
          return;
        }
        if (expandedActive) {
          setIsExpanded(false);
          if (isFullscreen) {
            void zoom.exitFullscreen();
          }
          return;
        }
        void handleRequestClose();
        return;
      }
      if (isEditing) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (!structuredBook && (readingMode === 'book' || readingMode === 'original')) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          applyZoomStep(PDF_ZOOM_STEP);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          applyZoomStep(-PDF_ZOOM_STEP);
        } else if (e.key === '0' && (e.ctrlKey || e.metaKey || zoomScale !== 0 || zoom.scale > 1.02)) {
          e.preventDefault();
          applyZoomPreset(0);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Search PDF or structured EPUB/HTML text
  const runSearch = useCallback(
    async (query: string, jumpToFirstIfNoInitialPage = false) => {
      searchAbortRef.current?.abort();
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setSearchHits([]);
        setSearching(false);
        return;
      }

      if (structuredBookRef.current) {
        const q = trimmed.toLowerCase();
        const hits: PdfSearchHit[] = [];
        for (const unit of structuredBookRef.current.units) {
          const hay = `${unit.title}\n${unit.plainText}`;
          const lower = hay.toLowerCase();
          const firstIdx = lower.indexOf(q);
          if (firstIdx !== -1) {
            let count = 0;
            let pos = firstIdx;
            while (pos !== -1) {
              count += 1;
              pos = lower.indexOf(q, pos + q.length);
            }
            const start = Math.max(0, firstIdx - 45);
            const end = Math.min(hay.length, firstIdx + q.length + 75);
            hits.push({
              id: `unit_hit_${unit.unitNumber}`,
              pageNumber: unit.unitNumber,
              snippet: `${start > 0 ? '...' : ''}${hay.slice(start, end)}${end < hay.length ? '...' : ''}`,
              matchCount: count,
            });
          }
          if (hits.length >= 60) break;
        }
        setSearchHits(hits);
        setSearching(false);
        if (jumpToFirstIfNoInitialPage && hits.length > 0) {
          goToPage(hits[0].pageNumber);
        }
        return;
      }

      if (!pdfDoc) return;
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      setSearching(true);
      try {
        const hits = await searchPdfDocument(
          pdfDoc,
          trimmed,
          searchTextCacheRef.current,
          ctrl.signal
        );
        if (!ctrl.signal.aborted) {
          setSearchHits(hits);
          if (jumpToFirstIfNoInitialPage && hits.length > 0) {
            goToPage(hits[0].pageNumber);
          }
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setSearching(false);
        }
      }
    },
    [pdfDoc, goToPage]
  );

  // Live debounced search as user types
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, runSearch]);

  const totalMatchCount = useMemo(
    () => searchHits.reduce((acc, h) => acc + h.matchCount, 0),
    [searchHits]
  );

  // Automatically trigger deep-link search if initialSearchQuery is supplied
  useEffect(() => {
    if (loadingDoc || loadError || (!pdfDoc && !structuredBook)) return;
    if (initialDeepSearchAppliedRef.current) return;
    const trimmed = (initialSearchQuery || '').trim();
    if (trimmed.length >= 2) {
      initialDeepSearchAppliedRef.current = true;
      setSearchQuery(trimmed);
      const shouldAutoJump = !(typeof initialPage === 'number' && initialPage >= 1) && !matchedChapterPage;
      void runSearch(trimmed, shouldAutoJump);
    }
  }, [loadingDoc, loadError, pdfDoc, structuredBook, initialSearchQuery, initialPage, matchedChapterPage, runSearch]);

  // Bookmark helpers
  const currentPageBookmarks = useMemo(
    () => bookmarks.filter((b) => b.page === currentPage),
    [bookmarks, currentPage]
  );

  const handleToggleQuickBookmark = () => {
    let next: ReaderBookmark[];
    if (currentPageBookmarks.length > 0) {
      next = bookmarks.filter((b) => b.page !== currentPage);
    } else {
      const item: ReaderBookmark = {
        id: `bm_${Date.now()}`,
        page: currentPage,
        label: bookmarkLabel.trim() || `Página ${currentPage}`,
        createdAt: new Date().toISOString(),
      };
      next = [item, ...bookmarks].sort((a, b) => a.page - b.page);
      setBookmarkLabel('');
    }
    setBookmarks(next);
    void flushProgress({ bookmarks: next });
  };

  const handleAddCustomBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    const item: ReaderBookmark = {
      id: `bm_${Date.now()}`,
      page: currentPage,
      label: bookmarkLabel.trim() || `Marcador · p. ${currentPage}`,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...bookmarks].sort((a, b) => a.page - b.page);
    setBookmarks(next);
    setBookmarkLabel('');
    void flushProgress({ bookmarks: next });
  };

  const handleDeleteBookmark = (id: string) => {
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarks(next);
    void flushProgress({ bookmarks: next });
  };

  // Highlight helpers
  const handleSaveHighlight = () => {
    if (!selectedQuote) return;
    const item: ReaderHighlight = {
      id: `hl_${Date.now()}`,
      page: selectedQuote.page,
      quote: selectedQuote.quote,
      color: highlightColor,
      note: highlightNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...highlights];
    setHighlights(next);
    setSelectedQuote(null);
    setHighlightNote('');
    setPanelOpen(true);
    setActiveTab('highlights');
    void flushProgress({ highlights: next });
  };

  const handleDeleteHighlight = (id: string) => {
    const next = highlights.filter((h) => h.id !== id);
    setHighlights(next);
    void flushProgress({ highlights: next });
  };

  // Annotation helpers
  const handleSaveAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    const body = noteBody.trim();
    if (!body) return;
    const now = new Date().toISOString();
    let next: ReaderAnnotation[];
    if (editingNoteId) {
      next = annotations.map((a) =>
        a.id === editingNoteId
          ? {
              ...a,
              title: noteTitle.trim() || undefined,
              content: body,
              updatedAt: now,
            }
          : a
      );
      setEditingNoteId(null);
    } else {
      const item: ReaderAnnotation = {
        id: `an_${Date.now()}`,
        page: currentPage,
        title: noteTitle.trim() || `Nota na página ${currentPage}`,
        content: body,
        createdAt: now,
        updatedAt: now,
      };
      next = [item, ...annotations];
    }
    setAnnotations(next);
    setNoteTitle('');
    setNoteBody('');
    void flushProgress({ annotations: next });
  };

  const handleDeleteAnnotation = (id: string) => {
    const next = annotations.filter((a) => a.id !== id);
    setAnnotations(next);
    if (editingNoteId === id) {
      setEditingNoteId(null);
      setNoteTitle('');
      setNoteBody('');
    }
    void flushProgress({ annotations: next });
  };

  const handleConnectDriveRetry = async () => {
    setConnectingDrive(true);
    try {
      const token = await connectGoogleWorkspace();
      if (token) {
        await loadDocument(token);
      }
    } finally {
      setConnectingDrive(false);
    }
  };

  // Touch swipe & pinch-to-zoom handlers for mobile/tablet
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    zoom.touchHandlers.onTouchStart(e);
    if (e.touches.length !== 1 || zoom.scale > 1.02) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    zoom.touchHandlers.onTouchMove(e);
    if (e.touches.length >= 2 || zoom.scale > 1.02) {
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    zoom.touchHandlers.onTouchEnd(e);
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (zoom.scale > 1.02 || zoom.wasPinchGesture()) return;
    if (!start || e.changedTouches.length !== 1) return;
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 2) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const handleViewportClick = (e: React.MouseEvent) => {
    if (!isFullscreen || zoom.scale > 1.02) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.pdf-text-layer')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    if (x < width * 0.3) {
      goPrev();
    } else if (x > width * 0.7) {
      goNext();
    }
  };

  const handleReadingTextMouseUp = () => {
    const sel = window.getSelection()?.toString().replace(/\s+/g, ' ').trim();
    if (sel && sel.length >= 4) {
      setSelectedQuote({ quote: sel.slice(0, 480), page: currentPage });
    }
  };

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === currentPage),
    [highlights, currentPage]
  );

  const progressPct = Math.max(1, Math.min(100, Math.round((currentPage / Math.max(1, numPages)) * 100)));

  // Target widths for PDF.js canvases (adaptam ao modo compacto e ampliado)
  const bookSingleTargetWidth = computePdfPageWidth({
    measuredWidth,
    isExpanded: expandedActive,
    mode: 'single',
  });
  const bookSpreadPageWidth = computePdfPageWidth({
    measuredWidth,
    isExpanded: expandedActive,
    mode: 'spread',
  });
  const originalTargetWidth = computePdfPageWidth({
    measuredWidth,
    isExpanded: expandedActive,
    mode: 'original',
  });

  const renderHighlightedBlockText = (text: string) => {
    const quotesOnPage = pageHighlights.map((h) => h.quote).filter((q) => q.length >= 4);
    const activeSearch = searchQuery.trim();
    const terms = [...quotesOnPage];
    if (activeSearch.length >= 2) terms.push(activeSearch);
    if (terms.length === 0) return text;

    const pattern = terms
      .sort((a, b) => b.length - a.length)
      .slice(0, 12)
      .map(escapeRegExp)
      .join('|');
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (!part) return null;
      const lowerPart = part.toLowerCase();
      const matchedHl = pageHighlights.find((h) => h.quote.toLowerCase() === lowerPart);
      if (matchedHl) {
        return (
          <mark
            key={idx}
            className={`px-0.5 rounded-xs ${HIGHLIGHT_SWATCHES[matchedHl.color].bg}`}
          >
            {part}
          </mark>
        );
      }
      if (activeSearch.length >= 2 && lowerPart === activeSearch.toLowerCase()) {
        return (
          <mark key={idx} className="px-0.5 rounded-xs bg-emerald-200 text-slate-950">
            {part}
          </mark>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const renderOutlineTree = (nodes: PdfOutlineNode[], depth = 0) => (
    <ul className={depth > 0 ? 'pl-3 mt-1 space-y-1 border-l border-slate-200/70' : 'space-y-1'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            disabled={!node.pageNumber}
            onClick={() => {
              if (node.pageNumber) {
                goToPage(node.pageNumber);
                if (!viewportSize.isDesktop) setPanelOpen(false);
              }
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
              node.pageNumber === currentPage
                ? 'bg-[#0B3321] text-white font-semibold'
                : 'hover:bg-slate-500/10 disabled:opacity-50'
            }`}
          >
            <span className="line-clamp-2">{node.title}</span>
            {node.pageNumber && (
              <span className="font-mono text-[10px] opacity-75 shrink-0 tabular-nums">
                p.{node.pageNumber}
              </span>
            )}
          </button>
          {node.children.length > 0 && renderOutlineTree(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={`px-3 pt-3 pb-2 border-b ${themeStyle.border} flex items-center justify-between gap-2`}>
        <div className="grid grid-cols-5 gap-1 flex-1">
          {(
            [
              { id: 'outline', label: 'Sumário', icon: ListTree },
              { id: 'bookmarks', label: 'Marc.', icon: Bookmark },
              { id: 'highlights', label: 'Dest.', icon: Highlighter },
              { id: 'annotations', label: 'Notas', icon: StickyNote },
              { id: 'search', label: 'Buscar', icon: Search },
            ] as const
          ).map((t) => {
            const TabIcon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                title={t.label}
                className={`min-h-[38px] px-1.5 py-1 rounded-lg text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'bg-[#0B3321] text-white'
                    : 'hover:bg-slate-500/10 opacity-80'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span className="truncate max-w-full">{t.label}</span>
              </button>
            );
          })}
        </div>
        {!viewportSize.isDesktop && (
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Fechar painel lateral"
            className="min-w-[38px] min-h-[38px] rounded-lg hover:bg-slate-500/10 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
        {activeTab === 'outline' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Sumário e Capítulos</p>
              <span className={`font-mono text-[11px] ${themeStyle.textMuted}`}>
                {numPages} págs.
              </span>
            </div>

            {material.chapters && material.chapters.length > 0 && (
              <div className="space-y-1.5">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${themeStyle.textMuted}`}>
                  Capítulos Organizados
                </p>
                <ul className="space-y-1">
                  {material.chapters.map((ch, idx) => {
                    const targetPage = typeof ch.startPage === 'number' && ch.startPage >= 1 ? ch.startPage : null;
                    return (
                      <li key={ch.id || idx}>
                        <button
                          type="button"
                          disabled={!targetPage}
                          onClick={() => {
                            if (targetPage) {
                              goToPage(targetPage);
                              if (!viewportSize.isDesktop) setPanelOpen(false);
                            }
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg border ${themeStyle.border} hover:bg-emerald-500/10 disabled:opacity-65 flex items-start justify-between gap-2 transition-colors`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{ch.title}</p>
                            {(ch.summary || ch.description) && (
                              <p className={`text-[11px] line-clamp-2 ${themeStyle.textMuted}`}>{ch.summary || ch.description}</p>
                            )}
                          </div>
                          {targetPage && (
                            <span className={`font-mono text-[10px] shrink-0 ${themeStyle.textMuted}`}>
                              p. {targetPage}
                              {ch.endPage && ch.endPage > targetPage ? `–${ch.endPage}` : ''}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {material.sections && material.sections.length > 0 && (
              <div className="space-y-1.5">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${themeStyle.textMuted}`}>
                  Seções do Edital
                </p>
                <ul className="space-y-1">
                  {material.sections.map((sec) => (
                    <li key={sec.id}>
                      <button
                        type="button"
                        onClick={() => {
                          goToPage(sec.startPage);
                          if (!viewportSize.isDesktop) setPanelOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border ${themeStyle.border} hover:bg-emerald-500/10 flex items-center justify-between gap-2 transition-colors`}
                      >
                        <span className="truncate font-medium">{sec.title}</span>
                        <span className={`font-mono text-[10px] shrink-0 ${themeStyle.textMuted}`}>
                          p. {sec.startPage}–{sec.endPage}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {outline.length > 0 ? (
              <div className="space-y-1.5">
                {(material.chapters?.length || material.sections?.length) ? (
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${themeStyle.textMuted}`}>
                    Índice Embutido do PDF
                  </p>
                ) : null}
                {renderOutlineTree(outline)}
              </div>
            ) : !material.chapters?.length && !material.sections?.length ? (
              <div className={`p-3 rounded-xl border ${themeStyle.border} ${themeStyle.textMuted} space-y-1.5`}>
                <p className="font-medium">Este PDF não possui sumário embutido.</p>
                <p>Use a navegação por páginas, os marcadores ou a busca de texto para localizar capítulos.</p>
              </div>
            ) : null}

            {material.studyRecommendations && material.studyRecommendations.length > 0 && (
              <div className={`p-3 rounded-xl border ${themeStyle.border} space-y-1.5`}>
                <p className="font-semibold">Recomendações de Estudo</p>
                <ul className={`list-disc pl-4 space-y-1 text-[11px] ${themeStyle.textMuted}`}>
                  {material.studyRecommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            <form onSubmit={handleAddCustomBookmark} className="space-y-2">
              <label className="block font-semibold">Marcar página {currentPage}</label>
              <div className="flex gap-1.5">
                <input
                  value={bookmarkLabel}
                  onChange={(e) => setBookmarkLabel(e.target.value)}
                  placeholder={`Ex.: Art. 37 · Página ${currentPage}`}
                  className={`flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs bg-transparent ${themeStyle.border}`}
                />
                <button
                  type="submit"
                  className="min-h-[38px] px-3 bg-[#0B3321] text-white font-semibold rounded-lg shrink-0"
                >
                  Salvar
                </button>
              </div>
            </form>

            {bookmarks.length === 0 ? (
              <p className={themeStyle.textMuted}>
                Nenhum marcador salvo neste material ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className={`p-2.5 rounded-xl border ${themeStyle.border} flex items-center justify-between gap-2`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        goToPage(bm.page);
                        if (!viewportSize.isDesktop) setPanelOpen(false);
                      }}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="font-semibold truncate">{bm.label}</p>
                      <p className={`text-[11px] font-mono ${themeStyle.textMuted}`}>
                        Página {bm.page}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBookmark(bm.id)}
                      aria-label="Remover marcador"
                      className="min-w-[34px] min-h-[34px] rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'highlights' && (
          <div className="space-y-3">
            <p className={themeStyle.textMuted}>
              Selecione qualquer trecho no Modo Leitura ou PDF Original para salvar um destaque colorido.
            </p>
            {highlights.length === 0 ? (
              <p className={themeStyle.textMuted}>Nenhum trecho destacado neste material.</p>
            ) : (
              <div className="space-y-2.5">
                {highlights.map((hl) => {
                  const swatch = HIGHLIGHT_SWATCHES[hl.color];
                  return (
                    <div
                      key={hl.id}
                      className={`p-3 rounded-xl border ${swatch.border} ${swatch.bg} space-y-1.5`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            goToPage(hl.page);
                            if (!viewportSize.isDesktop) setPanelOpen(false);
                          }}
                          className="font-mono text-[11px] font-bold underline"
                        >
                          Página {hl.page}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHighlight(hl.id)}
                          aria-label="Excluir destaque"
                          className="p-1 rounded hover:bg-black/10 text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed">“{hl.quote}”</p>
                      {hl.note && (
                        <p className="text-[11px] opacity-85 pt-1 border-t border-black/10">
                          Nota: {hl.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'annotations' && (
          <div className="space-y-3">
            <form onSubmit={handleSaveAnnotation} className="space-y-2">
              <p className="font-semibold">
                {editingNoteId ? 'Editar anotação' : `Nova anotação · Página ${currentPage}`}
              </p>
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Título curto (opcional)"
                className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs bg-transparent ${themeStyle.border}`}
              />
              <textarea
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Registre artigos-chave, pegadinhas CETAP ou resumos desta página..."
                className={`w-full px-2.5 py-2 rounded-lg border text-xs bg-transparent ${themeStyle.border}`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="min-h-[38px] px-3.5 bg-[#0B3321] text-white font-semibold rounded-lg"
                >
                  {editingNoteId ? 'Atualizar nota' : 'Salvar anotação'}
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteTitle('');
                      setNoteBody('');
                    }}
                    className="min-h-[38px] px-3 border rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {annotations.length === 0 ? (
              <p className={themeStyle.textMuted}>Nenhuma anotação registrada neste livro ainda.</p>
            ) : (
              <div className="space-y-2">
                {annotations.map((an) => (
                  <div key={an.id} className={`p-3 rounded-xl border ${themeStyle.border} space-y-1.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          goToPage(an.page);
                          if (!viewportSize.isDesktop) setPanelOpen(false);
                        }}
                        className="font-semibold text-left hover:underline"
                      >
                        {an.title || `Página ${an.page}`} ·{' '}
                        <span className="font-mono text-[11px]">p.{an.page}</span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(an.id);
                            setNoteTitle(an.title || '');
                            setNoteBody(an.content);
                          }}
                          className="px-2 py-1 rounded hover:bg-slate-500/10 text-[11px] font-medium"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnotation(an.id)}
                          aria-label="Excluir anotação"
                          className="p-1 rounded hover:bg-red-500/10 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{an.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(searchQuery);
              }}
              className="flex gap-1.5"
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite a palavra para buscar..."
                className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border text-xs bg-transparent ${themeStyle.border}`}
              />
              <button
                type="submit"
                disabled={searching || searchQuery.trim().length < 2}
                className="min-h-[38px] px-3 bg-[#0B3321] text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {searching ? '...' : 'Buscar'}
              </button>
            </form>

            {searchQuery.trim().length >= 2 && !searching && (
              <div className="px-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>
                  {searchHits.length > 0
                    ? `Encontradas ${totalMatchCount} ${totalMatchCount === 1 ? 'ocorrência' : 'ocorrências'} em ${searchHits.length} ${searchHits.length === 1 ? 'página' : 'páginas'}`
                    : `Nenhuma ocorrência encontrada`}
                </span>
                {searchHits.length > 0 && (
                  <span className="text-[10px] text-slate-400">Clique para ir à página</span>
                )}
              </div>
            )}

            {searching ? (
              <div className="py-4 flex items-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#146C43]" />
                <span>Buscando nas páginas do documento...</span>
              </div>
            ) : searchQuery.trim().length >= 2 && searchHits.length === 0 ? (
              <p className={themeStyle.textMuted}>
                Nenhuma ocorrência encontrada para “{searchQuery}”.
              </p>
            ) : (
              <div className="space-y-2">
                {searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      goToPage(hit.pageNumber);
                      if (!structuredBook) {
                        setReadingMode('reading');
                      }
                      if (!viewportSize.isDesktop) setPanelOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border ${themeStyle.border} hover:border-[#146C43] hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors space-y-1.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        Palavra: "{searchQuery}"
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#146C43] dark:text-emerald-400">
                        Página {hit.pageNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>
                        {hit.matchCount} {hit.matchCount === 1 ? 'ocorrência nesta página' : 'ocorrências nesta página'}
                      </span>
                      <span className="text-[#146C43] dark:text-emerald-400 font-semibold underline">Ir para a página &rarr;</span>
                    </div>
                    <p className="text-[11px] leading-relaxed line-clamp-3 text-slate-700 dark:text-slate-300 font-sans">
                      {hit.snippet}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !expandedActive && !selectedQuote && !cleanReading) {
          void handleRequestClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all ${
        expandedActive
          ? 'p-0 bg-black/85'
          : 'p-2 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-xs'
      }`}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Leitor Digital · ${material.title}`}
        data-reader-mode={expandedActive ? 'expanded' : 'compact'}
        className={`flex flex-col overflow-hidden transition-all ${themeStyle.shellBg} ${themeStyle.textMain} ${
          expandedActive
            ? 'w-full h-full max-w-none rounded-none border-0'
            : `w-full max-w-5xl h-[min(88dvh,760px)] rounded-2xl border shadow-2xl ${themeStyle.border}`
        }`}
      >
      {/* Floating Clean Reading Exit & Quick Nav Bar */}
      {cleanReading && (
        <div
          className={`fixed top-3 right-3 left-3 sm:left-auto z-50 border rounded-2xl px-3 py-2 shadow-lg flex flex-wrap items-center justify-between sm:justify-end gap-2 ${themeStyle.headerBg}`}
          style={{
            marginTop: 'max(0px, env(safe-area-inset-top, 0px))',
            marginRight: 'max(0px, env(safe-area-inset-right, 0px))',
          }}
        >
          <span className={`font-mono text-xs font-semibold tabular-nums ${themeStyle.textMuted}`}>
            {structuredBook ? `Cap. ${currentPage}/${numPages}` : `Pág. ${currentPage}/${numPages}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={goPrev}
              aria-label="Página anterior"
              className="min-h-[36px] min-w-[36px] rounded-lg border border-current/15 disabled:opacity-40 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={goNext}
              aria-label="Próxima página"
              className="min-h-[36px] min-w-[36px] rounded-lg border border-current/15 disabled:opacity-40 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === 'paper' ? 'sepia' : prev === 'sepia' ? 'night' : 'paper'))
              }
              title={`Tema atual: ${themeStyle.label}`}
              aria-label="Alternar tema de leitura"
              className="min-h-[36px] min-w-[36px] rounded-lg border border-current/15 flex items-center justify-center"
            >
              {theme === 'night' ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setCleanReading(false)}
              className="min-h-[36px] px-3 rounded-lg bg-[#0B3321] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <span>Sair da leitura limpa</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRequestClose()}
              aria-label="Fechar leitor"
              title="Fechar leitor"
              className="min-h-[36px] min-w-[36px] rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Compact Toolbar */}
      {!cleanReading && (
        <header className={`border-b px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 ${themeStyle.headerBg}`}>
        <div className="flex items-center gap-2 min-w-0 max-w-full sm:max-w-[34%]">
          <button
            type="button"
            onClick={() => void handleRequestClose()}
            aria-label="Fechar leitor"
            className="min-w-[36px] min-h-[36px] rounded-xl border border-current/15 hover:bg-slate-500/10 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold truncate">{material.title}</h2>
            <p className={`text-[11px] truncate ${themeStyle.textMuted}`}>
              {material.disciplineId ? `${getDisciplineShortName(material.disciplineId)} · ` : ''}
              {structuredBook
                ? `${structuredBook.sourceKind === 'epub' ? 'EPUB' : 'Portal Oficial'} · ${structuredBook.author || material.institution || 'Acervo ALEPA'}`
                : material.isVirtualSection && material.startPage && material.endPage
                  ? `Seção Virtual · Págs. ${material.startPage}–${material.endPage}`
                  : material.institution || 'Acervo ALEPA'}
              {material.version ? ` · v${material.version}` : ''}
              {fileSizeBytes ? ` · ${formatBytes(fileSizeBytes)}` : ''}
              {!allowDownload ? ' · Somente leitura' : ''}
            </p>
          </div>
        </div>

        {/* Reading Modes */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-500/10 shrink-0">
          {(structuredBook
            ? ([
                { id: 'reading', label: 'Leitura', icon: Type },
                { id: 'book', label: 'Livro', icon: BookOpen },
              ] as const)
            : ([
                { id: 'book', label: 'Livro', icon: BookOpen },
                { id: 'reading', label: 'Leitura', icon: Type },
                { id: 'original', label: 'PDF Original', icon: FileText },
              ] as const)
          ).map((m) => {
            const ModeIcon = m.icon;
            const active = readingMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setReadingMode(m.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active ? 'bg-[#0B3321] text-white shadow-2xs' : 'hover:bg-slate-500/10'
                }`}
              >
                <ModeIcon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Utility Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Theme switch */}
          <button
            type="button"
            onClick={() =>
              setTheme((prev) => (prev === 'paper' ? 'sepia' : prev === 'sepia' ? 'night' : 'paper'))
            }
            title={`Tema atual: ${themeStyle.label}. Clique para alternar`}
            className="min-h-[40px] px-2.5 rounded-xl border border-current/15 hover:bg-slate-500/10 text-xs font-medium inline-flex items-center gap-1.5"
          >
            {theme === 'night' ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4" />}
            <span className="hidden md:inline">{themeStyle.label}</span>
          </button>

          {/* Clean Reading toggle */}
          <button
            type="button"
            onClick={() => {
              setCleanReading(true);
              setPanelOpen(false);
              if (!structuredBook && readingMode === 'original') {
                setReadingMode('reading');
              }
            }}
            title="Ativar modo leitura limpa (sem distrações)"
            className="min-h-[40px] px-2.5 rounded-xl border border-current/15 hover:bg-slate-500/10 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden xl:inline">Leitura limpa</span>
          </button>

          {/* Bookmark quick toggle */}
          <button
            type="button"
            onClick={handleToggleQuickBookmark}
            title={currentPageBookmarks.length > 0 ? 'Remover marcador desta página' : 'Marcar esta página'}
            className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
              currentPageBookmarks.length > 0
                ? 'border-[#146C43] bg-[#0B3321] text-white'
                : 'border-current/15 hover:bg-slate-500/10'
            }`}
          >
            {currentPageBookmarks.length > 0 ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          {/* Search shortcut */}
          <button
            type="button"
            onClick={() => {
              setPanelOpen(true);
              setActiveTab('search');
            }}
            title="Buscar no documento"
            className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-current/15 hover:bg-slate-500/10 inline-flex items-center justify-center"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Tools / Outline Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            title="Sumário, marcadores, destaques e notas"
            className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
              panelOpen
                ? 'border-[#0B3321] bg-[#0B3321] text-white'
                : 'border-current/15 hover:bg-slate-500/10'
            }`}
          >
            <PanelLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Ferramentas</span>
          </button>

          {/* Hide/Show Mode & Zoom Bar */}
          <button
            type="button"
            onClick={toggleHideAllToolbars}
            title={hideAllToolbars ? 'Expandir barra de ferramentas e zoom' : 'Recolher barra de ferramentas e zoom'}
            aria-label={hideAllToolbars ? 'Expandir barra de ferramentas e zoom' : 'Recolher barra de ferramentas e zoom'}
            className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 ${
              hideAllToolbars
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-current/15 hover:bg-slate-500/10'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden xl:inline">{hideAllToolbars ? 'Expandir barras' : 'Recolher barras'}</span>
          </button>

          {/* Expand / Collapse Reader Mode */}
          <button
            type="button"
            onClick={() => void handleToggleExpand()}
            title={expandedActive ? 'Recolher para o modo compacto' : 'Ampliar área de leitura'}
            aria-label={expandedActive ? 'Recolher para o modo compacto' : 'Ampliar área de leitura'}
            aria-expanded={expandedActive}
            className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              expandedActive
                ? 'border-[#146C43] bg-[#0B3321] text-white'
                : 'border-current/15 hover:bg-slate-500/10'
            }`}
          >
            {expandedActive ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{expandedActive ? 'Recolher' : 'Ampliar'}</span>
          </button>

          {/* Gemini summary */}
          {onSummarizeWithGemini && (
            <button
              type="button"
              onClick={() => {
                void handleRequestClose().then(() =>
                  onSummarizeWithGemini({
                    mode: 'pdf',
                    materialId: material.id,
                    url: material.url,
                    title: material.title,
                    disciplineId: material.disciplineId,
                  })
                );
              }}
              className="min-h-[36px] px-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden md:inline">Resumo IA</span>
            </button>
          )}

          {/* Download & Open Original (ONLY when allowDownload !== false) */}
          {allowDownload ? (
            <>
              {downloadBlobUrl && (
                <a
                  href={downloadBlobUrl}
                  download={resolvedFileName || (structuredBook?.sourceKind === 'epub' ? 'material.epub' : 'material.pdf')}
                  title="Baixar arquivo original"
                  className="min-h-[36px] px-2.5 rounded-xl border border-current/15 hover:bg-slate-500/10 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden lg:inline">Baixar</span>
                </a>
              )}
              {!material.url.startsWith('local://') && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir fonte original em nova aba"
                  className="min-h-[36px] min-w-[36px] px-2 rounded-xl border border-current/15 hover:bg-slate-500/10 text-xs font-medium inline-flex items-center justify-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </>
          ) : (
            <span
              title="Download desabilitado pelo administrador"
              className={`min-h-[36px] px-2.5 rounded-xl border ${themeStyle.border} text-[11px] font-medium inline-flex items-center gap-1 opacity-75`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Protegido</span>
            </span>
          )}
          </div>
      </header>
      )}

      {/* Secondary Mode-Specific Compact Controls Bar */}
      {!cleanReading && !loadingDoc && !loadError && !drivePreviewId && !hideAllToolbars && (
        <div className={`border-b px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs ${themeStyle.headerBg}`}>
          {readingMode === 'book' && !structuredBook && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-[11px] ${themeStyle.textMuted}`}>
                Modo Livro · Navegue pelas setas ou deslize no celular
              </span>
              {viewportSize.isTabletOrDesktop && numPages > 1 && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-500/10">
                  <button
                    type="button"
                    onClick={() => setBookSpread('single')}
                    className={`min-h-[28px] px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                      !useTwoPageSpread ? 'bg-[#0B3321] text-white' : ''
                    }`}
                  >
                    <Square className="w-3 h-3" />
                    <span>1 Página</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookSpread('double')}
                    className={`min-h-[28px] px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                      useTwoPageSpread ? 'bg-[#0B3321] text-white' : ''
                    }`}
                  >
                    <Columns2 className="w-3 h-3" />
                    <span>2 Páginas</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {readingMode === 'original' && !structuredBook && (
            <span className={`text-[11px] ${themeStyle.textMuted}`}>
              PDF Original · Ctrl + roda do mouse ou pinça para zoom
            </span>
          )}

          {(readingMode === 'reading' || Boolean(structuredBook)) && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className={themeStyle.textMuted}>Fonte:</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                  aria-label="Diminuir fonte"
                  className="min-w-[34px] min-h-[34px] rounded-lg border border-current/15 flex items-center justify-center"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono w-9 text-center tabular-nums">{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                  aria-label="Aumentar fonte"
                  className="min-w-[34px] min-h-[34px] rounded-lg border border-current/15 flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className={themeStyle.textMuted}>Espaço:</span>
                {(
                  [
                    { label: 'Compacto', val: 1.45 },
                    { label: 'Conforto', val: 1.65 },
                    { label: 'Amplo', val: 1.9 },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setLineHeight(opt.val)}
                    className={`min-h-[32px] px-2 rounded-lg text-[11px] font-medium ${
                      Math.abs(lineHeight - opt.val) < 0.08
                        ? 'bg-[#0B3321] text-white'
                        : 'border border-current/15'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-1">
                <span className={themeStyle.textMuted}>Largura:</span>
                {(
                  [
                    { label: 'Estreita', val: 56 },
                    { label: 'Padrão', val: 68 },
                    { label: 'Larga', val: 82 },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setMaxWidthCh(opt.val)}
                    className={`min-h-[32px] px-2 rounded-lg text-[11px] font-medium ${
                      maxWidthCh === opt.val
                        ? 'bg-[#0B3321] text-white'
                        : 'border border-current/15'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(readingMode === 'original' || readingMode === 'book') && !structuredBook && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto" role="group" aria-label="Controles de zoom do PDF">
              <span className={`text-[11px] font-medium ${themeStyle.textMuted}`}>Zoom:</span>
              {PDF_ZOOM_PRESETS.map((preset) => {
                const active =
                  preset.value === 0
                    ? zoomScale === 0 && zoom.scale <= 1.02
                    : Math.abs(zoomScale - preset.value) < 0.03 && zoom.scale <= 1.02;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyZoomPreset(preset.value)}
                    aria-pressed={active}
                    className={`min-h-[30px] px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                      preset.value > 0 ? 'font-mono tabular-nums' : ''
                    } ${
                      active
                        ? 'bg-[#0B3321] text-white'
                        : 'border border-current/15 hover:bg-slate-500/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => applyZoomStep(-PDF_ZOOM_STEP)}
                disabled={zoomScale > 0 && zoomScale <= MIN_PDF_ZOOM + 0.01 && zoom.scale <= 1.02}
                title="Diminuir zoom (−)"
                aria-label="Diminuir zoom"
                className="min-w-[30px] min-h-[30px] rounded-lg border border-current/15 hover:bg-slate-500/10 disabled:opacity-40 flex items-center justify-center"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyZoomStep(PDF_ZOOM_STEP)}
                disabled={zoomScale >= MAX_PDF_ZOOM - 0.01}
                title="Aumentar zoom (+)"
                aria-label="Aumentar zoom"
                className="min-w-[30px] min-h-[30px] rounded-lg border border-current/15 hover:bg-slate-500/10 disabled:opacity-40 flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {(zoom.scale > 1.02 ||
                (zoomScale !== 0 &&
                  !PDF_ZOOM_PRESETS.some((p) => p.value > 0 && Math.abs(p.value - zoomScale) < 0.03))) && (
                <span className={`font-mono text-[11px] tabular-nums px-1 ${themeStyle.textMuted}`}>
                  {zoom.scale > 1.02
                    ? `${Math.round(zoom.scale * 100)}%`
                    : formatZoomBadge(zoomScale)}
                </span>
              )}
            </div>
          )}

          <div className={`hidden xl:flex items-center gap-1.5 text-[11px] ${themeStyle.textMuted}`}>
            <History className="w-3.5 h-3.5" />
            <span>
              {saveStatus === 'saving'
                ? 'Salvando progresso...'
                : saveStatus === 'saved'
                  ? 'Progresso sincronizado'
                  : saveStatus === 'error'
                    ? 'Salvo localmente'
                    : 'Leitura pronta'}
            </span>
          </div>
        </div>
      )}

      {/* Selection Floating Highlight Bar */}
      {selectedQuote && (
        <div className={`border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${themeStyle.panelBg}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#146C43]">
              Trecho selecionado (p. {selectedQuote.page}):
            </p>
            <p className="text-xs truncate opacity-90">“{selectedQuote.quote}”</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setHighlightColor(c)}
                aria-label={`Cor ${HIGHLIGHT_SWATCHES[c].label}`}
                className={`w-6 h-6 rounded-full ${HIGHLIGHT_SWATCHES[c].dot} ${
                  highlightColor === c ? 'ring-2 ring-offset-2 ring-[#0B3321]' : ''
                }`}
              />
            ))}
            <input
              value={highlightNote}
              onChange={(e) => setHighlightNote(e.target.value)}
              placeholder="Nota opcional..."
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs bg-transparent w-36 sm:w-48 ${themeStyle.border}`}
            />
            <button
              type="button"
              onClick={handleSaveHighlight}
              className="min-h-[34px] px-3 bg-[#0B3321] text-white text-xs font-semibold rounded-lg"
            >
              Destacar trecho
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuote(null)}
              className="min-h-[34px] px-2.5 text-xs rounded-lg hover:bg-slate-500/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Reader Body: Optional Sidebar + Document Stage */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Desktop Sidebar */}
        {panelOpen && !cleanReading && viewportSize.isDesktop && (
          <aside className={`w-80 shrink-0 border-r h-full overflow-hidden ${themeStyle.panelBg}`}>
            {sidebarContent}
          </aside>
        )}

        {/* Mobile / Tablet Slide-over Drawer */}
        {panelOpen && !viewportSize.isDesktop && (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              aria-label="Fechar ferramentas"
              onClick={() => setPanelOpen(false)}
              className="flex-1 bg-black/45"
            />
            <aside className={`w-80 max-w-[88vw] h-full border-l shadow-2xl overflow-hidden ${themeStyle.panelBg}`}>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Reading Canvas / Stage */}
        <div
          ref={viewportAreaRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            zoom.touchHandlers.onTouchCancel();
            touchStartRef.current = null;
          }}
          onClick={handleViewportClick}
          onContextMenu={allowDownload ? undefined : (e) => e.preventDefault()}
          className={`flex-1 min-w-0 overflow-auto p-3 sm:p-5 pdf-zoom-stage pinch-zoom-surface ${themeStyle.surfaceBg}`}
        >
          <div
            style={zoom.transformStyle}
            className={`zoom-transform-stage pdf-zoom-stage pinch-zoom-surface min-w-full w-fit min-h-full mx-auto flex flex-col items-center justify-center ${
              zoom.scale > 1.02 ? 'cursor-grab active:cursor-grabbing' : ''
            } ${zoom.isGesturing ? 'is-gesturing' : ''}`}
          >
          {loadingDoc ? (
            <div className="my-auto flex flex-col items-center gap-3 text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#146C43]" />
              <p className="font-display text-base font-bold">Abrindo livro digital...</p>
              <p className={`text-xs max-w-sm ${themeStyle.textMuted}`}>
                Carregando estrutura, sumário e páginas progressivamente.
              </p>
            </div>
          ) : drivePreviewId ? (
            <div className={`my-auto max-w-4xl w-full h-[78vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${themeStyle.pageCard}`}>
              <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
                <span className="font-medium">O arquivo precisa estar compartilhado como 'qualquer pessoa com o link'. Este modo não salva progresso.</span>
                <a href={material.url} target="_blank" rel="noopener noreferrer" className="font-bold underline shrink-0 inline-flex items-center gap-1">
                  <span>Abrir no Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <iframe
                src={`https://drive.google.com/file/d/${drivePreviewId}/preview`}
                className="w-full flex-1 border-0 bg-white"
                allow="autoplay"
                title={material.title}
              />
            </div>
          ) : loadError ? (
            <div className={`my-auto max-w-lg w-full rounded-2xl border p-6 text-center space-y-4 ${themeStyle.pageCard}`}>
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <div className="space-y-1.5">
                <h3 className="font-display text-lg font-bold">Não foi possível abrir este arquivo diretamente</h3>
                <p className={`text-sm leading-relaxed ${themeStyle.textMuted}`}>
                  {errorCode === 'LOCAL_MISSING'
                    ? 'O arquivo local não foi encontrado ou está inacessível no armazenamento.'
                    : errorCode === 'AUTH_REQUIRED'
                      ? 'Acesso restrito ou credenciais do Google Workspace necessárias. Conecte sua conta para abrir arquivos protegidos.'
                      : errorCode === 'TOO_LARGE'
                        ? 'O arquivo excede o limite suportado para abertura direta no leitor.'
                        : errorCode === 'HTML_PORTAL'
                          ? 'Este endereço corresponde a um portal web oficial ou página de notícias. Utilize o botão para abrir externamente.'
                          : loadError || 'Não foi possível carregar este documento no leitor integrado.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {errorCode === 'AUTH_REQUIRED' && (
                  <button
                    type="button"
                    disabled={connectingDrive}
                    onClick={() => void handleConnectDriveRetry()}
                    className="min-h-[44px] px-4 py-2 bg-[#0B3321] text-white text-xs font-semibold rounded-xl"
                  >
                    {connectingDrive ? 'Conectando Google Drive...' : 'Conectar Google Drive'}
                  </button>
                )}
                {errorCode !== 'LOCAL_MISSING' && (
                  <button
                    type="button"
                    onClick={() => void loadDocument()}
                    className="min-h-[44px] px-4 py-2 bg-[#0B3321] hover:bg-[#134b32] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar novamente</span>
                  </button>
                )}
                {material.url && !material.url.startsWith('local://') && (
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 py-2 bg-[#146C43] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <span>Abrir no site</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void handleRequestClose()}
                  className="min-h-[44px] px-4 py-2 border border-current/20 text-xs font-semibold rounded-xl"
                >
                  Voltar ao tópico
                </button>
              </div>
            </div>
          ) : structuredBook ? (
            <div
              onMouseUp={handleReadingTextMouseUp}
              style={{ maxWidth: `${maxWidthCh}ch` }}
              className={`w-full rounded-2xl border p-5 sm:p-10 space-y-5 ${cleanReading ? 'my-10 shadow-xl' : ''} ${themeStyle.pageCard}`}
            >
              <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${themeStyle.border} text-xs ${themeStyle.textMuted}`}>
                <span className="font-semibold truncate">
                  {structuredBook.units[currentPage - 1]?.title || structuredBook.title}
                </span>
                <span className="font-mono tabular-nums shrink-0">
                  {structuredBook.sourceKind === 'epub' ? 'Capítulo' : 'Seção'} {currentPage} de {numPages}
                </span>
              </div>

              {structuredBook.units[currentPage - 1] ? (
                <article
                  style={{ fontSize: `${fontSize}px`, lineHeight }}
                  className="space-y-4 select-text"
                >
                  {structuredBook.units[currentPage - 1].blocks.map((block) => {
                    if (block.kind === 'heading') {
                      return (
                        <h3 key={block.id} className="font-display text-[1.25em] font-bold pt-2">
                          {renderHighlightedBlockText(block.text)}
                        </h3>
                      );
                    }
                    if (block.kind === 'subheading') {
                      return (
                        <h4 key={block.id} className="font-display text-[1.1em] font-semibold pt-1">
                          {renderHighlightedBlockText(block.text)}
                        </h4>
                      );
                    }
                    if (block.kind === 'list_item') {
                      return (
                        <p key={block.id} className="pl-4">
                          {renderHighlightedBlockText(block.text)}
                        </p>
                      );
                    }
                    return (
                      <p key={block.id} className="text-pretty">
                        {renderHighlightedBlockText(block.text)}
                      </p>
                    );
                  })}
                </article>
              ) : (
                <p className={`text-sm ${themeStyle.textMuted}`}>Seção vazia.</p>
              )}
            </div>
          ) : !pdfDoc ? null : readingMode === 'book' ? (
            <div className="my-auto flex flex-col items-center gap-4 shrink-0">
              {useTwoPageSpread ? (
                <div className="flex items-stretch justify-center gap-1 bg-slate-900/10 p-2 sm:p-3 rounded-2xl shadow-xl shrink-0">
                  <div className={`rounded-l-xl overflow-hidden border shrink-0 ${themeStyle.border}`}>
                    <PdfCanvasSheet
                      pdfDoc={pdfDoc}
                      pageNumber={currentPage}
                      targetWidth={bookSpreadPageWidth}
                      scaleOverride={zoomScale > 0 ? zoomScale : undefined}
                      zoomRender={renderZoom}
                      theme={theme}
                      allowDownload={allowDownload}
                      onScaleResolved={handleSheetScaleResolved}
                      onLayoutChanged={handleSheetLayoutChanged}
                      onTextSelected={(quote, p) => setSelectedQuote({ quote, page: p })}
                    />
                  </div>
                  <div className="w-1.5 bg-gradient-to-r from-black/20 via-black/5 to-black/20 rounded-full shrink-0" />
                  {currentPage + 1 <= numPages ? (
                    <div className={`rounded-r-xl overflow-hidden border shrink-0 ${themeStyle.border}`}>
                      <PdfCanvasSheet
                        pdfDoc={pdfDoc}
                        pageNumber={currentPage + 1}
                        targetWidth={bookSpreadPageWidth}
                        scaleOverride={zoomScale > 0 ? zoomScale : undefined}
                        zoomRender={renderZoom}
                        theme={theme}
                        allowDownload={allowDownload}
                        onLayoutChanged={handleSheetLayoutChanged}
                        onTextSelected={(quote, p) => setSelectedQuote({ quote, page: p })}
                      />
                    </div>
                  ) : (
                    <div
                      style={{ width: bookSpreadPageWidth }}
                      className={`rounded-r-xl border shrink-0 flex flex-col items-center justify-center p-8 text-center ${themeStyle.pageCard}`}
                    >
                      <BookOpen className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-xs font-semibold">Fim do documento</p>
                      <p className={`text-[11px] mt-1 ${themeStyle.textMuted}`}>
                        Página {numPages} de {numPages}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`rounded-xl overflow-hidden border shadow-xl shrink-0 ${themeStyle.border}`}>
                  <PdfCanvasSheet
                    pdfDoc={pdfDoc}
                    pageNumber={currentPage}
                    targetWidth={bookSingleTargetWidth}
                    scaleOverride={zoomScale > 0 ? zoomScale : undefined}
                    zoomRender={renderZoom}
                    theme={theme}
                    allowDownload={allowDownload}
                    onScaleResolved={handleSheetScaleResolved}
                    onLayoutChanged={handleSheetLayoutChanged}
                    onTextSelected={(quote, p) => setSelectedQuote({ quote, page: p })}
                  />
                </div>
              )}
            </div>
          ) : readingMode === 'reading' ? (
            <div
              onMouseUp={handleReadingTextMouseUp}
              style={{ maxWidth: `${maxWidthCh}ch` }}
              className={`w-full rounded-2xl border p-5 sm:p-9 space-y-5 ${cleanReading ? 'my-10 shadow-xl' : ''} ${themeStyle.pageCard}`}
            >
              <div className={`flex items-center justify-between gap-2 pb-3 border-b ${themeStyle.border} text-xs ${themeStyle.textMuted}`}>
                <span className="font-semibold">Modo Leitura Adaptável</span>
                <span className="font-mono tabular-nums">
                  Página {currentPage} de {numPages}
                </span>
              </div>

              {loadingReadingPage ? (
                <div className="py-12 flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-[#146C43]" />
                  <span>Extraindo texto desta página...</span>
                </div>
              ) : readingContent?.isLikelyScanned ? (
                <div className={`rounded-xl border p-5 space-y-3 ${themeStyle.border} bg-amber-500/10`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold">
                        Esta página parece ser digitalizada (imagem sem camada de texto)
                      </p>
                      <p className="text-xs leading-relaxed opacity-85">
                        A reorganização automática de texto requer PDF com texto selecionável. Você pode ler
                        esta página perfeitamente no Modo Livro ou no Modo PDF Original com zoom.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReadingMode('book')}
                      className="min-h-[38px] px-3.5 bg-[#0B3321] text-white text-xs font-semibold rounded-lg"
                    >
                      Abrir no Modo Livro
                    </button>
                    <button
                      type="button"
                      onClick={() => setReadingMode('original')}
                      className="min-h-[38px] px-3.5 border border-current/20 text-xs font-semibold rounded-lg"
                    >
                      Abrir PDF Original
                    </button>
                  </div>
                </div>
              ) : readingContent && readingContent.blocks.length > 0 ? (
                <article
                  style={{ fontSize: `${fontSize}px`, lineHeight }}
                  className="space-y-4 select-text"
                >
                  {readingContent.blocks.map((block) => {
                    if (block.kind === 'heading') {
                      return (
                        <h3 key={block.id} className="font-display text-[1.25em] font-bold pt-2">
                          {renderHighlightedBlockText(block.text)}
                        </h3>
                      );
                    }
                    if (block.kind === 'subheading') {
                      return (
                        <h4 key={block.id} className="font-display text-[1.1em] font-semibold pt-1">
                          {renderHighlightedBlockText(block.text)}
                        </h4>
                      );
                    }
                    if (block.kind === 'list_item') {
                      return (
                        <p key={block.id} className="pl-4">
                          {renderHighlightedBlockText(block.text)}
                        </p>
                      );
                    }
                    return (
                      <p key={block.id} className="text-pretty">
                        {renderHighlightedBlockText(block.text)}
                      </p>
                    );
                  })}
                </article>
              ) : (
                <p className={`text-sm ${themeStyle.textMuted}`}>
                  Não há texto extraível nesta página. Alterne para o Modo PDF Original para visualizar gráficos ou imagens.
                </p>
              )}
            </div>
          ) : (
            <div className={`rounded-xl overflow-hidden border shadow-xl shrink-0 ${themeStyle.border}`}>
              <PdfCanvasSheet
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                targetWidth={originalTargetWidth}
                scaleOverride={zoomScale > 0 ? zoomScale : undefined}
                zoomRender={renderZoom}
                theme={theme}
                allowDownload={allowDownload}
                onScaleResolved={handleSheetScaleResolved}
                onLayoutChanged={handleSheetLayoutChanged}
                onTextSelected={(quote, p) => setSelectedQuote({ quote, page: p })}
              />
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation & Progress Footer */}
      {!cleanReading && !loadingDoc && !loadError && (pdfDoc || structuredBook) && (
        <footer className={`border-t px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 ${themeStyle.headerBg}`}>
          {(!isFullscreen && !expandedActive) && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={goPrev}
                className="min-h-[44px] sm:min-h-[38px] px-3 rounded-xl border border-current/15 hover:bg-slate-500/10 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <button
                type="button"
                disabled={currentPage + (useTwoPageSpread ? 1 : 0) >= numPages}
                onClick={goNext}
                className="min-h-[44px] sm:min-h-[38px] px-3 rounded-xl bg-[#0B3321] text-white disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex-1 min-w-[160px] max-w-md flex items-center gap-3">
            <input
              type="range"
              aria-label="Navegar pelas páginas"
              min={1}
              max={Math.max(1, numPages)}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="w-full accent-[#146C43] cursor-pointer"
            />
            <span className="font-mono text-xs font-semibold tabular-nums shrink-0">
              {progressPct}%
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(pageInput);
              if (Number.isFinite(parsed)) goToPage(parsed);
            }}
            className="flex items-center gap-1.5 text-xs"
          >
            <span className={themeStyle.textMuted}>Pág.</span>
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const parsed = Number(pageInput);
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= numPages) {
                  goToPage(parsed);
                } else {
                  setPageInput(String(currentPage));
                }
              }}
              aria-label="Ir para página"
              className={`w-14 min-h-[38px] px-2 text-center font-mono rounded-lg border bg-transparent ${themeStyle.border}`}
            />
            <span className={`font-mono ${themeStyle.textMuted}`}>/ {numPages}</span>
          </form>
        </footer>
      )}

      {/* Floating Zoom & Expand Controls (only when secondary toolbar is collapsed) */}
      {hideAllToolbars && !cleanReading && (
        <div className="fixed bottom-16 right-4 z-55 pointer-events-none flex justify-end pb-safe">
          <div className="pointer-events-auto">
            <FullscreenZoomToolbar
              scale={zoomScale > 0 ? zoomScale : zoom.scale}
              minScale={MIN_PDF_ZOOM}
              maxScale={MAX_PDF_ZOOM}
              isFullscreen={expandedActive}
              onZoomOut={() => applyZoomStep(-PDF_ZOOM_STEP)}
              onZoomIn={() => applyZoomStep(PDF_ZOOM_STEP)}
              onResetZoom={() => applyZoomPreset(0)}
              onToggleFullscreen={() => void toggleFullscreen()}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
