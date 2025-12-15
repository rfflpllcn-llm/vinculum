import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { NormalizedRect } from "@/types/schemas";
import { pipeline } from '@xenova/transformers';

/**
 * Embedding-based PDF Text Search
 * Uses sentence transformers to find semantically similar text
 */

interface TextWindow {
  text: string;
  startIdx: number;
  endIdx: number;
  items: TextItem[];
}

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Cache the embedding model
let embeddingModel: any = null;

async function getEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model (all-MiniLM-L6-v2)...');
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✓ Embedding model loaded');
  }
  return embeddingModel;
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Mean pooling to get sentence embedding
 */
function meanPooling(output: any): number[] {
  const embeddings = output.tolist()[0];
  const mean = new Array(embeddings[0].length).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < embedding.length; i++) {
      mean[i] += embedding[i];
    }
  }

  for (let i = 0; i < mean.length; i++) {
    mean[i] /= embeddings.length;
  }

  return mean;
}

/**
 * Create sliding windows of text
 * @param words - Array of words
 * @param windowSize - Number of words per window (default 50)
 * @param overlap - Overlap percentage (default 0.5 = 50%)
 */
function createSlidingWindows(words: string[], windowSize: number = 50, overlap: number = 0.5): string[] {
  const windows: string[] = [];
  const step = Math.floor(windowSize * (1 - overlap));

  for (let i = 0; i < words.length; i += step) {
    const window = words.slice(i, i + windowSize);
    if (window.length >= Math.floor(windowSize * 0.3)) { // At least 30% of window size
      windows.push(window.join(' '));
    }
  }

  return windows;
}

/**
 * Find text in PDF using embedding-based similarity search
 * @param pdfDoc - PDF document proxy
 * @param searchText - Text to search for
 * @param pageNumber - Page number (1-indexed)
 * @returns Normalized rect or null if not found
 */
export async function findTextByEmbedding(
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

    console.log(`Searching page ${pageNumber} with embeddings: "${searchText.substring(0, 50)}..."`);

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

    // Get all text as words
    const allText = textItems.map(item => item.text).join(' ');
    const words = allText.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      console.warn('No text found on page');
      return null;
    }

    // Create sliding windows
    const windows = createSlidingWindows(words, 50, 0.5);
    console.log(`Created ${windows.length} sliding windows`);

    // Get embedding model
    const model = await getEmbeddingModel();

    // Embed search text
    const searchEmbedding = await model(searchText, { pooling: 'mean', normalize: true });
    const searchVector = Array.from(searchEmbedding.data) as number[];

    // Embed all windows and find best match
    let bestWindowIdx = -1;
    let bestSimilarity = -1;

    for (let i = 0; i < windows.length; i++) {
      const windowEmbedding = await model(windows[i], { pooling: 'mean', normalize: true });
      const windowVector = Array.from(windowEmbedding.data) as number[];
      const similarity = cosineSimilarity(searchVector, windowVector);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestWindowIdx = i;
      }
    }

    console.log(`Best match: window ${bestWindowIdx}, similarity ${(bestSimilarity * 100).toFixed(1)}%`);

    if (bestWindowIdx === -1 || bestSimilarity < 0.5) {
      console.warn('No good match found (similarity < 50%)');
      return null;
    }

    // Calculate word range for best window
    const step = Math.floor(50 * 0.5); // 50% overlap
    const startWordIdx = bestWindowIdx * step;
    const endWordIdx = Math.min(startWordIdx + 50, words.length);

    // Map words back to text items to get bounding box
    const matchedItems = getTextItemsForWordRange(textItems, words, startWordIdx, endWordIdx);

    if (matchedItems.length === 0) {
      console.warn('Could not map words to text items');
      return null;
    }

    // Compute bounding box
    const boundingBox = computeBoundingBox(matchedItems);

    // Normalize to 0-1 coordinates
    return {
      x: boundingBox.x / viewport.width,
      y: boundingBox.y / viewport.height,
      w: boundingBox.width / viewport.width,
      h: boundingBox.height / viewport.height,
    };
  } catch (error) {
    console.error(`Error in embedding search on page ${pageNumber}:`, error);
    return null;
  }
}

/**
 * Map word range back to text items
 */
function getTextItemsForWordRange(
  textItems: TextItem[],
  words: string[],
  startWordIdx: number,
  endWordIdx: number
): TextItem[] {
  const targetWords = words.slice(startWordIdx, endWordIdx);
  const matchedItems: TextItem[] = [];

  let wordIdx = 0;
  let itemIdx = 0;

  while (itemIdx < textItems.length && wordIdx < words.length) {
    const itemWords = textItems[itemIdx].text.split(/\s+/).filter(w => w.length > 0);

    for (const itemWord of itemWords) {
      if (wordIdx >= startWordIdx && wordIdx < endWordIdx) {
        if (!matchedItems.includes(textItems[itemIdx])) {
          matchedItems.push(textItems[itemIdx]);
        }
      }
      wordIdx++;
      if (wordIdx >= endWordIdx) break;
    }

    itemIdx++;
  }

  return matchedItems;
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
