# Feature Checklist & Milestones

## Phase 1 — Foundations ✅ COMPLETED

- [x] Google Drive OAuth
- [x] PDF library browser
- [x] Single PDF viewer
- [x] Anchor creation (rectangular)
- [x] Markdown note editor
- [x] Anchor persistence

## Phase 2 — Alignment & AI (IN PROGRESS - 30% complete)

### Foundation (Complete)
- [x] Type definitions (ViewMode, ScrollPosition, JSONL formats)
- [x] PDF text search module (findTextInPDF with fuzzy matching)
- [x] Alignment parser (JSONL → Anchor/Alignment conversion)
- [x] Implementation plan (PHASE2_PLAN.md)

### Core Features (Not Started)
- [ ] Dual PDF view (side-by-side layout)
- [ ] Sync scroll (≤20px drift)
- [ ] Alignment JSON parser API endpoint
- [ ] AI audit modal (aligned-only input)

### Remaining Tasks
- [ ] API: /api/alignments/upload (parse & persist JSONL)
- [ ] API: /api/alignments (list alignments for doc pair)
- [ ] API: /api/ai/audit (OpenAI GPT-4 integration)
- [ ] Enhanced PDFViewer (scroll tracking, read-only mode)
- [ ] Sync scroll hook (useSyncScroll with drift constraint)
- [ ] DualDocumentView component
- [ ] AlignmentVisualization component
- [ ] ViewModeToggle component
- [ ] Update page.tsx for dual state management
- [ ] AIAuditModal component
- [ ] Modal wrapper component
- [ ] Install openai dependency
- [ ] End-to-end testing

## Phase 3 — Memory

- [ ] Embedding pipeline  
- [ ] Vector DB storage  
- [ ] Related-notes sidebar  
- [ ] Conversational memory

