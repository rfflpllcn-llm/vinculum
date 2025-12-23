# Specs vs Code Consistency Report

## Scope

- Specs reviewed: `specs/docs/01_PRD.md`, `specs/docs/03_MILESTONES.md`, `specs/docs/04_UI_SPECS.md`, `specs/docs/05_DATA_SCHEMAS.md`, `specs/docs/06_VECTOR_DB_RAG.md`, `specs/docs/07_ARCHITECTURE.md`, `specs/docs/08_ACCEPTANCE_TESTS.md`, `specs/docs/09_DECISIONS.md`
- Code areas reviewed (examples): `src/components/NotesPanel.tsx`, `src/components/SingleViewPage.tsx`, `src/components/DualDocumentView.tsx`, `src/components/ViewModeToggle.tsx`, `src/components/AIAuditModal.tsx`, `src/components/AlignmentUploadPanel.tsx`, `src/hooks/useSyncScroll.ts`, `src/lib/taskManager.ts`, `src/lib/jsonlCache.ts`, `src/types/schemas.ts`, `src/app/api/alignments/upload/route.ts`, `src/app/api/alignments/generate/route.ts`
- Method: static inspection only (no runtime verification)

## Deviations

### UI / UX

[] Dual view activation via an "Align" action is specified, but the UI uses a view toggle instead. Spec: `specs/docs/04_UI_SPECS.md`. Code: `src/components/ViewModeToggle.tsx`, `src/app/page.tsx`.
[] Manual alignment creation workflow (select source/target anchor, "Create Alignment") is specified but not implemented; alignments are created via JSONL upload/generation. Spec: `specs/docs/04_UI_SPECS.md`. Code: `src/components/AlignmentUploadPanel.tsx`, `src/app/api/alignments/upload/route.ts`.
[] Dual view and single view Markdown rendering are specified ("PDF/Markdown"), but Markdown is not supported (single view shows a placeholder). Spec: `specs/docs/04_UI_SPECS.md`. Code: `src/components/SingleViewPage.tsx`, `src/components/DualDocumentView.tsx`.
[] AI prompt editing is partially allowed: source/target text is editable and a copyable prompt is exposed, contrary to the "user cannot edit raw AI prompt" restriction. Spec: `specs/docs/04_UI_SPECS.md`. Code: `src/components/AIAuditModal.tsx`.
[] Sync scroll "manual override" is specified but not wired; the hook defines a disable mechanism that is never called. Spec: `specs/docs/04_UI_SPECS.md`. Code: `src/hooks/useSyncScroll.ts`, `src/components/DualDocumentView.tsx`.

### Data schema drift

[] Alignment objects in code include `sourceAnchorIds`, `targetAnchorIds`, and `alignment_type`, which are not in the canonical schema. Spec: `specs/docs/05_DATA_SCHEMAS.md`. Code: `src/types/schemas.ts`, `src/lib/alignmentParser.ts`.
[] Document objects include `isOriginal?`, which is not defined in the canonical schema. Spec: `specs/docs/05_DATA_SCHEMAS.md`. Code: `src/types/schemas.ts`.
[] Schema rule "Optional fields MUST be explicit (null)" is not followed; API responses omit optional fields rather than returning explicit nulls. Spec: `specs/docs/05_DATA_SCHEMAS.md`. Code: `src/app/api/anchors/route.ts`, `src/app/api/notes/route.ts`.

### Architecture & storage model

[] Supabase usage exceeds documented scope: generation tasks are persisted in `generation_tasks`. Spec: `specs/docs/07_ARCHITECTURE.md`. Code: `src/lib/taskManager.ts`, `src/app/api/alignments/generate/route.ts`, `src/types/supabase.ts`.
[] Drive metadata storage includes `/Metadata/Cache` for JSONL caching, which is not documented. Spec: `specs/docs/07_ARCHITECTURE.md`. Code: `src/lib/jsonlCache.ts`.
[] "No batch mutation" rule conflicts with alignment upload/generation writing full anchor/alignment files in bulk. Spec: `specs/docs/07_ARCHITECTURE.md`. Code: `src/app/api/alignments/upload/route.ts`.

### Product scope / phases

[] PRD lists vector search as a core capability, but no vector DB or RAG pipeline is implemented. Spec: `specs/docs/01_PRD.md`, `specs/docs/06_VECTOR_DB_RAG.md`. Code: no vector DB integration found.

## Notes

[] Some gaps appear consistent with Phase 3 deferrals; if intentional, mark them as planned in the specs to avoid conflicts with "authoritative" requirements.
[] Runtime behavior (e.g., sync scroll tolerances, AI output grounding) was not validated in a running app.
