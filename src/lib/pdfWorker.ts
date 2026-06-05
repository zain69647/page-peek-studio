// Client-only pdf.js loader. Avoid importing pdfjs-dist at module scope so SSR
// (which has no DOMMatrix) doesn't crash.
import type * as PdfJs from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | null = null;

export function getPdfJs(): Promise<typeof PdfJs> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("pdfjs can only be loaded in the browser"));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      // @ts-ignore - vite worker import
      const PdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?worker")).default;
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}
