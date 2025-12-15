"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LibraryPanel from "@/components/LibraryPanel";
import PDFViewer from "@/components/PDFViewer";
import NotesPanel from "@/components/NotesPanel";
import DualDocumentView from "@/components/DualDocumentView";
import ViewModeToggle from "@/components/ViewModeToggle";
import AlignmentVisualization from "@/components/AlignmentVisualization";
import AIAuditModal from "@/components/AIAuditModal";
import AlignmentUploadPanel from "@/components/AlignmentUploadPanel";
import { Document, NormalizedRect, Anchor, ViewMode, Alignment } from "@/types/schemas";
import { generateUUID } from "@/lib/utils";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Single view state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<Anchor | null>(null);
  const [noteContent, setNoteContent] = useState("");

  // Dual view state
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [sourceDocument, setSourceDocument] = useState<Document | null>(null);
  const [targetDocument, setTargetDocument] = useState<Document | null>(null);
  const [sourceFileData, setSourceFileData] = useState<ArrayBuffer | null>(null);
  const [targetFileData, setTargetFileData] = useState<ArrayBuffer | null>(null);
  const [sourceAnchors, setSourceAnchors] = useState<Anchor[]>([]);
  const [targetAnchors, setTargetAnchors] = useState<Anchor[]>([]);
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);
  const [selectedAlignment, setSelectedAlignment] = useState<Alignment | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [sourceDocId, setSourceDocId] = useState<string>('');
  const [targetDocId, setTargetDocId] = useState<string>('');

  // Load available documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        if (response.ok) {
          const data = await response.json();
          setAvailableDocuments(data.documents || []);
        }
      } catch (error) {
        console.error('Error loading documents:', error);
      }
    };

    loadDocuments();
  }, []);

  // Load file data when document is selected
  useEffect(() => {
    const loadFile = async () => {
      if (!selectedDocument) {
        setFileData(null);
        return;
      }

      setLoadingFile(true);
      try {
        const response = await fetch(`/api/documents/${selectedDocument.driveFileId}`);
        if (!response.ok) throw new Error("Failed to load file");
        const arrayBuffer = await response.arrayBuffer();
        setFileData(arrayBuffer);
      } catch (error) {
        console.error("Error loading file:", error);
      } finally {
        setLoadingFile(false);
      }
    };

    loadFile();
  }, [selectedDocument]);

  const handleAnchorCreate = async (page: number, rect: NormalizedRect, quote: string) => {
    if (!selectedDocument) return;

    try {
      const response = await fetch("/api/anchors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: generateUUID(), // Generate document ID on first anchor
          page,
          rect,
          quote,
        }),
      });

      if (!response.ok) throw new Error("Failed to create anchor");

      const { anchor } = await response.json();
      setSelectedAnchor(anchor);
      setNoteContent("");
    } catch (error) {
      console.error("Error creating anchor:", error);
      alert("Failed to create anchor");
    }
  };

  const handleNoteSave = async () => {
    if (!selectedAnchor || !noteContent) return;

    try {
      // TODO: Implement note API
      console.log("Saving note:", { anchorId: selectedAnchor.anchorId, noteContent });
      alert("Note saved successfully!");
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note");
    }
  };

  const handleAlignmentUpload = async (
    chunksFile: File,
    alignmentsFile: File,
    sourceDoc: Document,
    targetDoc: Document
  ) => {
    try {
      // Generate persistent document IDs
      const newSourceDocId = generateUUID();
      const newTargetDocId = generateUUID();

      const formData = new FormData();
      formData.append('chunksFile', chunksFile);
      formData.append('alignmentsFile', alignmentsFile);
      formData.append('sourceDocId', newSourceDocId);
      formData.append('targetDocId', newTargetDocId);
      formData.append('sourceDriveFileId', sourceDoc.driveFileId);
      formData.append('targetDriveFileId', targetDoc.driveFileId);

      const response = await fetch('/api/alignments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload alignments');

      const result = await response.json();
      console.log('Alignment upload result:', result);

      // Store document IDs
      setSourceDocId(newSourceDocId);
      setTargetDocId(newTargetDocId);

      // Load source and target documents
      setSourceDocument(sourceDoc);
      setTargetDocument(targetDoc);

      // Load file data for both documents
      const [sourceData, targetData] = await Promise.all([
        fetch(`/api/documents/${sourceDoc.driveFileId}`).then(r => r.arrayBuffer()),
        fetch(`/api/documents/${targetDoc.driveFileId}`).then(r => r.arrayBuffer()),
      ]);

      setSourceFileData(sourceData);
      setTargetFileData(targetData);

      // Load anchors from Drive
      const [sourceAnchorsData, targetAnchorsData] = await Promise.all([
        fetch(`/api/anchors?documentId=${newSourceDocId}`).then(r => r.json()),
        fetch(`/api/anchors?documentId=${newTargetDocId}`).then(r => r.json()),
      ]);

      setSourceAnchors(sourceAnchorsData.anchors || []);
      setTargetAnchors(targetAnchorsData.anchors || []);

      // Load alignments
      const alignmentsResponse = await fetch(
        `/api/alignments?sourceDocId=${newSourceDocId}&targetDocId=${newTargetDocId}`
      );
      const alignmentsData = await alignmentsResponse.json();
      setAlignments(alignmentsData.alignments || []);

      alert(
        `Loaded ${result.sourceAnchorsCount} source anchors, ${result.targetAnchorsCount} target anchors, and ${result.alignmentsCount} alignments!`
      );
    } catch (error) {
      console.error('Error uploading alignments:', error);
      alert('Failed to upload alignments: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  };

  const handleAlignmentSelect = (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    setShowAuditModal(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <nav className="flex items-center justify-between">
          <div className="flex space-x-6">
            <button
              onClick={() => setLibraryOpen(true)}
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Library
            </button>
            <button
              className="text-gray-700 hover:text-gray-900"
              disabled={!selectedDocument}
            >
              Document
            </button>
            <button
              className="text-gray-700 hover:text-gray-900"
              disabled={!selectedDocument}
            >
              AI
            </button>
            <button className="text-gray-700 hover:text-gray-900">
              Settings
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <ViewModeToggle
              viewMode={viewMode}
              onChange={setViewMode}
              disabled={viewMode === 'dual' && (!sourceDocument || !targetDocument)}
            />
            <span className="text-sm text-gray-600">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 flex bg-gray-50 overflow-hidden">
        {viewMode === 'single' ? (
          /* Single View Mode */
          selectedDocument && fileData ? (
            <>
              {/* PDF/Document Viewer */}
              <div className="flex-1 flex flex-col">
                {loadingFile ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Loading document...</div>
                  </div>
                ) : selectedDocument.mimeType === "application/pdf" ? (
                  <PDFViewer
                    document={selectedDocument}
                    fileData={fileData}
                    onAnchorCreate={handleAnchorCreate}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Markdown viewer coming soon...</div>
                  </div>
                )}
              </div>

              {/* Notes Panel */}
              <NotesPanel
                selectedAnchor={selectedAnchor}
                noteContent={noteContent}
                onNoteChange={setNoteContent}
                onNoteSave={handleNoteSave}
              />
            </>
          ) : selectedDocument ? (
            <div className="flex items-center justify-center w-full">
              <div className="text-gray-500">Loading document...</div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">Vinculum</h1>
                <p className="text-gray-600">Scholarly web application for aligned document reading</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click <strong>Library</strong> to get started
                </p>
              </div>
            </div>
          )
        ) : (
          /* Dual View Mode */
          sourceDocument && targetDocument && sourceFileData && targetFileData ? (
            <>
              <DualDocumentView
                sourceDocument={sourceDocument}
                targetDocument={targetDocument}
                sourceFileData={sourceFileData}
                targetFileData={targetFileData}
                sourceAnchors={sourceAnchors}
                targetAnchors={targetAnchors}
                alignments={alignments}
                syncScrollEnabled={syncScrollEnabled}
                onAlignmentSelect={handleAlignmentSelect}
              />
              {/* Alignment Panel */}
              <div className="w-80 bg-white border-l overflow-y-auto">
                <div className="p-3 border-b">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncScrollEnabled}
                      onChange={(e) => setSyncScrollEnabled(e.target.checked)}
                    />
                    <span className="text-sm">Sync Scroll</span>
                  </label>
                </div>
                <AlignmentVisualization
                  alignments={alignments}
                  sourceAnchors={sourceAnchors}
                  targetAnchors={targetAnchors}
                  onSelect={handleAlignmentSelect}
                  selectedAlignmentId={selectedAlignment?.alignmentId}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center w-full">
              <AlignmentUploadPanel
                documents={availableDocuments}
                onUpload={handleAlignmentUpload}
              />
            </div>
          )
        )}
      </div>

      <LibraryPanel
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelectDocument={(doc) => setSelectedDocument(doc)}
      />

      <AIAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        alignment={selectedAlignment}
        sourceAnchor={
          selectedAlignment
            ? sourceAnchors.find((a) => a.anchorId === selectedAlignment.sourceAnchorId) || null
            : null
        }
        targetAnchor={
          selectedAlignment
            ? targetAnchors.find((a) => a.anchorId === selectedAlignment.targetAnchorId) || null
            : null
        }
      />
    </main>
  );
}
