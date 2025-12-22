import { createHash } from "crypto";
import { computeQuoteHash } from "./utils";

function expectedHash(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

describe("computeQuoteHash", () => {
  it("hashes normalized text with sha256", async () => {
    const quote = "Hello   world\n\nfrom  Vinculum";
    const result = await computeQuoteHash(quote);

    expect(result).toBe(expectedHash(quote));
  });

  it("produces the same hash for whitespace-variant quotes", async () => {
    const quoteA = "alpha   beta\ngamma";
    const quoteB = "alpha beta gamma";

    const [hashA, hashB] = await Promise.all([
      computeQuoteHash(quoteA),
      computeQuoteHash(quoteB),
    ]);

    expect(hashA).toBe(hashB);
  });
});
