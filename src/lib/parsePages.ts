export interface ParsedRange {
  start: number;
  end: number;
}

export interface ParseResult {
  ranges: ParsedRange[];
  pages: number[]; // flattened unique sorted
  invalid: string[];
  outOfBounds: number[];
}

export function parsePageInput(input: string, totalPages?: number): ParseResult {
  const result: ParseResult = { ranges: [], pages: [], invalid: [], outOfBounds: [] };
  if (!input.trim()) return result;

  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  const pageSet = new Set<number>();

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);

    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start < 1 || end < start) {
        result.invalid.push(part);
        continue;
      }
      result.ranges.push({ start, end });
      for (let i = start; i <= end; i++) {
        if (totalPages && i > totalPages) result.outOfBounds.push(i);
        else pageSet.add(i);
      }
    } else if (singleMatch) {
      const n = parseInt(singleMatch[1], 10);
      if (n < 1) {
        result.invalid.push(part);
        continue;
      }
      result.ranges.push({ start: n, end: n });
      if (totalPages && n > totalPages) result.outOfBounds.push(n);
      else pageSet.add(n);
    } else {
      result.invalid.push(part);
    }
  }

  result.pages = Array.from(pageSet).sort((a, b) => a - b);
  return result;
}
