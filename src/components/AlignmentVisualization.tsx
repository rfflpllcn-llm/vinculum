"use client";

import { Alignment, Anchor } from '@/types/schemas';
import { useState, useMemo, useEffect } from 'react';

/**
 * Alignment Visualization Component
 * Displays alignment metadata and allows selection for AI audit
 * Groups alignments by their alignment_type and provides filtering
 */

interface AlignmentVisualizationProps {
  alignments: Alignment[];
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  onSelect?: (alignment: Alignment) => void;
  selectedAlignmentId?: string;
  onAudit?: (alignment: Alignment) => void;
}

export default function AlignmentVisualization({
  alignments,
  sourceAnchors,
  targetAnchors,
  onSelect,
  selectedAlignmentId,
  onAudit,
}: AlignmentVisualizationProps) {
  // Extract unique alignment types and initialize all as selected
  const uniqueAlignmentTypes = useMemo(() => {
    const types = new Set<string>();
    alignments.forEach(a => {
      if (a.alignment_type) {
        types.add(a.alignment_type);
      }
    });
    return Array.from(types).sort();
  }, [alignments]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(uniqueAlignmentTypes)
  );

  // Sync selectedTypes when uniqueAlignmentTypes changes (new alignments arrive)
  // Merge new types into selectedTypes to prevent silently hiding new alignment types
  useEffect(() => {
    setSelectedTypes(prevSelected => {
      const newSelected = new Set(prevSelected);
      let hasChanges = false;

      // Add any new types that appeared
      uniqueAlignmentTypes.forEach(type => {
        if (!newSelected.has(type)) {
          newSelected.add(type);
          hasChanges = true;
        }
      });

      // Remove types that no longer exist
      Array.from(prevSelected).forEach(type => {
        if (!uniqueAlignmentTypes.includes(type)) {
          newSelected.delete(type);
          hasChanges = true;
        }
      });

      return hasChanges ? newSelected : prevSelected;
    });
  }, [uniqueAlignmentTypes]);

  // Precompute type -> count map - O(N) once instead of O(T*N) in render
  const typeToCount = useMemo(() => {
    const counts = new Map<string, number>();
    alignments.forEach(a => {
      if (a.alignment_type) {
        counts.set(a.alignment_type, (counts.get(a.alignment_type) || 0) + 1);
      }
    });
    return counts;
  }, [alignments]);

  // Build anchorId -> anchor maps for O(1) lookups instead of O(M) finds in render
  const anchorIdToSourceAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    sourceAnchors.forEach(anchor => {
      map.set(anchor.anchorId, anchor);
    });
    return map;
  }, [sourceAnchors]);

  const anchorIdToTargetAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    targetAnchors.forEach(anchor => {
      map.set(anchor.anchorId, anchor);
    });
    return map;
  }, [targetAnchors]);

  // Filter alignments by selected types
  const filteredAlignments = useMemo(() => {
    return alignments.filter(a =>
      !a.alignment_type || selectedTypes.has(a.alignment_type)
    );
  }, [alignments, selectedTypes]);

  // Group alignments by alignment_type
  const groupedAlignments = useMemo(() => {
    const groups = new Map<string, Alignment[]>();
    filteredAlignments.forEach(alignment => {
      const type = alignment.alignment_type || 'unknown';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(alignment);
    });
    // Sort groups by type
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [filteredAlignments]);

  const handleTypeToggle = (type: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedTypes(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedTypes(new Set(uniqueAlignmentTypes));
  };

  const handleDeselectAll = () => {
    setSelectedTypes(new Set());
  };

  if (alignments.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No alignments loaded. Upload alignment files to see them here.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-2">
          Alignments ({filteredAlignments.length} of {alignments.length})
        </h3>

        {/* Filter controls */}
        {uniqueAlignmentTypes.length > 0 && (
          <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">Filter by Alignment Type:</span>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueAlignmentTypes.map(type => (
                <label key={type} className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(type)}
                    onChange={() => handleTypeToggle(type)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-700">{type}</span>
                  <span className="text-xs text-gray-500">
                    ({typeToCount.get(type) || 0})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grouped alignments display */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {Array.from(groupedAlignments.entries()).map(([type, typeAlignments]) => (
          <div key={type} className="border-l-4 border-blue-400 pl-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              {type} ({typeAlignments.length})
            </h4>
            <div className="space-y-2">
              {typeAlignments.map((alignment) => {
                // O(1) lookups instead of O(M) finds
                const sourceAnchor = anchorIdToSourceAnchor.get(alignment.sourceAnchorId);
                const targetAnchor = anchorIdToTargetAnchor.get(alignment.targetAnchorId);

                const isSelected = alignment.alignmentId === selectedAlignmentId;

                return (
                  <div
                    key={alignment.alignmentId}
                    onClick={() => onSelect?.(alignment)}
                    className={`border rounded p-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      Type: {alignment.type} | Confidence: {(alignment.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-600 font-medium min-w-[60px]">Source:</span>
                        <span className="text-gray-800 line-clamp-2">
                          {sourceAnchor?.quote.substring(0, 100) || 'N/A'}
                          {(sourceAnchor?.quote.length || 0) > 100 ? '...' : ''}
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-600 font-medium min-w-[60px]">Target:</span>
                        <span className="text-gray-800 line-clamp-2">
                          {targetAnchor?.quote.substring(0, 100) || 'N/A'}
                          {(targetAnchor?.quote.length || 0) > 100 ? '...' : ''}
                        </span>
                      </div>
                    </div>
                    {onAudit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAudit(alignment);
                        }}
                        className="mt-2 w-full px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                      >
                        AI Audit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
