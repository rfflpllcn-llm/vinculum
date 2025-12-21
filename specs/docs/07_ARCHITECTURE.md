# System Architecture — Vinculum

This document defines the **authoritative system architecture**. Implementation MUST conform to these boundaries and responsibilities.

---

## 1\. Architectural Overview

Vinculum is a **client-centric web application** with:

- a thin application server  
- externalized storage and AI services  
- strict separation between UI, domain logic, and AI orchestration

┌─────────────────────────────────────────────┐ │ Browser (UI) │ │ Next.js (App Router) │ │ \- PDF Viewer (pdfjs-dist) │ │ \- Monaco Markdown Editor │ │ \- Alignment & Sync Scroll Logic │ └───────────────▲─────────────────────────────┘ │ │ HTTP / WebSocket │ ┌───────────────┴─────────────────────────────┐ │ Application Server (Thin) │ │ Next.js Server Actions / API Routes │ │ \- Auth orchestration │ │ \- Drive proxy │ │ \- Persistence coordination │ │ \- AI request assembly │ └───────────────▲─────────────────────────────┘ │ ┌────────────┼─────────────┐ │ │ │ ┌──┴───┐ ┌────┴────┐ ┌────┴────┐ │Drive │ │ Vector │ │ AI API │ │API │ │ DB │ │ (LLM) │ └──────┘ └─────────┘ └─────────┘

---

## 2\. Frontend Layer (Browser)

Status legend: items marked "(planned)" are not yet implemented; everything else reflects current behavior.

### Responsibilities

- Render PDFs and Markdown  
- Manage anchors and overlay rendering  
- Handle user interactions  
- Enforce UI constraints from `04_UI_SPECS.md`

### Key components

- `PDFViewer` (includes anchor overlay rendering)  
- `NotesPanel`  
- `DualDocumentView`  
- `AIPanel`

### Forbidden

- Direct calls to AI APIs  
- Direct access to vector DB  
- Persistent secrets

---

## 3\. Application Server Layer

### Responsibilities

- OAuth authentication (Google)  
- Google Drive API proxy  
- Validation of data schemas  
- Vector DB coordination  
- AI request construction

### Design

- Stateless  
- No business logic duplication  
- Server Actions preferred over REST where possible

---

## 4\. Authentication & Identity

### Provider

- Google OAuth

### Identity model

- One user ↔ one Drive namespace  
- No local user database for auth (v1)  
- Supabase stores document registry + audit history (server-side only)

### Security constraints

- Tokens stored server-side  
- Frontend never sees Drive tokens

---

## 5\. Storage Architecture

### Primary storage

- Google Drive  
- Folder: `/Vinculum_Data/`

Subfolders:

- `/Books/` (PDFs, Markdown)  
- `/Metadata/` (anchors, notes, alignments)  
- `/Backups/`

### Format

- JSON files, versioned  
- One logical entity per file where feasible

### Supplemental storage

- Supabase (PostgreSQL) for document registry and audit history  
- Server-only access via service role key  

---

## 6\. Metadata Persistence

### Entities stored

- Documents (Drive files + Supabase registry)  
- Anchors  
- Notes  
- Alignments

### Rules

- Write-through on creation  
- No batch mutation  
- Soft deletion only

---

## 7\. Vector Database

### Role

- Long-term semantic memory  
- Retrieval-only

### Characteristics

- External service  
- Stateless from app perspective  
- No authoritative data stored

---

## 8\. AI Layer

### Responsibilities

- Alignment-aware reasoning  
- Audit and explanation tasks only

### Contract

- All requests conform to `AI Audit Input Contract`  
- All responses cite anchorIds

### Forbidden

- Free-form chat without anchors  
- Autonomous tool usage

---

## 9\. Data Flow (Example: AI Audit)

User selects aligned anchors ↓ Frontend sends anchor IDs ↓ Server fetches anchor \+ notes ↓ Server retrieves vectors ↓ Server assembles AI input ↓ AI response returned ↓ Frontend renders cited output

---

## 10\. Error Handling

### Principles

- Fail closed  
- No silent degradation

### Examples

- Missing anchor → block AI call  
- Drive unavailable → read-only mode  
- Vector DB unavailable → AI features disabled

---

## 11\. Performance Constraints

- Anchor creation \< 100ms perceived  
- Sync scroll recalculation \< 16ms/frame  
- AI response streamed where possible

---

## 12\. Deployment Model

### Environments

- Local development  
- Staging  
- Production

### Hosting

- Vercel or equivalent  
- Environment variables via platform secrets

---

## 13\. Observability (Minimal)

- Client-side error logging  
- Server-side request logging  
- No user content logging

---

## 14\. Non-Goals

- Offline-first architecture  
- Peer-to-peer sync  
- Background AI agents

---

## 15\. Architectural Stability

Changes to:

- layer boundaries  
- storage model  
- AI contract

REQUIRE:

- update to this document  
- entry in `09_DECISIONS.md`
