import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  LanguageChunk,
  AlignmentPair,
  ParsedAlignmentData,
  Anchor,
  Alignment,
  AlignmentType,
  UUID,
  NormalizedRect,
} from "@/types/schemas";
import { generateUUID, computeQuoteHash, getCurrentTimestamp } from "@/lib/utils";

/**
 * Parse JSONL file (one JSON object per line)
 * @param file - File object containing JSONL data
 * @returns Array of parsed objects
 */
export async function parseJSONL<T>(file: File): Promise<T[]> {
  const text = await file.text();
  let normalizedText = text;

  // Handle cached files saved as JSON strings or arrays.
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      normalizedText = parsed;
    } else if (Array.isArray(parsed)) {
      return parsed as T[];
    } else if (parsed && typeof parsed === "object") {
      return [parsed as T];
    }
  } catch {
    // Not a JSON document; treat as JSONL text.
  }

  const lines = normalizedText.split(/\r?\n/).filter(line => line.trim().length > 0);

  const results: T[] = [];
  for (const line of lines) {
    try {
      let obj = JSON.parse(line) as T | string;
      if (typeof obj === "string") {
        try {
          obj = JSON.parse(obj) as T;
        } catch {
          // Keep original string if it cannot be parsed further.
        }
      }
      results.push(obj as T);
    } catch (error) {
      console.error('Error parsing JSONL line:', line, error);
    }
  }

  return results;
}

/**
 * Convert page label like "001" to integer 1
 */
function asIntPage(page: any): number | null {
  if (page == null) return null;
  const s = String(page).trim();
  if (!s) return null;
  try {
    return parseInt(s, 10);
  } catch {
    return null;
  }
}

/**
 * Build a map from chunk_id to its sequential row_number within its page and language
 * This ensures accurate row numbering regardless of chunk_id gaps
 */
function computeChunkRowNumbers(
  chunks: LanguageChunk[]
): Map<number, number> {
  const chunkIdToRowNumber = new Map<number, number>();

  // Group chunks by page AND language
  const chunksByPageAndLang = new Map<string, LanguageChunk[]>();
  for (const chunk of chunks) {
    const pageInt = asIntPage(chunk.page);
    if (pageInt == null) continue;

    // Create composite key: "page:language"
    const key = `${pageInt}:${chunk.language}`;
    if (!chunksByPageAndLang.has(key)) {
      chunksByPageAndLang.set(key, []);
    }
    chunksByPageAndLang.get(key)!.push(chunk);
  }

  // For each page+language combination, sort chunks by chunk_id and assign sequential row numbers
  for (const [key, pageChunks] of chunksByPageAndLang.entries()) {
    // Sort by chunk_id to get correct order
    pageChunks.sort((a, b) => a.chunk_id - b.chunk_id);

    // Assign sequential row numbers starting from 1
    pageChunks.forEach((chunk, index) => {
      chunkIdToRowNumber.set(chunk.chunk_id, index + 1);
    });
  }

  return chunkIdToRowNumber;
}

/**
 * Parse alignment files and convert to internal schema
 * @param chunksFile - JSONL file with language chunks
 * @param alignmentsFile - JSONL file with alignment pairs
 * @param sourceDocumentId - UUID of source document
 * @param targetDocumentId - UUID of target document
 * @param sourcePDF - Source PDF document (for fallback rect dimensions)
 * @param targetPDF - Target PDF document (for fallback rect dimensions)
 * @returns Parsed anchors and alignments
 */
