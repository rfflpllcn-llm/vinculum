# Phase 2 Implementation Plan - Vinculum

## Overview
Implement Phase 2 features: Dual PDF View, Sync Scroll, Alignment JSON Parser, and AI Audit Modal.

## User Requirements
- **View Mode**: Toggle between single PDF (existing) and dual PDF view
- **Alignment Source**: Load from existing JSONL files (no manual creation UI)
- **AI Provider**: OpenAI GPT-4
- **JSONL Format**:
  - Language chunks: `{"text": "...", "chunk_id": N, "language": "en/it", "page": "001"}`
  - Alignments: `{"alignment_id": N, "src_text": "...", "tgt_text": "...", "src_chunks": [ids], "tgt_chunks": [ids], "validation": {...}}`

## Phase 2 Requirements (from specs)
- [ ] Dual PDF view (side-by-side)
- [ ] Sync scroll (≤20px drift)
- [ ] Alignment JSON parser
- [ ] AI audit modal (aligned anchors only)

---

## Implementation Steps

### Step 1: Type Definitions & Schema Extensions
**File**: `/src/types/schemas.ts`

Add new types:
```typescript
// View mode
export type ViewMode = 'single' | 'dual';

// User's JSONL format
export interface LanguageChunk {
  text: string;
  chunk_id: number;
  language: string;
  page: string;
}

export interface AlignmentPair {
  alignment_id: number;
  pair_id: number;
  src_text: string;
  tgt_text: string;
  src_lang: string;
  tgt_lang: string;
  alignment_type: string;
  src_chunks: number[];
  tgt_chunks: number[];
  validation: {
    is_valid_alignment: boolean;
    confidence: number;
    reason: string;
    validation_success: boolean;
    error: string | null;
  };
}

// Scroll position
export interface ScrollPosition {
  page: number;
  offsetY: number;
  normalizedY: number;
}
```

---

### Step 2: Alignment Parser & PDF Text Search

**File**: `/src/lib/alignmentParser.ts` (NEW)

Core functions:
- `parseJSONL<T>(file: File): Promise<T[]>` - Parse JSONL line by line
- `parseAlignmentFiles(chunksFile, alignmentsFile, sourceDocId, targetDocId)` - Main parser
- `chunkToAnchor(chunk, documentId)` - Convert chunk to Anchor with text search
- Returns: `{ sourceAnchors: Anchor[], targetAnchors: Anchor[], alignments: Alignment[] }`

**File**: `/src/lib/pdfTextSearch.ts` (NEW)

- `findTextInPDF(pdfDoc, searchText, page): Promise<NormalizedRect | null>`
- Uses `pdfjs-dist` `getTextContent()` to locate text
- Returns normalized bounding box

**Key Challenge**: User's JSONL doesn't have `rect` coordinates. Must search PDF for text and compute rect dynamically.

---

### Step 3: API Endpoints

**File**: `/src/app/api/alignments/upload/route.ts` (NEW)

```typescript
POST /api/alignments/upload
- Accept FormData with: chunksFile, alignmentsFile, sourceDocId, targetDocId
- Parse JSONL files
- Search PDF for text locations
- Save anchors and alignments to Google Drive
- Return counts
```

**File**: `/src/app/api/alignments/route.ts` (NEW)

```typescript
GET /api/alignments?sourceDocId=X&targetDocId=Y
- List all alignment_*.json files from Drive
- Filter by document IDs
- Return alignments array
```

**File**: `/src/app/api/ai/audit/route.ts` (NEW)

```typescript
POST /api/ai/audit
- Accept AIAuditInput (anchors, notes)
- Call OpenAI GPT-4
- Return formatted result with anchor references
```

**File**: `/src/lib/openai.ts` (NEW)

- `auditAlignment(input: AIAuditInput): Promise<string>`
- Uses OpenAI SDK (`npm install openai`)
- Requires `OPENAI_API_KEY` env var
- Returns markdown with `[anchor:anchorId]` references

