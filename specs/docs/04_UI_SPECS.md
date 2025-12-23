# UI / UX Specifications — Vinculum

This document defines **observable UI behavior**. Visual styling is secondary; interaction semantics are normative.

---

## 1\. Global Layout

### Application Shell

- Single-page web application  
- Persistent top navigation bar  
- Main workspace below navigation

\+--------------------------------------------------+ | Top Bar (Library | Document | AI | Settings) | \+--------------------------------------------------+ | Main Workspace | | | | | \+--------------------------------------------------+

---

## 2\. Top Navigation Bar

### Elements

- **Library**: open document library  
- **Document**: active document actions  
- **AI**: audit / explanation tools  
- **Settings**: account & system

### Behavior

- Navigation state MUST reflect active workspace  
- Switching tabs MUST NOT reload documents

---

## 3\. Library View

### Purpose

Manage Google Drive–backed documents.

### Layout

- Left panel modal or full view  
- List of documents (PDF, Markdown)

### Behavior

- On load, fetch `/Vinculum_Data/Books` from Drive  
- Clicking a document opens it in the main workspace  
- Library closes automatically on open

### Constraints

- No local filesystem access  
- All files originate from Google Drive

---

## 4\. Single Document View

### Layout

\+----------------------------+------------------+ | PDF Viewer | Notes Panel | | | | | | | \+----------------------------+------------------+

### Behavior

- PDF viewer uses `pdfjs-dist`  
- Notes panel uses Monaco Editor  
- Selecting a region enables anchor creation  
- Notes auto-save on edit
- Divider between the PDF viewer and notes panel is draggable to resize widths
- Notes panel width persists across reloads; double-clicking the divider resets to default width
- Status legend: items marked "(planned)" are not yet implemented; everything else reflects current behavior

---

## 5\. Anchor Creation

### Interaction

1. User selects a region in the PDF  
2. Selection rectangle appears  
3. "Create Anchor" action becomes available  
4. Anchor is persisted immediately

### Visual Feedback

- Anchors are listed in the notes panel  
- Anchors render as translucent overlays when "Show my anchors" is enabled  
- Clicking an anchor (overlay or list) focuses the associated note

### Constraints

- Anchor coordinates are normalized  
- Anchors cannot be resized after creation
- Region anchors may be created even when no text is detected

---

## 6\. Notes Panel

### Behavior

- Notes are displayed contextually per anchor  
- Editing a note does not alter anchor data  
- Markdown preview available (toggle)

### Constraints

- One note per anchor (v1)  
- Notes cannot exist without anchors

---

## 7\. Dual Document View (Alignment Mode)

### Layout

\+----------------------+----------------------+ | Source Document | Target Document | | PDF | PDF | \+----------------------+----------------------+

### Behavior

- Activated via the View mode toggle (Single / Dual) in the top navigation  
- Both documents load simultaneously  
- Anchors are visually paired when aligned
- Divider between the dual document workspace and right-side panels is draggable to resize widths
- Right-side panel width persists across reloads; double-clicking the divider resets to default width

---

## 8\. Sync Scroll

### Behavior

- Scrolling source moves target proportionally  
- Alignment anchors determine scroll mapping  
- Manual scroll temporarily disables sync

### Constraints

- Drift must remain ≤ 20px  
- Releasing scroll re-enables sync

---

## 9\. Alignment Creation

### Interaction

1. User switches to Dual view  
2. User selects source and target documents  
3. User uploads JSONL files (chunks + alignments) or generates them from PDFs  
4. Server parses JSONL, creates anchors + alignments, and persists metadata

### Visual Feedback

- Alignment list appears in the sidebar  
- Selecting an alignment highlights the corresponding anchors and enables AI audit

---

## 10\. AI Panel

### Entry Points

- Context menu on aligned anchors  
- Top navigation "AI" tab

### Available Actions

- Audit alignment  
- Explain differences  
- Compare notes

### Behavior

- AI input is auto-generated  
- User can edit source/target text and copy the generated prompt  
- Output references anchors explicitly

---

## 11\. AI Output Display

### Format

- Structured blocks  
- Each paragraph references anchor IDs  
- Clicking a reference scrolls to anchor

### Constraints

- No output without alignment  
- No hallucinated document references

---

## 12\. Error & Empty States

### Examples

- No document selected → show hint  
- No alignment → disable AI actions  
- Drive disconnected → blocking error

---

## 13\. Accessibility & UX Rules

- Keyboard navigation supported  
- Scroll syncing respects reduced motion settings  
- Text size follows browser preferences

---

## 14\. Non-goals (Explicitly Out of Scope)

- Visual theming  
- Collaborative cursors  
- Public sharing links
