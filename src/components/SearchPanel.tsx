"use client";

import { useState, useMemo, useEffect } from "react";

interface SearchResult {
  chunkId: number;
  text: string;
  page: string;
  language: string;
  rowNumber?: number;
}

interface AnchorMetadata {
  rowNumber?: number;
  page: number;
}

interface SearchPanelProps {
  chunkMap: Map<number, any>;
  sourceAnchors: any[];
  targetAnchors: any[];
  onNavigate: (page: number, lang: string, rowNumber?: number) => void;
}

const RESULTS_PER_PAGE = 10;
const DEBOUNCE_MS = 500;

export default function SearchPanel({
  chunkMap,
  sourceAnchors,
  targetAnchors,
  onNavigate,
}: SearchPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState<number | null>(null);
  const [displayLimit, setDisplayLimit] = useState(RESULTS_PER_PAGE);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search query
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setDisplayLimit(RESULTS_PER_PAGE); // Reset pagination on new search
      setIsSearching(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build lookup map from (quote + page) to anchor metadata - O(M) once
  // This avoids O(N*M) linear searches through anchors on every search
  // Using composite key handles duplicate texts on different pages correctly
  const anchorLookup = useMemo(() => {
    const map = new Map<string, AnchorMetadata>();

    // Process all anchors once and store metadata by composite key
    [...sourceAnchors, ...targetAnchors].forEach(anchor => {
      if (anchor.quote) {
        // Create composite key: "text|page" to handle duplicate texts
        const pageStr = String(anchor.page).padStart(3, '0'); // Normalize page format to match chunk.page
        const key = `${anchor.quote}|${pageStr}`;
        map.set(key, {
          rowNumber: anchor.rowNumber,
          page: anchor.page,
        });
      }
    });

    return map;
  }, [sourceAnchors, targetAnchors]);

  // Search through chunks (find all matches) - O(N) instead of O(N*M)
  const allSearchResults = useMemo(() => {
    if (!searchQuery.trim() || chunkMap.size === 0) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    chunkMap.forEach((chunk, chunkId) => {
      if (chunk.text && chunk.text.toLowerCase().includes(query)) {
        // O(1) lookup using composite key instead of O(M) linear search
        const key = `${chunk.text}|${chunk.page}`;
        const metadata = anchorLookup.get(key);

        results.push({
          chunkId,
          text: chunk.text,
          page: chunk.page,
          language: chunk.language,
          rowNumber: metadata?.rowNumber,
        });
      }
    });

    return results;
  }, [searchQuery, chunkMap, anchorLookup]);

  // Paginated results (only show first N)
  const displayedResults = useMemo(() => {
    return allSearchResults.slice(0, displayLimit);
  }, [allSearchResults, displayLimit]);

  const hasMoreResults = allSearchResults.length > displayLimit;
  const remainingCount = allSearchResults.length - displayLimit;

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result.chunkId);
    const pageNum = parseInt(result.page, 10);
    onNavigate(pageNum, result.language, result.rowNumber);
  };

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + RESULTS_PER_PAGE);
  };

  return (
    <>
      {/* Search Input */}
      <div className="p-3 border-b">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search in chunks..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchInput && (
          <div className="mt-2 text-xs text-gray-600">
            {isSearching ? (
              <span className="text-gray-400">Searching...</span>
            ) : (
              <>
                {allSearchResults.length} result{allSearchResults.length !== 1 ? 's' : ''} found
                {displayedResults.length < allSearchResults.length && (
                  <span className="text-gray-500"> (showing {displayedResults.length})</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Search Results */}
      <div>
        {displayedResults.map((result) => (
          <div
            key={result.chunkId}
            onClick={() => handleResultClick(result)}
            className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
              selectedResult === result.chunkId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">
                Page {result.page} • {result.language.toUpperCase()}
                {result.rowNumber != null && ` • Line ${result.rowNumber}`}
              </span>
            </div>
            <div className="text-sm text-gray-900 line-clamp-3">
              {highlightText(result.text, searchQuery)}
            </div>
          </div>
        ))}

        {/* Load More Button */}
        {hasMoreResults && (
          <div className="p-3 border-b">
            <button
              onClick={handleLoadMore}
              className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-300 font-medium"
            >
              Load {Math.min(remainingCount, RESULTS_PER_PAGE)} more result{Math.min(remainingCount, RESULTS_PER_PAGE) !== 1 ? 's' : ''}
              <span className="text-gray-500 ml-1">({remainingCount} remaining)</span>
            </button>
          </div>
        )}

        {searchQuery && allSearchResults.length === 0 && !isSearching && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No results found for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </>
  );
}

// Helper function to highlight search text
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
}