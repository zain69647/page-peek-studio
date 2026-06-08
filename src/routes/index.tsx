import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Upload,
  Download,
  AlertTriangle,
  RotateCcw,
  Plus,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF Page Extractor" },
      {
        name: "description",
        content:
          "Split a PDF into multiple named parts. 100% local in your browser.",
      },
    ],
  }),
  component: Index,
});

interface ParseResult {
  pages: number[];
  invalid: string[];
  outOfBounds: number[];
}

function parsePageInput(input: string, totalPages?: number): ParseResult {
  const result: ParseResult = { pages: [], invalid: [], outOfBounds: [] };
  if (!input.trim()) return result;
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  const set = new Set<number>();
  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);
    if (range) {
      const s = parseInt(range[1], 10);
      const e = parseInt(range[2], 10);
      if (s < 1 || e < s) {
        result.invalid.push(part);
        continue;
      }
      for (let i = s; i <= e; i++) {
        if (totalPages && i > totalPages) result.outOfBounds.push(i);
        else set.add(i);
      }
    } else if (single) {
      const n = parseInt(single[1], 10);
      if (n < 1) {
        result.invalid.push(part);
        continue;
      }
      if (totalPages && n > totalPages) result.outOfBounds.push(n);
      else set.add(n);
    } else {
      result.invalid.push(part);
    }
  }
  result.pages = Array.from(set).sort((a, b) => a - b);
  return result;
}

interface Part {
  id: string;
  name: string;
  input: string;
}

function sanitizeName(name: string, fallback: string) {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\.pdf$/i, "");
  return cleaned || fallback;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [parts, setParts] = useState<Part[]>([
    { id: newId(), name: "", input: "" },
  ]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileBytesRef = useRef<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    setLoadingPdf(true);
    setTotalPages(0);
    try {
      const bytes = await f.arrayBuffer();
      fileBytesRef.current = bytes;
      const doc = await PDFDocument.load(bytes.slice(0));
      setTotalPages(doc.getPageCount());
      setFile(f);
      const base = f.name.replace(/\.pdf$/i, "");
      setParts([{ id: newId(), name: `${base}-part1`, input: "" }]);
    } catch (e) {
      setError("Couldn't read that PDF. Make sure it isn't password-protected.");
      console.error(e);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  const parsedParts = useMemo(
    () => parts.map((p) => ({ ...p, parsed: parsePageInput(p.input, totalPages || undefined) })),
    [parts, totalPages],
  );

  const canExtract =
    !!file &&
    !loadingPdf &&
    parts.length > 0 &&
    parsedParts.every(
      (p) =>
        p.parsed.pages.length > 0 &&
        p.parsed.invalid.length === 0 &&
        p.parsed.outOfBounds.length === 0,
    );

  const updatePart = (id: string, patch: Partial<Part>) =>
    setParts((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPart = () => {
    const base = file?.name.replace(/\.pdf$/i, "") ?? "part";
    setParts((cur) => [
      ...cur,
      { id: newId(), name: `${base}-part${cur.length + 1}`, input: "" },
    ]);
  };

  const removePart = (id: string) =>
    setParts((cur) => (cur.length <= 1 ? cur : cur.filter((p) => p.id !== id)));

  const handleExtract = useCallback(async () => {
    if (!fileBytesRef.current || !canExtract) return;
    setExtracting(true);
    setError(null);
    try {
      const src = await PDFDocument.load(fileBytesRef.current);
      const baseName = file?.name.replace(/\.pdf$/i, "") || "extracted";

      const outputs: { name: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < parsedParts.length; i++) {
        const part = parsedParts[i];
        const out = await PDFDocument.create();
        const indices = part.parsed.pages.map((p) => p - 1);
        const copied = await out.copyPages(src, indices);
        copied.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        const name = sanitizeName(part.name, `${baseName}-part${i + 1}`);
        outputs.push({ name: `${name}.pdf`, bytes });
      }

      outputs.forEach((o) => {
        const blob = new Blob([o.bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = o.name;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      setError("Extraction failed. Please try again.");
      console.error(e);
    } finally {
      setExtracting(false);
    }
  }, [canExtract, file, parsedParts]);

  const handleClear = useCallback(() => {
    setFile(null);
    setTotalPages(0);
    setParts([{ id: newId(), name: "", input: "" }]);
    setError(null);
    fileBytesRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-background to-violet-50">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <header className="mb-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            PDF Page Extractor
          </h1>
          <p className="mt-2 text-muted-foreground">
            Split a PDF into multiple named parts — all in your browser.
          </p>
        </header>

        <section className="rounded-2xl border bg-card/80 backdrop-blur p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium">1. Choose a PDF</Label>
            {file && (
              <Button size="sm" variant="ghost" onClick={handleClear}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Upload new PDF
              </Button>
            )}
          </div>
          <div className="mt-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={openPicker}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openPicker();
              }}
              className={
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all " +
                (isDragging
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-border bg-muted/40 hover:bg-muted/60")
              }
            >
              <Upload className={"mb-2 h-7 w-7 " + (isDragging ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-medium">
                {file ? file.name : "Drag & drop a PDF here"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {totalPages > 0 ? `${totalPages} pages` : "or click to browse"}
              </span>
              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
              >
                Choose file
              </Button>
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
        </section>

        {file && (
          <section className="mt-6 rounded-2xl border bg-card/80 backdrop-blur p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                2. Define parts {parts.length > 1 && <span className="text-muted-foreground">({parts.length})</span>}
              </Label>
              <Button size="sm" variant="outline" onClick={addPart}>
                <Plus className="mr-2 h-4 w-4" />
                Add part
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each part becomes its own PDF and downloads separately.
            </p>

            <div className="mt-4 space-y-4">
              {parsedParts.map((p, idx) => (
                <div
                  key={p.id}
                  className="rounded-xl border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Part {idx + 1}
                    </span>
                    {parts.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removePart(p.id)}
                        aria-label={`Remove part ${idx + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`name-${p.id}`} className="text-xs">
                        File name
                      </Label>
                      <Input
                        id={`name-${p.id}`}
                        value={p.name}
                        onChange={(e) => updatePart(p.id, { name: e.target.value })}
                        placeholder={`part-${idx + 1}`}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`pages-${p.id}`} className="text-xs">
                        Pages
                      </Label>
                      <Input
                        id={`pages-${p.id}`}
                        value={p.input}
                        onChange={(e) => updatePart(p.id, { input: e.target.value })}
                        placeholder="e.g. 1, 5, 10-20"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {(p.parsed.invalid.length > 0 || p.parsed.outOfBounds.length > 0) && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {p.parsed.invalid.length > 0 && (
                          <div>Invalid: {p.parsed.invalid.join(", ")}</div>
                        )}
                        {p.parsed.outOfBounds.length > 0 && (
                          <div>
                            Out of range (PDF has {totalPages} pages):{" "}
                            {p.parsed.outOfBounds.join(", ")}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {p.parsed.pages.length > 0 &&
                    p.parsed.invalid.length === 0 &&
                    p.parsed.outOfBounds.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {p.parsed.pages.length} page(s) selected
                      </p>
                    )}
                </div>
              ))}
            </div>
          </section>
        )}

        {file && (
          <div className="mt-6 flex justify-end gap-3">
            <Button size="lg" variant="outline" onClick={handleClear}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Upload new PDF
            </Button>
            <Button size="lg" onClick={handleExtract} disabled={!canExtract || extracting}>
              <Download className="mr-2 h-4 w-4" />
              {extracting
                ? "Extracting…"
                : parts.length > 1
                  ? "Download PDFs"
                  : "Extract pages"}
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
