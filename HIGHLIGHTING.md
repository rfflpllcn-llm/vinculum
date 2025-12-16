# PDF Line Highlighting via Alignment Row Number

This app highlights aligned lines by converting alignment chunk order (`row_number`) into a page-level line selection in PDF.js.

## Backend: derive row number

- File: `/home/rp/data/melancolia_della_resistenza/test-prod/melancolia_della_resistenza/app/main.py`
- Key logic:
  - `_load_alignments()` caches `en-it.jsonl` rows and precomputes per-page max `chunk_id` for src/tgt.
  - `_as_int_page()` normalizes page labels like `"001"` → `1`.
  - `_build_match_payload()` computes `row_number` as `min(chunk_ids) - last_chunk_id_of_prev_page` using the precomputed maps; attaches `row_number` to `src` and `tgt` in the `/search` response.
  - This `row_number` is **not** a PDF line index; it’s the order of the alignment chunk within its page. The frontend maps it to a visual line.

## Frontend: map row number to line and draw highlight

- File: `/home/rp/data/melancolia_della_resistenza/test-prod/melancolia_della_resistenza/app/static/app.js`
- Flow:
  - `/search` response provides `page` and `row_number` for both langs.
  - `jumpTo(page, highlightText, lineNumber)` renders the page with PDF.js and calls `_highlightMatches`.
  - `_highlightMatches` groups `textContent.items` into lines by rounded `top` coordinate (viewport space). Lines are sorted top→bottom.
  - If `lineNumber` is provided and within bounds, it selects that line group and draws one highlight rectangle spanning the min/max x and y of the group.
  - Fallback: if no `lineNumber`, it highlights lines containing any search words.
  - `_drawHighlight` writes absolutely positioned `<div class="highlight">` overlays; `renderPage` scales the overlay layer to match the rendered canvas size.

## Styling / overlay sync

- File: `/home/rp/data/melancolia_della_resistenza/test-prod/melancolia_della_resistenza/app/static/styles.css`
- Canvas no longer auto-scales via CSS; overlay layer uses the canvas render size and a scale transform to stay aligned.

## Notes and assumptions

- `row_number` is a best-effort proxy for visual line; it relies on chunk ordering in `en-it.jsonl`.
- If alignment data gains true `line_start/line_end` or coordinates, replace the mapping with the explicit positions instead of chunk order.
