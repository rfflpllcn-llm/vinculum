"use client";

import { Document, Anchor, Alignment } from '@/types/schemas';
import PDFViewer from './PDFViewer';
import { useSyncScroll } from '@/hooks/useSyncScroll';

/**
 * Dual Document View Component
 * Displays two PDF documents side-by-side with synchronized scrolling
 */

interface DualDocumentViewProps {
  sourceDocument: Document;
  targetDocument: Document;
  sourceFileData: ArrayBuffer;
  targetFileData: ArrayBuffer;
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  alignments: Alignment[];
  syncScrollEnabled: boolean;
  onAlignmentSelect?: (alignment: Alignment) => void;
}

export default function DualDocumentView({
  sourceDocument,
  targetDocument,
  sourceFileData,
  targetFileData,
  sourceAnchors,
  targetAnchors,
  alignments,
  syncScrollEnabled,
  onAlignmentSelect,
}: DualDocumentViewProps) {
  // Use sync scroll hook
  const { handleSourceScroll, targetScrollPosition } = useSyncScroll({
    sourceAnchors,
    targetAnchors,
    alignments,
    enabled: syncScrollEnabled,
  });

  return (
    <div className="flex h-full">
      {/* Source PDF (left) */}
      <div className="flex-1 border-r">
        <div className="bg-gray-200 px-3 py-2 border-b">
          <h3 className="text-sm font-semibold">{sourceDocument.filename}</h3>
          <p className="text-xs text-gray-600">Source</p>
        </div>
        <PDFViewer
          document={sourceDocument}
          fileData={sourceFileData}
          onScroll={handleSourceScroll}
          readOnly={true}
          highlightedAnchors={sourceAnchors}
        />
      </div>

      {/* Target PDF (right) */}
      <div className="flex-1">
        <div className="bg-gray-200 px-3 py-2 border-b">
          <h3 className="text-sm font-semibold">{targetDocument.filename}</h3>
          <p className="text-xs text-gray-600">Target</p>
        </div>
        <PDFViewer
          document={targetDocument}
          fileData={targetFileData}
          externalScrollPosition={targetScrollPosition || undefined}
          readOnly={true}
          highlightedAnchors={targetAnchors}
        />
      </div>
    </div>
  );
}