**File**: `/src/lib/drive.ts` (MODIFY)

Add method to list all metadata files:
```typescript
async listMetadataFiles(pattern: string): Promise<string[]>
```

---

### Step 4: Enhanced PDFViewer Component

**File**: `/src/components/PDFViewer.tsx` (MODIFY)

Add new props:
```typescript
interface PDFViewerProps {
  // ... existing props
  externalScrollPosition?: ScrollPosition;
  onScroll?: (position: ScrollPosition) => void;
  readOnly?: boolean; // Disable anchor creation in dual mode
  highlightedAnchors?: Anchor[]; // For alignment visualization
}
```

Changes:
1. Add scroll event listener on containerRef
2. Implement `handleScroll()` to emit current scroll position
3. Respond to `externalScrollPosition` changes (for sync scroll)
4. Render highlighted anchors as colored overlays
5. Disable selection if `readOnly={true}`

---

### Step 5: Sync Scroll Hook

**File**: `/src/hooks/useSyncScroll.ts` (NEW)

```typescript
interface UseSyncScrollParams {
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  enabled: boolean;
}

function useSyncScroll({...}): {
  handleSourceScroll: (position: ScrollPosition) => void;
  targetScrollPosition: ScrollPosition | null;
  drift: number;
}
```

Algorithm:
1. Find nearest alignment anchor to current scroll position
2. Calculate proportional offset within alignment pair
3. Map to target document coordinates
4. Enforce ≤20px drift constraint
5. Return target scroll position

**Manual scroll override**: Disable sync for 2s after manual target scroll.

---

### Step 6: Dual View Components

**File**: `/src/components/DualDocumentView.tsx` (NEW)

Layout: Side-by-side PDFViewers (50% width each)

Props:
```typescript
interface DualDocumentViewProps {
  sourceDocument: Document;
  targetDocument: Document;
  sourceFileData: ArrayBuffer;
  targetFileData: ArrayBuffer;
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  syncScrollEnabled: boolean;
  onAlignmentSelect: (alignment: Alignment) => void;
}
```

Responsibilities:
- Coordinate sync scroll between two PDFViewers
- Render alignment overlays
- Handle alignment selection for AI audit

**File**: `/src/components/AlignmentVisualization.tsx` (NEW)

- Renders colored rectangles over aligned anchor pairs
- Hover highlights both source and target
- Click to select alignment

---

### Step 7: View Mode Toggle & Page State

**File**: `/src/components/ViewModeToggle.tsx` (NEW)

Simple button to toggle between 'single' and 'dual' view modes.

**File**: `/src/app/page.tsx` (MODIFY)

Enhanced state:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('single');

