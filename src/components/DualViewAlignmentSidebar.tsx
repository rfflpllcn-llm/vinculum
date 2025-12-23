"use client";

import AlignmentVisualization from "@/components/AlignmentVisualization";
import { Alignment, Anchor, Document } from "@/types/schemas";

type DualViewAlignmentSidebarProps = {
  syncScrollEnabled: boolean;
  useCache: boolean;
  onToggleSyncScroll: (enabled: boolean) => void;
  onToggleUseCache: (enabled: boolean) => void;
  currentSourcePage: number;
  filteredAlignmentsCount: number;
  totalAlignmentsCount: number;
  sourceDocCached: boolean;
  targetDocCached: boolean;
  sourceDocument: Document | null;
  targetDocument: Document | null;
  onRefreshSource: () => Promise<void>;
  onRefreshTarget: () => Promise<void>;
  filteredAlignments: Alignment[];
  allAlignments: Alignment[];
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  onSelect: (alignment: Alignment) => void;
  selectedAlignmentId?: string;
  onAudit: (alignment: Alignment) => void;
  chunkMap: Map<number, any>;
  sourceLanguage: string;
  targetLanguage: string;
};

export default function DualViewAlignmentSidebar({
  syncScrollEnabled,
  useCache,
  onToggleSyncScroll,
  onToggleUseCache,
  currentSourcePage,
  filteredAlignmentsCount,
  totalAlignmentsCount,
  sourceDocCached,
  targetDocCached,
  sourceDocument,
  targetDocument,
  onRefreshSource,
  onRefreshTarget,
  filteredAlignments,
  allAlignments,
  sourceAnchors,
  targetAnchors,
  onSelect,
  selectedAlignmentId,
  onAudit,
  chunkMap,
  sourceLanguage,
  targetLanguage,
}: DualViewAlignmentSidebarProps) {
  return (
    <div className="flex-1 min-w-[240px] bg-white border-l overflow-y-auto min-h-0">
      <div className="p-3 border-b space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={syncScrollEnabled}
            onChange={(e) => onToggleSyncScroll(e.target.checked)}
          />
          <span className="text-sm">Sync Scroll</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={useCache}
            onChange={(e) => onToggleUseCache(e.target.checked)}
          />
          <span className="text-sm">Use Cache</span>
        </label>
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            Viewing page {currentSourcePage} alignments ({filteredAlignmentsCount} of {totalAlignmentsCount})
          </div>
          <div className="flex items-center gap-2">
            <span className={sourceDocCached ? "text-green-600" : "text-gray-400"}>
              {sourceDocCached ? "✓" : "○"} Source cached
            </span>
            <button
              onClick={onRefreshSource}
              className="text-blue-600 hover:text-blue-800 underline"
              title="Force refresh from Drive"
              disabled={!sourceDocument}
            >
              ↻
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={targetDocCached ? "text-green-600" : "text-gray-400"}>
              {targetDocCached ? "✓" : "○"} Target cached
            </span>
            <button
              onClick={onRefreshTarget}
              className="text-blue-600 hover:text-blue-800 underline"
              title="Force refresh from Drive"
              disabled={!targetDocument}
            >
              ↻
            </button>
          </div>
        </div>
      </div>
      <AlignmentVisualization
        alignments={filteredAlignments}
        allAlignments={allAlignments}
        sourceAnchors={sourceAnchors}
        targetAnchors={targetAnchors}
        onSelect={onSelect}
        selectedAlignmentId={selectedAlignmentId}
        onAudit={onAudit}
        chunkMap={chunkMap}
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
      />
    </div>
  );
}
