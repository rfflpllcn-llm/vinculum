/**
 * PDF Cache using IndexedDB
 * Stores PDF files locally to avoid re-downloading from Google Drive
 */

const DB_NAME = 'VinculumPDFCache';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

interface CachedPDF {
  driveFileId: string;
  filename: string;
  data: ArrayBuffer;
  cachedAt: number;
  size: number;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'driveFileId' });
        store.createIndex('filename', 'filename', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

/**
 * Store a PDF in the cache
 */
export async function cachePDF(
  driveFileId: string,
  filename: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDB();

  const cached: CachedPDF = {
    driveFileId,
    filename,
    data,
    cachedAt: Date.now(),
    size: data.byteLength,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(cached);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a PDF from the cache
 */
export async function getCachedPDF(driveFileId: string): Promise<CachedPDF | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(driveFileId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if a PDF is cached
 */
export async function isPDFCached(driveFileId: string): Promise<boolean> {
  const cached = await getCachedPDF(driveFileId);
  return cached !== null;
}

/**
 * Remove a PDF from the cache
 */
export async function removeCachedPDF(driveFileId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(driveFileId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all cached PDFs metadata (without the data)
 */
export async function getAllCachedPDFs(): Promise<Omit<CachedPDF, 'data'>[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result.map((item: CachedPDF) => ({
        driveFileId: item.driveFileId,
        filename: item.filename,
        cachedAt: item.cachedAt,
        size: item.size,
      }));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all cached PDFs
 */
export async function clearAllCache(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get total cache size in bytes
 */
export async function getCacheSize(): Promise<number> {
  const pdfs = await getAllCachedPDFs();
  return pdfs.reduce((total, pdf) => total + pdf.size, 0);
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}