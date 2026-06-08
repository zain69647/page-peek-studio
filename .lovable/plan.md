## Multi-part PDF split

Replace the single page-input with a list of **parts**. Each part has its own name and page range. On extract, generate one PDF per part and download them together as a ZIP.

### UX changes in `src/routes/index.tsx`
- Section "2. Define parts" replaces current pages + rename sections.
- Each part row: `Name` input, `Pages` input (`1, 5, 10-20`), per-row validation message, remove button.
- "+ Add part" button appends a new empty part.
- Default: one part pre-filled with name = original filename.
- Footer button: **Download ZIP** (renamed from Extract) — disabled until every part has ≥1 valid page, no invalid tokens, no out-of-range pages, and at least one part exists.
- Single-part case still downloads a plain `.pdf` (skip zipping) for a nicer UX.

### Logic
- State: `parts: { id: string; name: string; input: string }[]` plus derived `parsedParts` (memoized parse per row using existing `parsePageInput`).
- On extract: for each part, build a new `PDFDocument`, copy its pages, `save()` to bytes. If >1 part → zip with **jszip**; else download directly.
- Filenames sanitized (strip path separators, trim, fallback to `part-{i}`). ZIP named from original PDF: `{originalBase}-parts.zip`.

### Technical
- Add dependency: `jszip` (pure JS, tiny, browser-safe).
- Keep all existing handlers (`handleFile`, `handleClear`, drag-drop). `handleClear` resets parts to one empty row.
- Remove the standalone "Rename output file" section — naming now lives per part.
- Keep loading/error states and the lighter palette unchanged.

### Files touched
- `src/routes/index.tsx` — rewrite middle sections and extract handler.
- `package.json` / `bun.lock` — add `jszip`.
