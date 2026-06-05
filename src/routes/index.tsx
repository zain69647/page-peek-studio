import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getPdfJs } from "@/lib/pdfWorker";
import { parsePageInput } from "@/lib/parsePages";
import { RangePreview } from "@/components/RangePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, Download, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF Page Extractor — Preview & Extract" },
      {
        name: "description",
        content:
          "Extract specific pages from PDFs with live visual previews. 100% local in your browser.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInput, setPageInput] = useState("");
  const [selectedRange, setSelectedRange] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileBytesRef = useRef<ArrayBuffer | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setLoadingPdf(true);
    setPdf(null);
    setTotalPages(0);
    try {
      const bytes = await f.arrayBuffer();
      fileBytesRef.current = bytes;
      const pdfjsLib = await getPdfJs();
      const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      setPdf(doc);
      setTotalPages(doc.numPages);
      setFile(f);
    } catch (e) {
      setError("Couldn't read that PDF. Make sure it isn't password-protected.");
      console.error(e);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  const parsed = useMemo(
    () => parsePageInput(pageInput, totalPages || undefined),
    [pageInput, totalPages],
  );

  useEffect(() => {
    setSelectedRange(null);
  }, [pageInput]);

  const canExtract =
    !!pdf && parsed.pages.length > 0 && parsed.invalid.length === 0 && parsed.outOfBounds.length === 0;

  const handleExtract = useCallback(async () => {
    if (!fileBytesRef.current || parsed.pages.length === 0) return;
    setExtracting(true);
    setError(null);
    try {
      const src = await PDFDocument.load(fileBytesRef.current);
      const out = await PDFDocument.create();
      const indices = parsed.pages.map((p) => p - 1);
      const copied = await out.copyPages(src, indices);
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = file?.name.replace(/\.pdf$/i, "") ?? "extracted";
      a.download = `${base}-pages.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Extraction failed. Please try again.");
      console.error(e);
    } finally {
      setExtracting(false);
    }
  }, [parsed.pages, file]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <header className="mb-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">PDF Page Extractor</h1>
          <p className="mt-2 text-muted-foreground">
            Pick pages, preview them, then export — all in your browser.
          </p>
        </header>

        {/* Upload */}
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <Label htmlFor="file" className="text-sm font-medium">
            1. Choose a PDF
          </Label>
          <div className="mt-3">
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:bg-muted/50"
            >
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "Click to upload or drop a PDF"}
              </span>
              {totalPages > 0 && (
                <span className="mt-1 text-xs text-muted-foreground">{totalPages} pages</span>
              )}
              <input
                id="file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        </section>

        {/* Page input */}
        {pdf && (
          <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <Label htmlFor="pages" className="text-sm font-medium">
              2. Pages to extract
            </Label>
            <Input
              id="pages"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="e.g. 1, 5, 10-20"
              className="mt-3"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Use commas and ranges. Example: <code>1, 5, 10-20</code>
            </p>

            {(parsed.invalid.length > 0 || parsed.outOfBounds.length > 0) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {parsed.invalid.length > 0 && (
                    <div>Invalid: {parsed.invalid.join(", ")}</div>
                  )}
                  {parsed.outOfBounds.length > 0 && (
                    <div>
                      Out of range (PDF has {totalPages} pages):{" "}
                      {parsed.outOfBounds.join(", ")}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </section>
        )}

        {/* Previews */}
        {pdf && parsed.ranges.length > 0 && (
          <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium">Preview</h2>
              <span className="text-xs text-muted-foreground">
                {parsed.pages.length} unique page(s) selected
              </span>
            </div>
            <RangePreview
              pdf={pdf}
              totalPages={totalPages}
              ranges={parsed.ranges}
              selectedRangeIndex={selectedRange}
              onSelectRange={setSelectedRange}
            />
          </section>
        )}

        {/* Extract */}
        {pdf && (
          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={handleExtract} disabled={!canExtract || extracting}>
              <Download className="mr-2 h-4 w-4" />
              {extracting ? "Extracting…" : "Extract pages"}
            </Button>
          </div>
        )}

        {loadingPdf && (
          <p className="mt-6 text-center text-sm text-muted-foreground">Loading PDF…</p>
        )}
        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
