# Data Schemas & Contracts — Vinculum

This document defines **authoritative data contracts**. Any implementation MUST conform to these schemas exactly. Changes require updating this file and docs/09\_DECISIONS.md.

---

## 1\. Identifiers & Conventions

### UUIDs

All primary identifiers MUST be UUID v4 strings.

### Coordinates

- All PDF coordinates are **normalized (0–1)** relative to page width/height.  
- Origin `(0,0)` is **top-left** of the page.

### Immutability

- Anchors and alignments are immutable once created.  
- Notes are mutable.  
- Deletion is logical (soft delete).

---

## 2\. Document

Represents a file stored in Google Drive.

{

  "documentId": "uuid",

  "driveFileId": "string",

  "filename": "string",

  "mimeType": "application/pdf | text/markdown",

  "pageCount": 0,

  "isOriginal": "boolean (optional)",

  "createdAt": "ISO-8601",

  "updatedAt": "ISO-8601"

}

### 2.1 Document Registry (Persistent Mapping)

Documents MUST have a stable UUID across sessions. The registry maps
`driveFileId` to `documentId` and stores metadata for lookups.

{

  "documentId": "uuid",

  "driveFileId": "string (unique)",

  "filename": "string",

  "mimeType": "application/pdf | text/markdown",

  "pageCount": 0,

  "isOriginal": "boolean (optional)",

  "createdAt": "ISO-8601",

  "updatedAt": "ISO-8601"

}

### Constraints

- `driveFileId` MUST be unique  
- `documentId` MUST remain stable for a given Drive file  

---

## 3\. Anchor (Primary Spatial Reference)

An anchor binds a PDF location to either text or a freeform region.

{

  "anchorId": "uuid",

  "documentId": "uuid",

  "page": 0,

  "rect": {

    "x": 0.0,

    "y": 0.0,

    "w": 0.0,

    "h": 0.0

  },

  "kind": "text | region",

  "quote": "string (optional)",

  "quoteHash": "sha256 (optional)",

  "label": "string (optional)",

  "rowNumber": "number (optional)",

  "createdAt": "ISO-8601"

}

### Constraints

- For `kind: "text"`:
  - `quote` is required  
  - `quoteHash` MUST be computed from `quote` (normalized whitespace)  
  - `rect` SHOULD approximately enclose the quoted text  
- For `kind: "region"`:
  - `rect` is authoritative and may cover whitespace  
  - `quote` MAY be empty or omitted  
- Anchors MUST survive re-rendering and zoom changes

---

## 4\. Note (User Annotation)

Notes attach interpretive content to anchors.

{

  "noteId": "uuid",

  "anchorId": "uuid",

  "markdown": "string",

  "tags": \["string"\],

  "createdAt": "ISO-8601",

  "updatedAt": "ISO-8601",

  "deleted": false

}

### Constraints

- Notes MUST reference exactly one anchor  
- Editing a note MUST NOT alter the anchor

---

## 5\. Alignment (Semantic Correspondence)

Defines a directed semantic link between two anchors.

{

  "alignmentId": "uuid",

  "sourceAnchorId": "uuid",

  "targetAnchorId": "uuid",

  "sourceAnchorIds": ["uuid"],

  "targetAnchorIds": ["uuid"],

  "type": "translation | paraphrase | commentary | allusion",

  "alignment_type": "string",

  "confidence": 0.0,

  "createdAt": "ISO-8601"

}

### Constraints

- Source and target anchors MUST belong to different documents  
- Alignments are immutable once created  
- Confidence ∈ \[0.0, 1.0\]
- `sourceAnchorIds`/`targetAnchorIds` MAY list multi-chunk alignments; the singular IDs remain the primary anchor for backward compatibility  
- `alignment_type` stores the original JSONL alignment type (e.g., "1-1", "2-1")

---

## 6\. Alignment Group (Optional Aggregation)

Used when multiple anchors correspond as a unit (e.g. tercets).

{

  "groupId": "uuid",

  "anchorIds": \["uuid"\],

  "label": "string",

  "createdAt": "ISO-8601"

}

---

## 7\. Sync-Scroll Map

Defines how scrolling propagates between aligned documents.

{

  "mapId": "uuid",

  "sourceAnchorId": "uuid",

  "targetAnchorId": "uuid",

  "offset": {

    "sourceY": 0.0,

    "targetY": 0.0

  }

}

### Constraint

Visual drift MUST NOT exceed 20px.

---

## 8\. Vector Record (RAG Unit)

Atomic unit stored in the vector database.

{

  "vectorId": "uuid",

  "text": "string",

  "embeddingModel": "string",

  "metadata": {

    "documentId": "uuid",

    "anchorId": "uuid",

    "noteId": "uuid | null",

    "alignmentId": "uuid | null",

    "type": "anchor | note | alignment"

  },

  "createdAt": "ISO-8601"

}

### Constraints

- Each vector MUST reference exactly one anchor  
- Vector text MUST be traceable to on-screen content

---

## 9\. AI Audit Input Contract

All AI calls MUST use this structure.

{

  "task": "audit | explain | compare",

  "anchors": \[

    {

      "anchorId": "uuid",

      "quote": "string",

      "documentId": "uuid"

    }

  \],

  "notes": \[

    {

      "noteId": "uuid",

      "markdown": "string"

    }

  \]

}

### Hard rule

- No anchor → no AI call  
- Free-text prompting is forbidden

---

## 10\. Deletion Semantics

- **Anchors**: never physically deleted  
- **Notes**: soft delete (`deleted: true`)  
- **Alignments**: never deleted, only deprecated (future)

---

## 11\. Schema Stability Rules

- No field renaming without migration  
- No implicit defaults  
- Optional fields MUST be explicit (`null`)

---

## 12\. Rationale (Non-normative)

These schemas guarantee:

- citation-grade traceability  
- alignment-aware AI reasoning  
- reproducible scholarly workflows
