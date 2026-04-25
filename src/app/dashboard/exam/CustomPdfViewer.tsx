'use client';
'use no memo';

import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type PdfRenderTask = import('pdfjs-dist').RenderTask;
type PdfJsModule = typeof import('pdfjs-dist');

const PDFJS_VERSION = '5.4.530';
const PDFJS_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

interface CustomPdfViewerProps {
  pdfUrl: string;
  className?: string;
}

export const CustomPdfViewer = React.memo(({ pdfUrl, className = '' }: CustomPdfViewerProps) => {
  const [pdf, setPdf] = React.useState<PdfDocumentProxy | null>(null);
  const pdfRef = React.useRef<PdfDocumentProxy | null>(null);
  const pdfjsLibRef = React.useRef<PdfJsModule | null>(null);
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const [pdfjsReady, setPdfjsReady] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(0);
  const [scale, setScale] = React.useState(1.2);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const renderTaskRef = React.useRef<PdfRenderTask | null>(null);

  const isViewerFocusActive = React.useCallback(() => {
    if (typeof document === 'undefined') return false;
    const viewer = viewerRef.current;
    if (!viewer) return false;
    const active = document.activeElement;
    return Boolean(active && viewer.contains(active));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const initPdfJs = async () => {
      try {
        // Bypass webpack's import() rewriting — load pdfjs-dist directly from CDN
        // as a native browser ES module. Webpack 5.x's ESM handling mangles
        // pdfjs-dist's module body and triggers "Object.defineProperty called
        // on non-object" during the import.
        const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<PdfJsModule>;
        const mod = await dynamicImport(PDFJS_CDN);
        if (cancelled) return;

        mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        pdfjsLibRef.current = mod;
        setPdfjsReady(true);
      } catch (err) {
        console.error('[CustomPdfViewer] init error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize PDF renderer');
          setIsLoading(false);
        }
      }
    };

    void initPdfJs();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!pdfjsReady) return;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const pdfjsLib = pdfjsLibRef.current;
        if (!pdfjsLib) {
          throw new Error('PDF renderer is not ready');
        }

        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF');

        const arrayBuffer = await response.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        pdfRef.current?.destroy();
        pdfRef.current = loadedPdf;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('[CustomPdfViewer] load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    };

    void loadPdf();

    return () => {
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [pdfUrl, pdfjsReady]);

  React.useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      renderTaskRef.current?.cancel();

      try {
        const page = await pdf.getPage(currentPage);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const context = canvas.getContext('2d');
        if (!context) return;

        const renderTask = page.render({ canvasContext: context, viewport, canvas: canvas });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if ((err as { name?: string }).name !== 'RenderingCancelledException') {
          console.error('Page rendering error:', err);
        }
      }
    };

    void renderPage();
  }, [pdf, currentPage, scale]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  React.useEffect(() => {
    const isZoomShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return { in: false, out: false };

      const zoomIn = e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd';
      const zoomOut = e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract';
      return { in: zoomIn, out: zoomOut };
    };

    const suppressBrowserZoom = (e: KeyboardEvent) => {
      const zoom = isZoomShortcut(e);
      if (!zoom.in && !zoom.out) return;
      if (!isViewerFocusActive()) return;

      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();

      if (e.type !== 'keydown') return;
      if (zoom.in) {
        setScale((prev) => Math.min(prev + 0.15, 4));
      } else if (zoom.out) {
        setScale((prev) => Math.max(prev - 0.15, 0.4));
      }
    };

    const suppressWheelBrowserZoom = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (!isViewerFocusActive()) return;

      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (e.deltaY < 0) {
        setScale((prev) => Math.min(prev + 0.15, 4));
      } else if (e.deltaY > 0) {
        setScale((prev) => Math.max(prev - 0.15, 0.4));
      }
    };

    document.addEventListener('keydown', suppressBrowserZoom, true);
    document.addEventListener('keypress', suppressBrowserZoom, true);
    document.addEventListener('keyup', suppressBrowserZoom, true);
    document.addEventListener('wheel', suppressWheelBrowserZoom, { capture: true, passive: false });
    return () => {
      document.removeEventListener('keydown', suppressBrowserZoom, true);
      document.removeEventListener('keypress', suppressBrowserZoom, true);
      document.removeEventListener('keyup', suppressBrowserZoom, true);
      document.removeEventListener('wheel', suppressWheelBrowserZoom, true);
    };
  }, [isViewerFocusActive]);

  const handlePrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.15, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.4));
  const handleFitToPage = () => setScale(1.2);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  return (
    <div
      ref={viewerRef}
      tabIndex={0}
      onMouseDownCapture={() => viewerRef.current?.focus({ preventScroll: true })}
      className={`flex flex-col bg-neutral-100 overflow-hidden outline-none ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5 shrink-0">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          title="Previous page (←)"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-700" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
            className="w-12 px-2 py-1 border border-neutral-300 rounded-md text-center text-neutral-800 focus:outline-none focus:border-neutral-500"
          />
          <span className="text-neutral-500 text-xs">/ {totalPages}</span>
        </div>

        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          title="Next page (→)"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5 text-neutral-700" />
        </button>

        <div className="h-6 w-px bg-neutral-300 mx-1" />

        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-5 h-5 text-neutral-700" />
        </button>

        <span className="text-sm text-neutral-600 w-12 text-center">
          {Math.round(scale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-5 h-5 text-neutral-700" />
        </button>

        <button
          type="button"
          onClick={handleFitToPage}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <Maximize2 className="w-5 h-5 text-neutral-700" />
        </button>
      </div>

      {/* PDF Display Area */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center bg-neutral-200 p-4"
        onMouseDown={() => viewerRef.current?.focus({ preventScroll: true })}
      >
        {isLoading ? (
          <div className="flex items-center justify-center w-full h-full text-neutral-600 text-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-neutral-400 border-t-neutral-700 rounded-full animate-spin" />
              Loading PDF...
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center w-full h-full text-rose-600 text-sm">
            Error: {error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="shadow-xl rounded"
          />
        )}
      </div>
    </div>
  );
});

CustomPdfViewer.displayName = 'CustomPdfViewer';
