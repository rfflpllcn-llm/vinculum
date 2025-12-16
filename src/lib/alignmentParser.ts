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
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  const results: T[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as T;
      results.push(obj);
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
 * Precompute the maximum chunk_id for each page
 * Used to derive row_number for chunks
 */
function computeLastChunkIdByPage(
  pairs: AlignmentPair[],
  chunkKey: 'src_chunks' | 'tgt_chunks'
): Map<number, number> {
  const lastByPage = new Map<number, number>();

  for (const pair of pairs) {
    const chunks = pair[chunkKey] || [];
    for (const item of chunks) {
      const chunk = typeof item === 'number' ? null : item;
      if (!chunk) continue;

      const pageInt = asIntPage(chunk.page);
      if (pageInt == null) continue;

      const chunkId = chunk.chunk_id;
      const prev = lastByPage.get(pageInt);
      if (prev == null || chunkId > prev) {
        lastByPage.set(pageInt, chunkId);
      }
    }
  }

  return lastByPage;
}

/**
 * Compute row_number for a chunk
 * row_number = min(chunk_ids) - last_chunk_id_of_prev_page
 */
function computeRowNumber(
  chunkIds: number[],
  page: number,
  lastByPage: Map<number, number>
): number | null {
  if (chunkIds.length === 0) return null;

  const minChunkId = Math.min(...chunkIds);
  const prevPageLastChunkId = lastByPage.get(page - 1) ?? -1;

  return minChunkId - prevPageLastChunkId;
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
  targetPDF: pdfjsLib.PDFDocumentProxy
): Promise<ParsedAlignmentData> {
  console.log('Parsing alignment files...');

  // Step 1: Parse language chunks JSONL
  const chunks = await parseJSONL<LanguageChunk>(chunksFile);
  console.log(`Parsed ${chunks.length} language chunks`);

  // Step 2: Parse alignment pairs JSONL
  const pairs = await parseJSONL<AlignmentPair>(alignmentsFile);
  console.log(`Parsed ${pairs.length} alignment pairs`);

  // Step 3: Determine source and target languages from alignments
  const sourceLang = pairs[0]?.src_lang || 'en';
  const targetLang = pairs[0]?.tgt_lang || 'it';
  console.log(`Source language: ${sourceLang}, Target language: ${targetLang}`);

  // Step 4: Precompute per-page max chunk_id for both languages
  const lastByPageSrc = computeLastChunkIdByPage(pairs, 'src_chunks');
  const lastByPageTgt = computeLastChunkIdByPage(pairs, 'tgt_chunks');
  console.log(`Precomputed chunk maxima for ${lastByPageSrc.size} source pages, ${lastByPageTgt.size} target pages`);

  // Step 5: Collect all chunk IDs referenced in alignments
  const referencedChunkIds = new Set<number>();
  pairs.forEach(pair => {
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
    const lastByPage = isSourceChunk ? lastByPageSrc : lastByPageTgt;

    const anchor = await chunkToAnchor(chunk, documentId, pdfDoc, lastByPage);

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

  for (const pair of pairs) {
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

    // For simplicity, use first anchor from each side
    // (Multi-chunk alignments could be handled with AlignmentGroup in future)
    const alignment: Alignment = {
      alignmentId: generateUUID(),
      sourceAnchorId: sourceAnchorIds[0],
      targetAnchorId: targetAnchorIds[0],
      type: mapAlignmentType(pair.alignment_type),
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
 * @param lastByPage - Map of page number to last chunk_id on that page
 * @returns Anchor with rect coordinates and row_number
 */
async function chunkToAnchor(
  chunk: LanguageChunk,
  documentId: UUID,
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  lastByPage: Map<number, number>
): Promise<Anchor> {
  const page = parseInt(chunk.page, 10);

  // Compute row_number for this chunk
  const rowNumber = computeRowNumber([chunk.chunk_id], page, lastByPage);

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
    rowNumber: rowNumber ?? undefined,
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
