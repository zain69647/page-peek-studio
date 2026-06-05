import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

interface PagePreviewProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  selected?: boolean;
  onClick?: () => void;
  width?: number;
}

export function PagePreview({ pdf, pageNumber, selected, onClick, width = 140 }: PagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaled = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!canvas.getContext("2d")) return;
        const dpr = window.devicePixelRatio || 1;
        const outputScale = dpr;
        canvas.width = Math.floor(scaled.width * outputScale);
        canvas.height = Math.floor(scaled.height * outputScale);
        canvas.style.width = `${scaled.width}px`;
        canvas.style.height = `${scaled.height}px`;
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        await page.render({ canvas, viewport: scaled, transform }).promise;
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, width]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl bg-card p-3 shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
        "hover:shadow-lg hover:-translate-y-0.5",
        selected && "ring-2 ring-primary",
      )}
    >
      <div
        className="relative overflow-hidden rounded-md bg-muted"
        style={{ width, minHeight: width * 1.3 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Rendering…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-destructive">
            Failed
          </div>
        )}
        <canvas ref={canvasRef} className={cn(loading && "opacity-0")} />
      </div>
      <span className="text-xs font-medium text-foreground">Page {pageNumber}</span>
    </button>
  );
}
