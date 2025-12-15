"use client";

import { Alignment, Anchor } from '@/types/schemas';

/**
 * Alignment Visualization Component
 * Displays alignment metadata and allows selection for AI audit
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
  if (alignments.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No alignments loaded. Upload alignment files to see them here.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-sm font-semibold mb-3">
        Alignments ({alignments.length})
      </h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {alignments.map((alignment) => {
          const sourceAnchor = sourceAnchors.find(
            (a) => a.anchorId === alignment.sourceAnchorId
          );
          const targetAnchor = targetAnchors.find(
            (a) => a.anchorId === alignment.targetAnchorId
          );

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
  );
}