export async function parseAlignmentFiles(
  chunksFile: File,
  alignmentsFile: File,
  sourceDocumentId: UUID,
  targetDocumentId: UUID,
  sourcePDF: pdfjsLib.PDFDocumentProxy,
  targetPDF: pdfjsLib.PDFDocumentProxy,
  sourceLanguageHint?: string,
  targetLanguageHint?: string
): Promise<ParsedAlignmentData> {
  console.log('Parsing alignment files...');

  // Step 1: Parse language chunks JSONL
  const chunks = await parseJSONL<LanguageChunk>(chunksFile);
  console.log(`Parsed ${chunks.length} language chunks`);

  // Step 2: Parse alignment pairs JSONL
  const pairs = await parseJSONL<AlignmentPair>(alignmentsFile);
  console.log(`Parsed ${pairs.length} alignment pairs`);

  const validPairs = pairs.filter(
    (pair) => Array.isArray((pair as AlignmentPair).src_chunks) && Array.isArray((pair as AlignmentPair).tgt_chunks)
  ) as AlignmentPair[];
  if (validPairs.length !== pairs.length) {
    console.warn(`Skipping ${pairs.length - validPairs.length} alignment entries without chunk references`);
  }
  if (validPairs.length === 0) {
    throw new Error("No valid alignment pairs found (missing src_chunks/tgt_chunks).");
  }

  // Step 3: Determine source and target languages from alignments
  const sourceLang = sourceLanguageHint || validPairs[0]?.src_lang || 'en';
  const targetLang = targetLanguageHint || validPairs[0]?.tgt_lang || 'it';
  console.log(`Source language: ${sourceLang}, Target language: ${targetLang}`);

  // Step 4: Compute row numbers for all chunks (sequential position within each page)
  const chunkIdToRowNumber = computeChunkRowNumbers(chunks);
  console.log(`Computed row numbers for ${chunkIdToRowNumber.size} chunks`);

  // Step 5: Collect all chunk IDs referenced in alignments
  const referencedChunkIds = new Set<number>();
  validPairs.forEach(pair => {
    const srcChunkIds = pair.src_chunks.map(item =>
      typeof item === 'number' ? item : item.chunk_id
    );
    const tgtChunkIds = pair.tgt_chunks.map(item =>
      typeof item === 'number' ? item : item.chunk_id
    );
    srcChunkIds.forEach(id => referencedChunkIds.add(id));
    tgtChunkIds.forEach(id => referencedChunkIds.add(id));
  });
  console.log(`Found ${referencedChunkIds.size} unique chunks referenced in alignments`);

  // Step 6: Build chunk_id → chunk map (only for referenced chunks)
  const chunkMap = new Map<number, LanguageChunk>();
  chunks.forEach(chunk => {
    if (referencedChunkIds.has(chunk.chunk_id)) {
      chunkMap.set(chunk.chunk_id, chunk);
    }
  });

  // Step 7: Convert referenced chunks to Anchors with row_number
  const sourceAnchors: Anchor[] = [];
  const targetAnchors: Anchor[] = [];
  const chunkToAnchorMap = new Map<number, UUID>();

  console.log('Converting referenced chunks to anchors with row_number...');

  for (const chunk of chunkMap.values()) {
    // Determine which document this chunk belongs to
    const isSourceChunk = chunk.language === sourceLang;
    const documentId = isSourceChunk ? sourceDocumentId : targetDocumentId;
    const pdfDoc = isSourceChunk ? sourcePDF : targetPDF;

    // Get row number from precomputed map
    const rowNumber = chunkIdToRowNumber.get(chunk.chunk_id) ?? undefined;

    const anchor = await chunkToAnchor(chunk, documentId, pdfDoc, rowNumber);

    if (isSourceChunk) {
      sourceAnchors.push(anchor);
    } else {
      targetAnchors.push(anchor);
    }

    chunkToAnchorMap.set(chunk.chunk_id, anchor.anchorId);
  }

  console.log(`Created ${sourceAnchors.length} source anchors, ${targetAnchors.length} target anchors`);

  // Step 8: Convert alignment pairs to Alignments
  const alignments: Alignment[] = [];

  for (const pair of validPairs) {
    // Extract chunk IDs (handle both number[] and LanguageChunk[] formats)
    const srcChunkIds = pair.src_chunks.map(item =>
      typeof item === 'number' ? item : item.chunk_id
    );
    const tgtChunkIds = pair.tgt_chunks.map(item =>
      typeof item === 'number' ? item : item.chunk_id
    );

    // Get anchor IDs from src_chunks and tgt_chunks
    const sourceAnchorIds = srcChunkIds
      .map(chunkId => chunkToAnchorMap.get(chunkId))
      .filter((id): id is UUID => id !== undefined);

    const targetAnchorIds = tgtChunkIds
      .map(chunkId => chunkToAnchorMap.get(chunkId))
      .filter((id): id is UUID => id !== undefined);

    if (sourceAnchorIds.length === 0 || targetAnchorIds.length === 0) {
      console.warn(`Skipping alignment ${pair.alignment_id}: missing chunk references`);
      continue;
    }

    // Store all anchor IDs for multi-chunk alignments (e.g., "2-1", "1-2")
    // Keep first anchor as primary for backward compatibility
    const alignment: Alignment = {
      alignmentId: generateUUID(),
      sourceAnchorId: sourceAnchorIds[0], // Primary anchor (backward compatibility)
      targetAnchorId: targetAnchorIds[0], // Primary anchor (backward compatibility)
      sourceAnchorIds: sourceAnchorIds, // All source anchors
      targetAnchorIds: targetAnchorIds, // All target anchors
      type: mapAlignmentType(pair.alignment_type),
      alignment_type: pair.alignment_type, // Preserve original alignment type (e.g. "1-1", "2-1")
      confidence: pair.validation.confidence || 1.0,
      createdAt: getCurrentTimestamp(),
    };

    alignments.push(alignment);
  }

  console.log(`Created ${alignments.length} alignments`);

  return {
    sourceAnchors,
    targetAnchors,
    alignments,
    chunkMap,
  };
}

/**
 * Convert language chunk to Anchor with row_number
 * @param chunk - Language chunk from JSONL
 * @param documentId - Document UUID
 * @param pdfDoc - PDF document for page dimensions
 * @param rowNumber - Sequential row number within the page (1-based)
 * @returns Anchor with rect coordinates and row_number
 */
async function chunkToAnchor(
  chunk: LanguageChunk,
  documentId: UUID,
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  rowNumber: number | undefined
): Promise<Anchor> {
  const page = parseInt(chunk.page, 10);

  // Use placeholder rect - frontend will compute actual position based on row_number
  // We use a small height placeholder at the top of the page
  const rect: NormalizedRect = {
    x: 0,
    y: 0,
    w: 1,
    h: 0.05, // Small placeholder height
  };

  return {
    anchorId: generateUUID(),
    documentId,
    page,
    rect,
    quote: chunk.text,
    quoteHash: computeQuoteHash(chunk.text),
    rowNumber,
    createdAt: getCurrentTimestamp(),
  };
}

/**
 * Map user's alignment_type string to AlignmentType enum
 * @param alignmentType - String from JSONL (e.g. "1-1", "1-N")
 * @returns AlignmentType enum value
 */
function mapAlignmentType(alignmentType: string): AlignmentType {
  // For now, assume most alignments are translations
  // Can be enhanced with more sophisticated mapping
  return "translation";
}
