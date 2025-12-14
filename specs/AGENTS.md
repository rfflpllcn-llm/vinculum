# AGENTS.md — Vinculum

This file defines how Claude Code should reason about, modify, and extend this repository.

Claude Code MUST follow the rules and source hierarchy defined here.

---

## Canonical sources (read in this order)

1. docs/00\_INDEX.md  
   (navigation and document map)  
     
2. docs/01\_PRD.md  
   (product intent and scope)  
     
3. docs/05\_DATA\_SCHEMAS.md  
   (hard data contracts — highest technical authority)  
     
4. docs/04\_UI\_SPECS.md  
   (observable UI behavior and interaction rules)  
     
5. docs/06\_VECTOR\_DB\_RAG.md  
   (retrieval, indexing, and AI grounding rules)  
     
6. docs/07\_ARCHITECTURE.md  
   (system boundaries and responsibilities)  
     
7. docs/08\_ACCEPTANCE\_TESTS.md  
   (definition of done and verification criteria)  
     
8. docs/09\_DECISIONS.md  
   (rationale and approved deviations)

If documents conflict, **earlier items override later ones**.

Schemas, UI behavior, and architecture MUST NOT be overridden to satisfy acceptance tests or implementation convenience.

---

## Product definition

Vinculum is a scholarly web application for:

- reading aligned documents (PDF ↔ PDF, PDF ↔ Markdown)
- creating persistent, citation-grade anchors
- performing alignment-aware AI audit and explanation
- supporting long-term scholarly memory via RAG

---

## Development principles

- Text-first, deterministic behavior  
- Alignment-aware reasoning only  
- Every feature MUST have explicit acceptance criteria  
- No speculative features outside documented milestones  
- Prefer clarity and traceability over abstraction

---

## Phases

Phase 1: File ingestion, anchors, basic sync scroll Phase 2: Dual-document alignment \+ AI audit Phase 3: Vector indexing \+ long-term memory chatbot

Claude Code MUST NOT implement features from later phases prematurely.

---

## Agent workflow

### Starting a new feature

1. Identify the milestone in `03_MILESTONES.md`  
2. Read acceptance criteria in `08_ACCEPTANCE_TESTS.md`  
3. Check relevant data schemas in `05_DATA_SCHEMAS.md`  
4. Follow UI behavior in `04_UI_SPECS.md`  
5. Respect layer boundaries in `07_ARCHITECTURE.md`  
6. Implement incrementally  
7. Verify against acceptance tests  
8. Update `docs/progress/YYYY-MM-DD.md` only when milestone completes

### Handling uncertainty

- **Data contracts**: `05_DATA_SCHEMAS.md` is authoritative  
- **UI behavior**: `04_UI_SPECS.md` overrides assumptions  
- **Architecture**: `07_ARCHITECTURE.md` is binding  
- **Feature scope**: consult `03_MILESTONES.md`, ask user if unclear  
- **When docs conflict**: earlier canonical sources win

### Before making changes

- [ ] Verify change aligns with current phase  
- [ ] Check if data schemas affected → update `05_DATA_SCHEMAS.md`  
- [ ] Check if architecture affected → update `07_ARCHITECTURE.md`  
- [ ] Significant decision → add to `09_DECISIONS.md`

---

## Non-negotiable technical constraints

- Frontend: Next.js (App Router), TypeScript  
- PDF rendering: pdfjs-dist  
- Editor: Monaco (Markdown)  
- Storage: Google Drive (persistent, OAuth)  
- Vector DB: external (Qdrant or API-compatible equivalent)  
- AI calls: OpenAI-compatible API  
- No free-text AI prompting without anchors

---

## Working style

- Make small, reviewable changes  
- One concern per change set  
- Update docs/progress/YYYY-MM-DD.md ONLY after a milestone is completed  
- Never modify data schemas without updating:  
  - docs/05\_DATA\_SCHEMAS.md  
  - docs/09\_DECISIONS.md

---

## Commands

- Install: npm install  
- Dev: npm run dev  
- Test: npm test  
- Lint: npm run lint

