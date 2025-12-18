/**
 * Data Schemas & Contracts — Vinculum
 *
 * All data structures MUST conform to specs/docs/05_DATA_SCHEMAS.md
 * Changes to these schemas require updating 05_DATA_SCHEMAS.md and 09_DECISIONS.md
 */

// ============================================================================
// 1. Identifiers & Conventions
// ============================================================================

/**
 * All primary identifiers MUST be UUID v4 strings
 */
export type UUID = string;

/**
 * Normalized PDF coordinates (0-1) relative to page width/height
 * Origin (0,0) is top-left of the page
 */
export interface NormalizedRect {
  x: number; // 0-1
  y: number; // 0-1
  w: number; // 0-1
  h: number; // 0-1
}

// ============================================================================
// 2. Document
// ============================================================================

export type MimeType = "application/pdf" | "text/markdown";

export interface Document {
  documentId: UUID;
  driveFileId: string;
  filename: string;
  mimeType: MimeType;
  pageCount: number;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

// ============================================================================
// 3. Anchor (Primary Spatial Reference)
// ============================================================================

export interface Anchor {
  anchorId: UUID;
  documentId: UUID;
  page: number;
  rect: NormalizedRect;
  quote: string;
  quoteHash: string; // sha256
  rowNumber?: number; // Line number within page (1-indexed), derived from chunk order in alignments
  createdAt: string; // ISO-8601
}

// ============================================================================
// 4. Note (User Annotation)
// ============================================================================

export interface Note {
  noteId: UUID;
  anchorId: UUID;
  markdown: string;
  tags: string[];
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  deleted: boolean;
}

// ============================================================================
// 5. Alignment (Semantic Correspondence)
// ============================================================================

export type AlignmentType = "translation" | "paraphrase" | "commentary" | "allusion";

export interface Alignment {
  alignmentId: UUID;
  sourceAnchorId: UUID; // Primary source anchor (kept for backward compatibility)
  targetAnchorId: UUID; // Primary target anchor (kept for backward compatibility)
  sourceAnchorIds?: UUID[]; // All source anchors involved in this alignment
  targetAnchorIds?: UUID[]; // All target anchors involved in this alignment
  type: AlignmentType;
  alignment_type?: string; // Original alignment type from JSONL (e.g. "1-1", "2-1", "1-2")
  confidence: number; // 0.0 - 1.0
  createdAt: string; // ISO-8601
}

// ============================================================================
// 6. Alignment Group (Optional Aggregation)
// ============================================================================

export interface AlignmentGroup {
  groupId: UUID;
  anchorIds: UUID[];
  label: string;
  createdAt: string; // ISO-8601
}

// ============================================================================
// 7. Sync-Scroll Map
// ============================================================================

export interface SyncScrollMap {
  mapId: UUID;
  sourceAnchorId: UUID;
  targetAnchorId: UUID;
  offset: {
    sourceY: number;
    targetY: number;
  };
}

// ============================================================================
// 8. Vector Record (RAG Unit)
// ============================================================================

export type VectorRecordType = "anchor" | "note" | "alignment";

export interface VectorRecord {
  vectorId: UUID;
  text: string;
  embeddingModel: string;
  metadata: {
    documentId: UUID;
    anchorId: UUID;
    noteId: UUID | null;
    alignmentId: UUID | null;
    type: VectorRecordType;
  };
  createdAt: string; // ISO-8601
}

// ============================================================================
// 9. AI Audit Input Contract
// ============================================================================

export type AITask = "audit" | "explain" | "compare";

export interface AIAuditInput {
  task: AITask;
  anchors: Array<{
    anchorId: UUID;
    quote: string;
    documentId: UUID;
  }>;
  notes: Array<{
    noteId: UUID;
    markdown: string;
  }>;
}

// ============================================================================
// 10. View Mode & UI State (Phase 2)
// ============================================================================

/**
 * Application view mode
 */
export type ViewMode = 'single' | 'dual';

/**
 * Scroll position tracking for sync scroll
 */
export interface ScrollPosition {
  page: number;
  offsetY: number; // pixels from top of page
  normalizedY: number; // 0-1 within page
}

// ============================================================================
// 11. JSONL Import Formats (Phase 2)
// ============================================================================

/**
 * Language chunk from user's JSONL file
 * Represents a text segment with location metadata
 */
export interface LanguageChunk {
  text: string;
  chunk_id: number;
  language: string; // e.g. "en", "it"
  page: string; // e.g. "001"
}

/**
 * Alignment pair from user's JSONL file
 * Links source and target text chunks with validation data
 */
export interface AlignmentPair {
  alignment_id: number;
  pair_id: number;
  src_text: string;
  tgt_text: string;
  src_lang: string;
  tgt_lang: string;
  alignment_type: string; // e.g. "1-1", "1-N", "N-1", "N-N"
  src_chunks: number[] | LanguageChunk[]; // chunk_id references or full chunk objects
  tgt_chunks: number[] | LanguageChunk[]; // chunk_id references or full chunk objects
  validation: {
    is_valid_alignment: boolean;
    confidence: number;
    reason: string;
    validation_success: boolean;
    error: string | null;
  };
}

/**
 * Result of parsing alignment JSONL files
 */
export interface ParsedAlignmentData {
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  chunkMap: Map<number, LanguageChunk>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper for creating new entities with required fields
 */
export type CreateDocument = Omit<Document, "documentId" | "createdAt" | "updatedAt">;
export type CreateAnchor = Omit<Anchor, "anchorId" | "createdAt" | "quoteHash">;
export type CreateNote = Omit<Note, "noteId" | "createdAt" | "updatedAt" | "deleted">;
export type CreateAlignment = Omit<Alignment, "alignmentId" | "createdAt">;