// Dual mode state
const [sourceDocument, setSourceDocument] = useState<Document | null>(null);
const [targetDocument, setTargetDocument] = useState<Document | null>(null);
const [sourceFileData, setSourceFileData] = useState<ArrayBuffer | null>(null);
const [targetFileData, setTargetFileData] = useState<ArrayBuffer | null>(null);
const [sourceAnchors, setSourceAnchors] = useState<Anchor[]>([]);
const [targetAnchors, setTargetAnchors] = useState<Anchor[]>([]);
const [alignments, setAlignments] = useState<Alignment[]>([]);
const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);
```

Layout changes:
```tsx
{viewMode === 'single' ? (
  // Existing single PDF view
  <PDFViewer ... />
) : (
  // New dual PDF view
  <DualDocumentView ... />
)}
```

Add alignment upload UI:
- File input for chunks JSONL
- File input for alignments JSONL
- Document selectors for source/target
- Upload button → POST to `/api/alignments/upload`

---

### Step 8: AI Audit Modal

**File**: `/src/components/AIAuditModal.tsx` (NEW)

Features:
- Display source and target anchor quotes
- Button to trigger AI audit
- Loading state during API call
- Display result with markdown rendering
- Parse `[anchor:anchorId]` references as clickable links
- Click anchor reference → scroll to location

**File**: `/src/components/Modal.tsx` (NEW)

Generic modal wrapper component for reuse.

---

### Step 9: Integration & Testing

1. Test JSONL upload and parsing with real data
2. Verify anchors created with correct text locations
3. Test dual view layout and rendering
4. Measure sync scroll accuracy (must be ≤20px drift)
5. Test AI audit with various alignment pairs
6. Verify backward compatibility with single view mode

---

## Critical Files Summary

### New Files (13)
1. `/src/lib/alignmentParser.ts` - Parse JSONL files
2. `/src/lib/pdfTextSearch.ts` - Locate text in PDF
3. `/src/lib/openai.ts` - OpenAI API integration
4. `/src/hooks/useSyncScroll.ts` - Sync scroll logic
5. `/src/components/DualDocumentView.tsx` - Dual PDF container
6. `/src/components/AlignmentVisualization.tsx` - Alignment overlays
7. `/src/components/AIAuditModal.tsx` - AI audit UI
8. `/src/components/ViewModeToggle.tsx` - View mode switcher
9. `/src/components/Modal.tsx` - Generic modal
10. `/src/app/api/alignments/upload/route.ts` - Upload JSONL
11. `/src/app/api/alignments/route.ts` - List alignments
12. `/src/app/api/ai/audit/route.ts` - AI audit endpoint
13. `/src/types/alignment.ts` - Alignment-specific types (optional)

### Modified Files (4)
1. `/src/types/schemas.ts` - Add new types
2. `/src/components/PDFViewer.tsx` - Scroll control, read-only mode
3. `/src/app/page.tsx` - Dual view state and layout
4. `/src/lib/drive.ts` - List metadata files method

---

## Environment Variables

Add to `.env.local`:
```
OPENAI_API_KEY=sk-...
```

## Dependencies

Install:
```bash
npm install openai
```

---

## Technical Challenges

### 1. PDF Text Search Accuracy
**Problem**: JSONL has text but no rect coordinates.

**Solution**:
- Use `getTextContent()` from pdfjs-dist
- Implement fuzzy text matching (Levenshtein distance)
- Aggregate bounding boxes for multi-line chunks
- Fallback to whole-page rect if no match

### 2. Sync Scroll Drift Constraint
**Problem**: Must stay ≤20px drift.

**Solution**:
- Track viewport dimensions for pixel/normalized conversion
- Apply constraint in pixel space
- Test extensively with different zoom levels

### 3. JSONL Chunk-to-Anchor Mapping
**Problem**: `chunk_id` references need to be resolved.

**Solution**:
- Build chunk_id → Anchor map during parsing
- Use map to resolve src_chunks/tgt_chunks to anchorIds

---

## Implementation Order

1. **Types & Schemas** (Step 1) - Foundation
2. **Alignment Parser** (Step 2) - Data ingestion
3. **API Endpoints** (Step 3) - Backend ready
4. **Enhanced PDFViewer** (Step 4) - Scroll control
5. **Sync Scroll Hook** (Step 5) - Core algorithm
6. **Dual View Components** (Step 6) - UI layout
7. **View Toggle & State** (Step 7) - Integration
8. **AI Audit** (Step 8) - AI features
9. **Testing** (Step 9) - Validation

---

## Success Criteria

- [ ] Can upload JSONL files and create anchors/alignments
- [ ] Can toggle between single and dual PDF view
- [ ] Sync scroll works with ≤20px drift
- [ ] Manual scroll override and re-enable works
- [ ] Alignment visualization shows colored overlays
- [ ] AI audit calls OpenAI and returns formatted results
- [ ] Anchor references in audit are clickable
- [ ] Single view mode still works (backward compatible)

---

## Notes

- Maintain backward compatibility with Phase 1 (single view default)
- User has specific JSONL format - must parse correctly
- Text search is critical since JSONL lacks rect coordinates
- OpenAI API key required for AI audit
- Sync scroll is performance-sensitive (≤16ms/frame for smooth scrolling)
