[x] Critical – python/wrapper.py:139-299: On any exception, the function returns without cleaning up temp_dir, leaking a full copy of the PDFs/Markdown on every failed run. Wrap the whole body in a try/finally (or delete in the except path) so shutil.rmtree(temp_dir) always executes before
    returning.
[x]  High-value – src/app/page.tsx:377-401: Rendering filters alignments and builds highlight lists using Array.find/Array.filter repeatedly per render. For N alignments and M anchors this is O(N·M) every render and grows quickly with large datasets. Build useMemo maps (anchorId -> anchor, page ->
  source anchors) once and use constant-time lookups for filteredAlignments, selectedSourceAnchors, and selectedTargetAnchors; this also avoids the brittle includes(searchHighlightAnchor) reference check.
[x] High-value – src/components/SearchPanel.tsx:54-68: Search walks every chunk and, for each match, linearly searches all anchors by text equality. This is quadratic and can produce wrong rowNumber when the same text occurs multiple times. Pass a chunkId -> rowNumber/language/page map (or include
  rowNumber in chunkMap) and read it directly; avoid scanning anchors on every keystroke.
[x] High-value – src/components/AlignmentVisualization.tsx:40-134: selectedTypes is initialized from uniqueAlignmentTypes but never resyncs when new alignments arrive, so new types are silently hidden until the user manually toggles filters. Add an effect to reset/merge when uniqueAlignmentTypes
  changes. Also, per-type counts use alignments.filter inside the render loop and anchor lookups use find for every row (lines 129-152), leading to O(N²) work. Precompute a type -> count map and anchorId -> anchor maps via useMemo and reuse them in the render.
[x] High-value – src/hooks/useSyncScroll.ts:43-83,122-168: Every scroll event filters anchors on the current page and linearly searches alignments and targetAnchors to find a match. With frequent scroll events and many anchors, this becomes a hot path. Precompute dictionaries (page -> source
  anchors, sourceAnchorId -> alignment, anchorId -> anchor) outside the handler so handleSourceScroll does only constant-time lookups.
[x] Optional – src/app/page.tsx:404-427: Debug console.log/console.warn calls run on every render and dump large objects; these can degrade UX in production and slow rendering. Consider guarding them behind a debug flag or removing them.


TO BE REVIEWED

• - Dual-view data flow simplification (scope: medium, risk: medium)
    src/app/page.tsx owns a very wide state surface (doc selection, file data, anchors, alignments, cache flags, search state). Consider splitting into two focused providers/hooks: (1) a “document pair” store (source/target docs, file data, cache status, current pages, sync-scroll toggles), and (2)
    an “alignment context” (anchors, alignments, selected alignment, search highlight). This reduces prop-drilling into DualDocumentView, SearchPanel, and AlignmentVisualization, and makes adding features (e.g., bookmarking, exporting) safer with clearer responsibilities.
