"use client";

import SearchPanel from "@/components/SearchPanel";
import { Anchor } from "@/types/schemas";

type DualViewSearchSidebarProps = {
  chunkMap: Map<number, any>;
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  onNavigate: (page: number, lang: string, rowNumber?: number) => void;
};

export default function DualViewSearchSidebar({
  chunkMap,
  sourceAnchors,
  targetAnchors,
  onNavigate,
}: DualViewSearchSidebarProps) {
  return (
    <div className="flex-1 min-w-[240px] bg-white overflow-y-auto min-h-0">
      <div className="p-2 border-b bg-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Search</h3>
      </div>
      <SearchPanel
        chunkMap={chunkMap}
        sourceAnchors={sourceAnchors}
        targetAnchors={targetAnchors}
        onNavigate={onNavigate}
      />
    </div>
  );
}
