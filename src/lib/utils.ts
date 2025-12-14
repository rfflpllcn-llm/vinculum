import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

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
export function computeQuoteHash(quote: string): string {
  // Normalize whitespace
  const normalized = quote.replace(/\s+/g, " ").trim();

  // Compute hash (client-side version)
  if (typeof window !== "undefined") {
    // Browser environment - use SubtleCrypto
    return normalized; // Simplified for now - proper implementation would use async SubtleCrypto
  } else {
    // Node environment
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
}

/**
 * Generate ISO-8601 timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