[x] Alignment cache/download API (scope: medium, risk: medium)
    src/app/api/alignments/generate/route.ts currently returns Drive IDs but no direct download URLs, and fetches are forced through /api/documents/[fileId] with hard-coded Content-Type: application/pdf. Introduce a small download route that streams JSONL with correct headers and short-lived signed
    URLs (or token-checked passthrough) so the client can offer “Download chunks/alignments” directly without leaking access tokens or mislabeling content. Benefit: reduces accidental MIME mismatches and avoids duplicating Drive access logic on the client.
  - Search robustness for duplicate text (scope: low, risk: low)
    src/components/SearchPanel.tsx builds a composite key from quote|page, which still collides when identical text appears multiple times on the same page. Add chunkId to the anchor metadata lookup (or stash chunk_id on anchors as they’re parsed) and key on chunkId instead of text. This removes
    the last ambiguity and makes navigation deterministic.
  - Sync-scroll drift metric realism (scope: low, risk: low)
    src/hooks/useSyncScroll.ts compares normalized Y to MAX_DRIFT_PX/1000, which isn’t tied to viewport height, so drift gating is effectively arbitrary. Pass viewport height (or computed px height) from PDFViewer into the hook and compare actual pixels to MAX_DRIFT_PX. Benefit: predictable UX and
    less surprising sync toggling.
  - Alignment lookup completeness (scope: low, risk: low)
    useSyncScroll only maps sourceAnchorId -> alignment using the primary anchor, but the data model supports multi-source anchors (sourceAnchorIds). If multi-chunk alignments are common, preload a map from all source anchor IDs to alignment and use it in findNearestAlignment. This prevents sync-
    scroll from “dropping” when the primary ID doesn’t match the hovered anchor.
  - Background task observability (scope: medium, risk: low)
    The generate task flow (taskManager, generateInBackground) only surfaces coarse status and stdout snippets. Add structured logging of task lifecycle and Python stderr, plus explicit failure codes in the task result. Benefit: faster incident triage and easier user-facing error messages without
    digging through console logs.
  - Drive service MIME correctness (scope: low, risk: low)
    DriveService.downloadFile is used for both PDFs and JSONL, but /api/documents/[fileId] always returns Content-Type: application/pdf. Either infer MIME from Drive metadata or accept a mimeType hint in the route to set correct headers. This prevents corrupted downloads and simplifies client-side
    handling of generated JSONL exports.
  - Test coverage for JSONL generation path (scope: medium, risk: medium)
    There’s no automated verification that python/wrapper.py plus generateInBackground produce consistent JSONL outputs for given fixture PDFs. Add an integration test that stubs the Drive service (local FS) and asserts that generated chunk/alignment counts, cache keys, and metadata JSON align.
    Benefit: guards against regressions i[chunks_2025-12-18.jsonl](../../../Downloads/chunks_2025-12-18.jsonl)n the Python/Node boundary and cache metadata schema changes.
  - 
MINE

[x] implement the possibility for the user to download the chunks and the alignments jsonl files after their generation
[x] make Source and Target Text in "AI Alignment Audit" editable, so that user can manually edit them before generating the prompt
[] store the prompt in "AI Alignment Audit" separately from the code where it is used. the idea is in the future to create a collection of multiple prompts the user will choose from. or assign a prompt to each task tyoe

IDEAS:
[] let user have the possibility to extend/reduce  Source and Target Text in "AI Alignment Audit" adding or removing lines

SEMANTIC SEARCH:

[] implement semantic search in the search box. distinguish with a label among the exact search and the semantic search results. include only the semantic search results if significant (ABOVE X%).
in settings, users have the possibiity to select an embededing model and additional specifications, like BM12 search, ...

• Here’s a concrete plan to add semantic search alongside the existing exact chunk search:

  - Clarify data & schema: Confirm whether chunk data already includes vector IDs/embeddings; if not, extend LanguageChunk in src/types/schemas.ts and JSONL parsing to carry a vectorId (and optionally similarity from backend responses) so semantic hits can map back to anchors/pages. Document any
    required fields in IMPLEMENTATION_SUMMARY.md.
  - Backend semantic search API: Add a dedicated route (e.g., POST /api/search/semantic) that accepts the query, language/document filters, and a minimum similarity threshold X (env-driven, e.g., SEMANTIC_SEARCH_MIN_SCORE=0.7). Use the vector DB client to run cosine search over chunk vectors,
    returning {chunkId, text, page, language, score} only for hits above X. Return an empty list if no hit passes the threshold. Include graceful fallback/error messaging for when the vector service is unavailable.
  - Combine results in SearchPanel: Update src/components/SearchPanel.tsx to run both searches in parallel after the debounce: keep the current local exact match (substring) search, and call the semantic API. Merge results into a single list with a clear badge/label per row (Exact vs Semantic 82%).
    Only render semantic rows if their score ≥ threshold; otherwise omit them entirely. Preserve pagination and the existing anchor lookup so semantic results still navigate to the correct page/row.
  - UI/UX tweaks: Add a small legend or filter toggle indicating both modes are active, display the threshold when semantic results are hidden (“Semantic matches below 70% are suppressed”), and show a separate loading/empty state for semantic search errors without blocking exact results.
  - Validation & tests: Add unit tests for the semantic API (threshold enforcement, filtering) and a lightweight front-end test for the merged result labeling logic. Manually verify in the UI that clicking either result type navigates/highlights correctly and that semantic results disappear when
    their scores drop below X.
