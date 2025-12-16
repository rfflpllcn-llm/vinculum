"use client";

import { useState, useMemo } from "react";

interface SearchResult {
  chunkId: number;
  text: string;
  page: string;
  language: string;
  rowNumber?: number;
}

interface SearchPanelProps {
  chunkMap: Map<number, any>;
  sourceAnchors: any[];
  targetAnchors: any[];
  onNavigate: (page: number, lang: string, rowNumber?: number) => void;
}

export default function SearchPanel({
  chunkMap,
  sourceAnchors,
  targetAnchors,
  onNavigate,
}: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResult, setSelectedResult] = useState<number | null>(null);

  // Search through chunks
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || chunkMap.size === 0) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    chunkMap.forEach((chunk, chunkId) => {
      if (chunk.text && chunk.text.toLowerCase().includes(query)) {
        // Find corresponding anchor to get rowNumber
        const allAnchors = [...sourceAnchors, ...targetAnchors];
        const anchor = allAnchors.find(a => a.quote === chunk.text);

        results.push({
          chunkId,
          text: chunk.text,
          page: chunk.page,
          language: chunk.language,
          rowNumber: anchor?.rowNumber,
        });
      }
    });

    return results;
  }, [searchQuery, chunkMap, sourceAnchors, targetAnchors]);

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result.chunkId);
    const pageNum = parseInt(result.page, 10);
    onNavigate(pageNum, result.language, result.rowNumber);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3 border-b">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search in chunks..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <div className="mt-2 text-xs text-gray-600">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.map((result) => (
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

        {searchQuery && searchResults.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No results found for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
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