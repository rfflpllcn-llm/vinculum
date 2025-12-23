"use client";

import DualDocumentView from "@/components/DualDocumentView";
import { Alignment, Anchor, Document } from "@/types/schemas";

type DualViewWorkspaceProps = {
  sourceDocument: Document;
  targetDocument: Document;
  sourceFileData: ArrayBuffer;
  targetFileData: ArrayBuffer;
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  syncScrollEnabled: boolean;
  onAlignmentSelect: (alignment: Alignment) => void;
  onSourcePageChange: (page: number) => void;
  selectedSourceAnchors: Anchor[];
  selectedTargetAnchors: Anchor[];
  requestedSourcePage?: number;
  requestedTargetPage?: number;
  alignmentTargetPage?: number;
  loadingAlignmentData: boolean;
};

export default function DualViewWorkspace({
  sourceDocument,
  targetDocument,
  sourceFileData,
  targetFileData,
  sourceAnchors,
  targetAnchors,
  alignments,
  syncScrollEnabled,
  onAlignmentSelect,
  onSourcePageChange,
  selectedSourceAnchors,
  selectedTargetAnchors,
  requestedSourcePage,
  requestedTargetPage,
  alignmentTargetPage,
  loadingAlignmentData,
}: DualViewWorkspaceProps) {
  return (
    <div className="relative flex-1 flex">
      <DualDocumentView
        sourceDocument={sourceDocument}
        targetDocument={targetDocument}
        sourceFileData={sourceFileData}
        targetFileData={targetFileData}
        sourceAnchors={sourceAnchors}
        targetAnchors={targetAnchors}
        alignments={alignments}
        syncScrollEnabled={syncScrollEnabled}
        onAlignmentSelect={onAlignmentSelect}
        onSourcePageChange={onSourcePageChange}
        selectedSourceAnchors={selectedSourceAnchors}
        selectedTargetAnchors={selectedTargetAnchors}
        sourceScrollToPage={requestedSourcePage}
        targetScrollToPage={
          requestedTargetPage !== undefined ? requestedTargetPage : alignmentTargetPage
        }
      />
      {loadingAlignmentData && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <div className="text-gray-700 font-medium">Loading alignment data...</div>
            <div className="text-sm text-gray-500 mt-2">
              Please wait while chunks and alignments are being loaded
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
