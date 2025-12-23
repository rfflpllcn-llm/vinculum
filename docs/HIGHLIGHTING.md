# PDF Line Highlighting via Alignment Row Number

This app highlights aligned lines by converting alignment chunk order (`rowNumber`) into a page-level line selection in PDF.js.

## Backend: derive rowNumber

- File: `src/lib/alignmentParser.ts`
- Key logic:
  - `computeChunkRowNumbers()` groups chunks by `(page, language)`, sorts by `chunk_id`, and assigns sequential `rowNumber`.
  - `chunkToAnchor()` attaches `rowNumber` to alignment anchors as metadata.
  - This `rowNumber` is **not** a PDF line index; it’s the order of the alignment chunk within its page. The frontend maps it to a visual line.

## Frontend: map rowNumber to line and draw highlight

- File: `src/components/PDFViewer.tsx`
- Flow:
  - Alignment anchors include `rowNumber` (manual anchors do not).
  - `computeLineRect()` groups `textContent.items` into line groups by rounded `top` coordinate (viewport space), sorts top→bottom, and computes a line bounding box.
  - If `quote` text is available, it attempts a text match first; otherwise it falls back to `rowNumber`.
  - The computed rect is normalized (0-1) and rendered as an absolutely positioned overlay on the PDF canvas.

## Notes and assumptions

- `rowNumber` is a best-effort proxy for visual line; it relies on chunk ordering within each page.
- If alignment data gains true line coordinates, replace the mapping with explicit positions instead of chunk order.
