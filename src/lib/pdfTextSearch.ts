import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { NormalizedRect } from "@/types/schemas";

/**
 * PDF Text Search Utility
 * Locates text within PDF pages and returns normalized bounding boxes
 * Uses legacy build for Node.js compatibility
 */

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Find text in PDF page and return normalized bounding box
 * @param pdfDoc - PDF document proxy
 * @param searchText - Text to search for
 * @param pageNumber - Page number (1-indexed)
 * @returns Normalized rect or null if not found
 */
export async function findTextInPDF(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  searchText: string,
  pageNumber: number
): Promise<NormalizedRect | null> {
  try {
    // Validate page number
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      console.warn(
        `Page ${pageNumber} out of range (PDF has ${pdfDoc.numPages} pages). Skipping.`
      );
      return null;
    }

    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    // Extract text items with positions
    const textItems: TextItem[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.transform) continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const width = item.width || 0;
      const height = item.height || 12;

      // Convert PDF coordinates to viewport coordinates
      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      const [x2, y2] = viewport.convertToViewportPoint(tx + width, ty + height);

      textItems.push({
        text: item.str,
        x: Math.min(x, x2),
        y: Math.min(y, y2),
        width: Math.abs(x2 - x),
        height: Math.abs(y2 - y),
      });
    }

    // Search for text matches
    const matches = findTextMatches(searchText, textItems);

    if (matches.length === 0) {
      console.warn(`Text not found on page ${pageNumber}:`, searchText.substring(0, 50));
      return null;
    }

    // Compute bounding box for all matches
    const boundingBox = computeBoundingBox(matches);

    // Normalize to 0-1 coordinates
    return {
      x: boundingBox.x / viewport.width,
      y: boundingBox.y / viewport.height,
      w: boundingBox.width / viewport.width,
      h: boundingBox.height / viewport.height,
    };
  } catch (error) {
    console.error(`Error searching text on page ${pageNumber}:`, error);
    return null;
  }
}

/**
 * Find text items that match the search text
 * Uses improved matching to find the best occurrence when text appears multiple times
 */
function findTextMatches(searchText: string, textItems: TextItem[]): TextItem[] {
  const normalizedSearch = normalizeText(searchText);

  // Filter out only very short words, but keep everything else
  const searchWords = normalizedSearch
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (searchWords.length === 0) {
    console.warn('No significant search words found:', searchText.substring(0, 50));
    return [];
  }

  console.log(`Searching for ${searchWords.length} words: "${searchWords.slice(0, 5).join(' ')}..."`);

  // Strategy: Find all possible starting points and score them
  const candidates: { startIndex: number; matchedItems: TextItem[]; score: number; wordsMatched: number }[] = [];

  for (let startIdx = 0; startIdx < textItems.length; startIdx++) {
    const result = tryMatchFromIndex(startIdx, searchWords, textItems);
    if (result.matchedItems.length > 0) {
      candidates.push({
        startIndex: startIdx,
        matchedItems: result.matchedItems,
        score: result.score,
        wordsMatched: result.wordsMatched
      });
    }
  }

  if (candidates.length === 0) {
    // Fallback: match individual words
    console.warn('No sequence match found, falling back to word matching for:', searchText.substring(0, 50));
    return fallbackWordMatch(searchWords, textItems);
  }

  // Return the best match (highest score)
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const percentage = ((best.wordsMatched / searchWords.length) * 100).toFixed(0);
  console.log(`✓ Best match: ${best.wordsMatched}/${searchWords.length} words (${percentage}%), score ${best.score.toFixed(1)}, ${best.matchedItems.length} items`);

  return best.matchedItems;
}

/**
 * Try to match search words starting from a specific index
 */
