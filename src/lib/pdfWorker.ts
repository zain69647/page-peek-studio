import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
}

export { pdfjsLib };
