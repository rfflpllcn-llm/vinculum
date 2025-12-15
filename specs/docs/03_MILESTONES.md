# Feature Checklist & Milestones

## Phase 1 — Foundations ✅ COMPLETED

- [x] Google Drive OAuth
- [x] PDF library browser
- [x] Single PDF viewer
- [x] Anchor creation (rectangular)
- [x] Markdown note editor
- [x] Anchor persistence

## Phase 2 — Alignment & AI ✅ COMPLETED

### Foundation
- [x] Type definitions (ViewMode, ScrollPosition, JSONL formats)
- [x] PDF text search module (findTextInPDF with fuzzy matching)
- [x] Alignment parser (JSONL → Anchor/Alignment conversion)
- [x] Implementation plan (PHASE2_PLAN.md)

### Core Features
- [x] Dual PDF view (side-by-side layout)
- [x] Sync scroll (≤20px drift)
- [x] Alignment JSON parser API endpoint
- [x] AI audit modal (aligned-only input)

### Implementation Details
- [x] API: /api/alignments/upload (parse & persist JSONL)
- [x] API: /api/alignments (list alignments for doc pair)
- [x] API: /api/ai/audit (OpenAI GPT-4 integration)
- [x] Enhanced PDFViewer (scroll tracking, read-only mode, highlighted anchors)
- [x] Sync scroll hook (useSyncScroll with drift constraint)
- [x] DualDocumentView component
- [x] AlignmentVisualization component
- [x] ViewModeToggle component
- [x] Update page.tsx for dual state management
- [x] AIAuditModal component
- [x] Modal wrapper component
- [x] Install openai dependency
- [x] Build verification and testing

## Phase 3 — Memory

- [ ] Embedding pipeline  
- [ ] Vector DB storage  
- [ ] Related-notes sidebar  
- [ ] Conversational memory

