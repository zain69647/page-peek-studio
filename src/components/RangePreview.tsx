import type { PDFDocumentProxy } from "pdfjs-dist";
import { PagePreview } from "./PagePreview";
import type { ParsedRange } from "@/lib/parsePages";

interface RangePreviewProps {
  pdf: PDFDocumentProxy;
  totalPages: number;
  ranges: ParsedRange[];
  selectedRangeIndex: number | null;
  onSelectRange: (index: number) => void;
}

export function RangePreview({
  pdf,
  totalPages,
  ranges,
  selectedRangeIndex,
  onSelectRange,
}: RangePreviewProps) {
  if (ranges.length === 0) return null;

  return (
    <div className="space-y-6">
      {ranges.map((range, idx) => {
        const startValid = range.start <= totalPages;
        const endValid = range.end <= totalPages;
        const isSingle = range.start === range.end;
        const showEllipsis = !isSingle && range.end - range.start > 1;
        const selected = selectedRangeIndex === idx;

        return (
          <div
            key={`${range.start}-${range.end}-${idx}`}
            className="space-y-2"
            onClick={() => onSelectRange(idx)}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {isSingle ? `Page ${range.start}` : `Pages ${range.start} – ${range.end}`}
              </span>
              <span>·</span>
              <span>{range.end - range.start + 1} page(s)</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {startValid ? (
                <PagePreview
                  pdf={pdf}
                  pageNumber={range.start}
                  selected={selected}
                  onClick={() => onSelectRange(idx)}
                />
              ) : (
                <InvalidCard page={range.start} />
              )}
              {showEllipsis && (
                <span className="text-2xl font-light text-muted-foreground select-none">…</span>
              )}
              {!isSingle &&
                (endValid ? (
                  <PagePreview
                    pdf={pdf}
                    pageNumber={range.end}
                    selected={selected}
                    onClick={() => onSelectRange(idx)}
                  />
                ) : (
                  <InvalidCard page={range.end} />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InvalidCard({ page }: { page: number }) {
  return (
    <div className="flex h-[200px] w-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-card p-3 text-center text-xs text-destructive">
      Page {page} doesn't exist
    </div>
  );
}