function tryMatchFromIndex(
  startIdx: number,
  searchWords: string[],
  textItems: TextItem[]
): { matchedItems: TextItem[]; score: number; wordsMatched: number } {
  const matchedItems: TextItem[] = [];
  let wordIdx = 0;
  let consecutiveMatches = 0;
  let totalWordsMatched = 0;
  let gapCount = 0;

  for (let i = startIdx; i < textItems.length && wordIdx < searchWords.length; i++) {
    const normalizedItem = normalizeText(textItems[i].text);
    const itemWords = normalizedItem.split(/\s+/).filter(w => w.length > 0);

    let matched = false;
    for (const itemWord of itemWords) {
      if (wordIdx < searchWords.length) {
        const searchWord = searchWords[wordIdx];

        // Try multiple matching strategies:
        // 1. Exact match
        // 2. One contains the other (handles partial words)
        // 3. Fuzzy match for typos/OCR errors (Levenshtein distance <= 2 for words > 4 chars)
        const isExactMatch = itemWord === searchWord;
        const isPartialMatch = itemWord.includes(searchWord) || searchWord.includes(itemWord);
        const isFuzzyMatch = searchWord.length > 4 && itemWord.length > 4 &&
                             levenshteinDistance(itemWord, searchWord) <= 2;

        if (isExactMatch || isPartialMatch || isFuzzyMatch) {
          if (!matchedItems.includes(textItems[i])) {
            matchedItems.push(textItems[i]);
          }
          wordIdx++;
          totalWordsMatched++;
          consecutiveMatches++;
          matched = true;
          gapCount = 0;
          break;
        }
      }
    }

    // If we didn't match but we've started matching, allow gaps
    if (!matched && matchedItems.length > 0) {
      gapCount++;
      // Allow up to 5 items gap (for line breaks, etc)
      if (gapCount > 5) {
        break;
      }
    }
  }

  // Score based on:
  // 1. Percentage of search words matched
  // 2. Consecutiveness of matches
  // 3. Penalty for gaps
  const completeness = totalWordsMatched / searchWords.length;
  const score = (completeness * 100) + (consecutiveMatches * 5) - (gapCount * 2);

  // Only return if we matched at least 40% and at least 3 words
  // This is more lenient to handle OCR errors and text variations
  if (completeness < 0.4 || totalWordsMatched < 3) {
    return { matchedItems: [], score: 0, wordsMatched: 0 };
  }

  return { matchedItems, score, wordsMatched: totalWordsMatched };
}

/**
 * Fallback: match items containing any of the search words
 * Try to find the best contiguous sequence
 */
function fallbackWordMatch(searchWords: string[], textItems: TextItem[]): TextItem[] {
  // Find all items that contain any search word
  const matchingIndices: number[] = [];

  for (let i = 0; i < textItems.length; i++) {
    const normalizedItem = normalizeText(textItems[i].text);
    if (searchWords.some(word => normalizedItem.includes(word))) {
      matchingIndices.push(i);
    }
  }

  if (matchingIndices.length === 0) {
    console.warn('No matching words found at all');
    return [];
  }

  // Find sequences with different gap tolerances and score them
  const sequences: { start: number; length: number; actualIndices: number[] }[] = [];

  // Try with gap tolerance of 2 (tight)
  sequences.push(...findSequences(matchingIndices, 2));
  // Try with gap tolerance of 3 (medium)
  sequences.push(...findSequences(matchingIndices, 3));

  if (sequences.length === 0) {
    console.warn('No sequences found');
    return [];
  }

  // Pick the sequence that best matches the search length (not too long, not too short)
  const targetLength = Math.ceil(searchWords.length * 1.5); // Allow 50% extra for gaps
  let bestSequence = sequences[0];
  let bestScore = Math.abs(bestSequence.actualIndices.length - targetLength);

  for (const seq of sequences) {
    const actualLength = seq.actualIndices.length;
    // Penalize sequences that are too long
    const lengthPenalty = actualLength > targetLength ? (actualLength - targetLength) * 2 : 0;
    const score = Math.abs(actualLength - targetLength) + lengthPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestSequence = seq;
    }
  }

  // Get the actual text items, but limit to 10 items max for tighter highlights
  const maxItems = Math.min(10, Math.ceil(searchWords.length * 1.5));
  const indices = bestSequence.actualIndices.slice(0, maxItems);
  const matches: TextItem[] = indices.map(i => textItems[i]);

  console.log(`Fallback: found ${matches.length} items (from ${bestSequence.actualIndices.length} candidates, max=${maxItems})`);
  return matches;
}

/**
 * Find contiguous sequences with a given gap tolerance
 */
function findSequences(matchingIndices: number[], gapTolerance: number): { start: number; length: number; actualIndices: number[] }[] {
  const sequences: { start: number; length: number; actualIndices: number[] }[] = [];
  let currentStart = 0;
  let currentIndices = [matchingIndices[0]];

  for (let i = 1; i < matchingIndices.length; i++) {
    if (matchingIndices[i] - matchingIndices[i - 1] <= gapTolerance) {
      currentIndices.push(matchingIndices[i]);
    } else {
      sequences.push({
        start: currentStart,
        length: currentIndices.length,
        actualIndices: [...currentIndices]
      });
      currentStart = i;
      currentIndices = [matchingIndices[i]];
    }
  }

  // Add last sequence
  sequences.push({
    start: currentStart,
    length: currentIndices.length,
    actualIndices: currentIndices
  });

  return sequences;
}

/**
 * Normalize text for comparison (lowercase, remove extra whitespace)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute bounding box that encompasses all text items
 */
function computeBoundingBox(items: TextItem[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (items.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Compute Levenshtein distance for fuzzy matching
 * Used for advanced text matching when exact match fails
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
