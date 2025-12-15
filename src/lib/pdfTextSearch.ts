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
 * Uses fuzzy matching to handle variations in spacing and line breaks
 */
function findTextMatches(searchText: string, textItems: TextItem[]): TextItem[] {
  const normalizedSearch = normalizeText(searchText);
  const matches: TextItem[] = [];

  // Try exact phrase match first
  const fullText = textItems.map(item => item.text).join(' ');
  const normalizedFullText = normalizeText(fullText);

  if (normalizedFullText.includes(normalizedSearch)) {
    // Find all items that contain parts of the search text
    const searchWords = normalizedSearch.split(/\s+/);
    let currentWordIndex = 0;

    for (const item of textItems) {
      const normalizedItem = normalizeText(item.text);

      // Check if this item contains the current search word
      if (currentWordIndex < searchWords.length &&
          normalizedItem.includes(searchWords[currentWordIndex])) {
        matches.push(item);
        currentWordIndex++;
      } else if (matches.length > 0 &&
                 searchWords.slice(currentWordIndex).some(word => normalizedItem.includes(word))) {
        // Item contains part of remaining search text
        matches.push(item);
      }
    }
  }

  // Fallback: match individual words
  if (matches.length === 0) {
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 2);

    for (const item of textItems) {
      const normalizedItem = normalizeText(item.text);
      if (searchWords.some(word => normalizedItem.includes(word))) {
        matches.push(item);
      }
    }
  }

  return matches;
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
