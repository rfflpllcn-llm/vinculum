✅ TODO 1: add page-based filtering so the alignment list only shows alignments for the current source page being viewed.
   - Implemented page change tracking in PDFViewer component
   - Added onSourcePageChange callback to DualDocumentView
   - Filter alignments by current source page in page.tsx
   - Added page indicator showing "Viewing page X alignments (Y of Z)"

✅ TODO 2: make alignments clickable so that when clicked, the corresponding texts from source and target get coloured marked
   - **Click alignment** → Highlights the corresponding text in BOTH PDFs (green highlight)
   - **Highlighting persists** → Stays visible even when modal is closed
   - **AI Audit button** → Separate "AI Audit" button in each alignment to open the modal
   - **Only one anchor highlighted per side** → Force slice(0,1) to prevent multiple highlights
   - Fixed documentId mismatch bug that prevented highlighting from working
   - Target PDF automatically scrolls to show the corresponding text when alignment is clicked
   - **🎯 REPLACED complex text matching with embedding-based search:**
     - Uses @xenova/transformers (sentence-transformers) for semantic similarity
     - Model: all-MiniLM-L6-v2 (cached after first load)
     - 50-word sliding windows with 50% overlap
     - Cosine similarity to find best matching text location
     - Much simpler and more accurate than previous string matching
     - Handles paraphrasing, OCR errors, and duplicate text automatically


