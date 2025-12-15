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
import { findTextByEmbedding } from "@/lib/embeddingSearch";

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
 * Parse alignment files and convert to internal schema
 * @param chunksFile - JSONL file with language chunks
 * @param alignmentsFile - JSONL file with alignment pairs
 * @param sourceDocumentId - UUID of source document
 * @param targetDocumentId - UUID of target document
 * @param sourcePDF - Source PDF document (for text search)
 * @param targetPDF - Target PDF document (for text search)
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

  // Step 4: Collect all chunk IDs referenced in alignments
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

  // Step 5: Build chunk_id → chunk map (only for referenced chunks)
  const chunkMap = new Map<number, LanguageChunk>();
  chunks.forEach(chunk => {
    if (referencedChunkIds.has(chunk.chunk_id)) {
      chunkMap.set(chunk.chunk_id, chunk);
    }
  });

  // Step 6: Convert referenced chunks to Anchors
  const sourceAnchors: Anchor[] = [];
  const targetAnchors: Anchor[] = [];
  const chunkToAnchorMap = new Map<number, UUID>();

  console.log('Converting referenced chunks to anchors with text search...');

  for (const chunk of chunkMap.values()) {
    // Determine which document this chunk belongs to
    const isSourceChunk = chunk.language === sourceLang;
    const documentId = isSourceChunk ? sourceDocumentId : targetDocumentId;
    const pdfDoc = isSourceChunk ? sourcePDF : targetPDF;

    const anchor = await chunkToAnchor(chunk, documentId, pdfDoc);

    if (isSourceChunk) {
      sourceAnchors.push(anchor);
    } else {
      targetAnchors.push(anchor);
    }

    chunkToAnchorMap.set(chunk.chunk_id, anchor.anchorId);
  }

  console.log(`Created ${sourceAnchors.length} source anchors, ${targetAnchors.length} target anchors`);

  // Step 7: Convert alignment pairs to Alignments
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
 * Convert language chunk to Anchor with PDF text search
 * @param chunk - Language chunk from JSONL
 * @param documentId - Document UUID
 * @param pdfDoc - PDF document for text search
 * @returns Anchor with rect coordinates
 */
async function chunkToAnchor(
  chunk: LanguageChunk,
  documentId: UUID,
  pdfDoc: pdfjsLib.PDFDocumentProxy
): Promise<Anchor> {
  const page = parseInt(chunk.page, 10);

  // Search for text in PDF using embeddings to get rect
  let rect: NormalizedRect | null = null;

  try {
    rect = await findTextByEmbedding(pdfDoc, chunk.text, page);
  } catch (error) {
    console.error(`Error searching text for chunk ${chunk.chunk_id}:`, error);
  }

  // Fallback: use full page width if text not found
  if (!rect) {
    console.warn(`Text not found for chunk ${chunk.chunk_id}, using full page width`);
    rect = {
      x: 0,
      y: 0,
      w: 1,
      h: 0.05, // Small height as placeholder
    };
  }

  return {
    anchorId: generateUUID(),
    documentId,
    page,
    rect,
    quote: chunk.text,
    quoteHash: computeQuoteHash(chunk.text),
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
