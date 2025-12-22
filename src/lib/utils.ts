import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Compute SHA-256 hash of normalized text
 * Used for anchor quote hashing
 */
export async function computeQuoteHash(quote: string): Promise<string> {
  // Normalize whitespace
  const normalized = quote.replace(/\s+/g, " ").trim();

  // Compute hash (client-side version)
  if (typeof window !== "undefined") {
    // Browser environment - use SubtleCrypto
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto API not available for quote hashing");
    }
    const data = new TextEncoder().encode(normalized);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Node environment
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Generate ISO-8601 timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
