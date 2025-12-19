/**
 * JSONL Cache Service
 * Manages caching of generated JSONL files in Google Drive.
 * Uses SHA-256 hashing of PDF content to identify cached files.
 */

import crypto from "crypto";
import { DriveService } from "./drive";

export interface CachedJSONL {
  chunks: {
    driveFileId: string;
    filename: string;
    hash: string;
    count: number;
  } | null;
  alignments: Array<{
    driveFileId: string;
    filename: string;
    sourceLang: string;
    targetLang: string;
    count: number;
  }>;
}

export interface AlignmentRun {
  source: string;
  targets: string[];
}

export interface CacheMetadata {
  pdfHashes: Record<string, string>; // language -> hash
  chunksFileId: string;
  chunksFilename: string;
  chunksCount: number;
  alignments: Array<{
    fileId: string;
    filename: string;
    sourceLang: string;
    targetLang: string;
    count: number;
  }>;
  createdAt: string;
  config: {
    textField: string;
    metadataFields: string[];
    alignmentRuns?: AlignmentRun[];
  };
}

const CACHE_FOLDER = "Cache";

/**
 * Compute SHA-256 hash of file content
 */
export function hashFileContent(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  return crypto.createHash("sha256").update(uint8Array).digest("hex");
}

/**
 * Get cache key for a set of PDFs
 */
function normalizeAlignmentRuns(runs?: AlignmentRun[]): AlignmentRun[] {
  if (!runs) return [];
  return runs
    .map((run) => ({
      source: run.source,
      targets: [...run.targets].sort(),
    }))
    .sort((a, b) => {
      const sourceCompare = a.source.localeCompare(b.source);
      if (sourceCompare !== 0) return sourceCompare;
      return a.targets.join(",").localeCompare(b.targets.join(","));
    });
}

export function getCacheKey(
  pdfHashes: Record<string, string>,
  alignmentRuns?: AlignmentRun[]
): string {
  // Sort languages alphabetically for consistent key
  const sortedLangs = Object.keys(pdfHashes).sort();
  const hashParts = sortedLangs.map((lang) => `${lang}:${pdfHashes[lang]}`);
  const normalizedRuns = normalizeAlignmentRuns(alignmentRuns);
  if (normalizedRuns.length > 0) {
    hashParts.push(`align:${JSON.stringify(normalizedRuns)}`);
  }
  return crypto
    .createHash("sha256")
    .update(hashParts.join("|"))
    .digest("hex")
    .substring(0, 16);
}

/**
 * Check if cached JSONL files exist for given PDFs
 */
export async function checkCache(
  drive: DriveService,
  pdfHashes: Record<string, string>,
  textField: string = "text",
  metadataFields: string[] = ["chunk_id", "language", "page"],
  alignmentRuns?: AlignmentRun[]
): Promise<CachedJSONL | null> {
  try {
    const cacheKey = getCacheKey(pdfHashes, alignmentRuns);
    const metadataFilename = `${cacheKey}_metadata.json`;

    // Try to load metadata file
    const metadata = await drive.loadMetadata(
      `${CACHE_FOLDER}/${metadataFilename}`
    );

    if (!metadata) {
      return null;
    }

    const cacheMetadata = metadata as CacheMetadata;

    // Verify configuration matches
    if (
      cacheMetadata.config.textField !== textField ||
      JSON.stringify(cacheMetadata.config.metadataFields.sort()) !==
        JSON.stringify(metadataFields.sort())
    ) {
      // Configuration mismatch, cache invalid
      return null;
    }
    const normalizedRuns = normalizeAlignmentRuns(alignmentRuns);
    const cachedRuns = normalizeAlignmentRuns(cacheMetadata.config.alignmentRuns);
    if (JSON.stringify(normalizedRuns) !== JSON.stringify(cachedRuns)) {
      return null;
    }

    // Verify PDF hashes match
    const cachedHashes = cacheMetadata.pdfHashes;
    for (const [lang, hash] of Object.entries(pdfHashes)) {
      if (cachedHashes[lang] !== hash) {
        return null; // Hash mismatch
      }
    }

    // Cache is valid, return cached file info
    return {
      chunks: {
        driveFileId: cacheMetadata.chunksFileId,
        filename: cacheMetadata.chunksFilename,
        hash: cacheKey,
        count: cacheMetadata.chunksCount,
      },
      alignments: cacheMetadata.alignments.map((a) => ({
        driveFileId: a.fileId,
        filename: a.filename,
        sourceLang: a.sourceLang,
        targetLang: a.targetLang,
        count: a.count,
      })),
    };
  } catch (error) {
    console.error("Error checking cache:", error);
    return null;
  }
}

/**
 * Save JSONL files to cache
 */
export async function saveToCache(
  drive: DriveService,
  pdfHashes: Record<string, string>,
  chunksFile: { content: string; count: number },
  alignmentFiles: Array<{
    content: string;
    sourceLang: string;
    targetLang: string;
    count: number;
  }>,
  textField: string = "text",
  metadataFields: string[] = ["chunk_id", "language", "page"],
  alignmentRuns?: AlignmentRun[]
): Promise<CachedJSONL> {
  const cacheKey = getCacheKey(pdfHashes, alignmentRuns);

  // Save chunks.jsonl
  const chunksFilename = `${cacheKey}_chunks.jsonl`;
  const chunksFileId = await drive.saveMetadata(
    `${CACHE_FOLDER}/${chunksFilename}`,
    chunksFile.content,
    "application/jsonl"
  );

  // Save alignment files
  const alignments = [];
  for (const alignment of alignmentFiles) {
    const alignmentFilename = `${cacheKey}_${alignment.sourceLang}-${alignment.targetLang}.jsonl`;
    const fileId = await drive.saveMetadata(
      `${CACHE_FOLDER}/${alignmentFilename}`,
      alignment.content,
      "application/jsonl"
    );

    alignments.push({
      fileId,
      filename: alignmentFilename,
      sourceLang: alignment.sourceLang,
      targetLang: alignment.targetLang,
      count: alignment.count,
    });
  }

  // Save metadata
  const metadata: CacheMetadata = {
    pdfHashes,
    chunksFileId,
    chunksFilename,
    chunksCount: chunksFile.count,
    alignments,
    createdAt: new Date().toISOString(),
    config: {
      textField,
      metadataFields,
      alignmentRuns: alignmentRuns ? normalizeAlignmentRuns(alignmentRuns) : [],
    },
  };

  const metadataFilename = `${cacheKey}_metadata.json`;
  await drive.saveMetadata(`${CACHE_FOLDER}/${metadataFilename}`, metadata);

  return {
    chunks: {
      driveFileId: chunksFileId,
      filename: chunksFilename,
      hash: cacheKey,
      count: chunksFile.count,
    },
    alignments: alignments.map((a) => ({
      driveFileId: a.fileId,
      filename: a.filename,
      sourceLang: a.sourceLang,
      targetLang: a.targetLang,
      count: a.count,
    })),
  };
}

/**
 * Download cached JSONL file from Drive
 */
export async function downloadCachedFile(
  drive: DriveService,
  driveFileId: string
): Promise<string> {
  const buffer = await drive.downloadFile(driveFileId);
  return Buffer.from(buffer).toString("utf-8");
}
