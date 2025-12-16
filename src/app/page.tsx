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
import SearchPanel from "@/components/SearchPanel";
import { Document, NormalizedRect, Anchor, ViewMode, Alignment } from "@/types/schemas";
import { generateUUID } from "@/lib/utils";
import { getCachedPDF, cachePDF, isPDFCached } from "@/lib/pdfCache";

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
  const [currentSourcePage, setCurrentSourcePage] = useState<number>(1);
  const [currentTargetPage, setCurrentTargetPage] = useState<number>(1);
  const [chunkMap, setChunkMap] = useState<Map<number, any>>(new Map());
  const [requestedSourcePage, setRequestedSourcePage] = useState<number | undefined>(undefined);
  const [requestedTargetPage, setRequestedTargetPage] = useState<number | undefined>(undefined);
  const [searchHighlightAnchor, setSearchHighlightAnchor] = useState<Anchor | null>(null);
  const [useCache, setUseCache] = useState(true);
  const [sourceDocCached, setSourceDocCached] = useState(false);
  const [targetDocCached, setTargetDocCached] = useState(false);

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

  // Load document data with caching support
  const loadDocumentData = async (driveFileId: string, filename: string, forceRefresh: boolean = false): Promise<ArrayBuffer> => {
    // Check cache first if enabled and not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = await getCachedPDF(driveFileId);
      if (cached) {
        console.log(`Using cached PDF: ${filename} (${(cached.size / 1024 / 1024).toFixed(2)} MB)`);
        return cached.data;
      }
    }

    // Download from Drive
    console.log(`Downloading PDF from Drive: ${filename}`);
    const response = await fetch(`/api/documents/${driveFileId}`);
    if (!response.ok) throw new Error(`Failed to load file: ${filename}`);
    const arrayBuffer = await response.arrayBuffer();

    // Cache the downloaded file
    try {
      await cachePDF(driveFileId, filename, arrayBuffer);
      console.log(`Cached PDF: ${filename} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.warn('Failed to cache PDF:', error);
    }

    return arrayBuffer;
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

      // Load source and target documents with updated documentIds
      setSourceDocument({ ...sourceDoc, documentId: newSourceDocId });
      setTargetDocument({ ...targetDoc, documentId: newTargetDocId });

      // Check cache status
      const [sourceCached, targetCached] = await Promise.all([
        isPDFCached(sourceDoc.driveFileId),
        isPDFCached(targetDoc.driveFileId),
      ]);
      setSourceDocCached(sourceCached);
      setTargetDocCached(targetCached);

      // Load file data for both documents (with caching)
      const [sourceData, targetData] = await Promise.all([
        loadDocumentData(sourceDoc.driveFileId, sourceDoc.filename),
        loadDocumentData(targetDoc.driveFileId, targetDoc.filename),
      ]);

      setSourceFileData(sourceData);
      setTargetFileData(targetData);

      // Update cache status after loading
      setSourceDocCached(true);
      setTargetDocCached(true);

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

      // Parse chunks file locally for search functionality
      const { parseJSONL } = await import('@/lib/alignmentParser');
      const chunks = await parseJSONL(chunksFile);
      const newChunkMap = new Map();
      chunks.forEach((chunk: any) => {
        newChunkMap.set(chunk.chunk_id, chunk);
      });
      setChunkMap(newChunkMap);
      console.log(`Loaded ${newChunkMap.size} chunks for search`);

      alert(
        `Loaded ${result.sourceAnchorsCount} source anchors, ${result.targetAnchorsCount} target anchors, and ${result.alignmentsCount} alignments!`
      );
    } catch (error) {
      console.error('Error uploading alignments:', error);
      alert('Failed to upload alignments: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  };

  // Handle clicking an alignment (just highlights, doesn't open modal)
  const handleAlignmentSelect = (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    // Clear search highlight when selecting an alignment
    setSearchHighlightAnchor(null);
  };

  // Handle AI Audit button click (opens modal)
  const handleAuditClick = (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    setShowAuditModal(true);
    // Clear search highlight when auditing an alignment
    setSearchHighlightAnchor(null);
  };

  // Handle search navigation
  const handleSearchNavigate = (page: number, lang: string, rowNumber?: number) => {
    console.log(`Search navigate called: page=${page}, lang=${lang}, rowNumber=${rowNumber}`);
    console.log(`Source doc: ${sourceDocument?.filename}`);
    console.log(`Target doc: ${targetDocument?.filename}`);

    // Determine which document based on language
    // Check both exact match and substring match for robustness
    const sourceLangMatch = sourceDocument?.filename.toLowerCase().includes(lang.toLowerCase());
    const targetLangMatch = targetDocument?.filename.toLowerCase().includes(lang.toLowerCase());

    console.log(`Language match - source: ${sourceLangMatch}, target: ${targetLangMatch}`);

    // Find the anchor on that page with the matching rowNumber
    let anchor: Anchor | null = null;

    if (sourceLangMatch) {
      console.log(`Setting source page to ${page}`);
      // Find the source anchor at this page and row number
      anchor = sourceAnchors.find(a => a.page === page && a.rowNumber === rowNumber) || null;
      console.log(`Found source anchor:`, anchor);

      setRequestedSourcePage(page);
      setCurrentSourcePage(page); // Also update current page for alignment filtering
      setSearchHighlightAnchor(anchor);

      // Find the alignment containing this source anchor and navigate target to it
      if (anchor) {
        const alignment = alignments.find(al => al.sourceAnchorId === anchor!.anchorId);
        if (alignment) {
          console.log(`Found alignment:`, alignment);
          const targetAnchor = targetAnchors.find(a => a.anchorId === alignment.targetAnchorId);
          if (targetAnchor) {
            console.log(`Navigating target to page ${targetAnchor.page}`);
            setRequestedTargetPage(targetAnchor.page);
            setCurrentTargetPage(targetAnchor.page);
            // Select the alignment to show the connection
            setSelectedAlignment(alignment);
          } else {
            console.warn(`Target anchor not found for alignment`);
            // Clear any selected alignment since we're doing a search navigation
            setSelectedAlignment(null);
          }
        } else {
          console.log(`No alignment found for this source anchor`);
          // Clear any selected alignment since we're doing a search navigation
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    } else if (targetLangMatch) {
      console.log(`Setting target page to ${page}`);
      // Find the target anchor at this page and row number
      anchor = targetAnchors.find(a => a.page === page && a.rowNumber === rowNumber) || null;
      console.log(`Found target anchor:`, anchor);

      setRequestedTargetPage(page);
      setCurrentTargetPage(page); // Also update current page
      setSearchHighlightAnchor(anchor);

      // Find the alignment containing this target anchor and navigate source to it
      if (anchor) {
        const alignment = alignments.find(al => al.targetAnchorId === anchor!.anchorId);
        if (alignment) {
          console.log(`Found alignment:`, alignment);
          const sourceAnchor = sourceAnchors.find(a => a.anchorId === alignment.sourceAnchorId);
          if (sourceAnchor) {
            console.log(`Navigating source to page ${sourceAnchor.page}`);
            setRequestedSourcePage(sourceAnchor.page);
            setCurrentSourcePage(sourceAnchor.page);
            // Select the alignment to show the connection
            setSelectedAlignment(alignment);
          } else {
            console.warn(`Source anchor not found for alignment`);
            // Clear any selected alignment since we're doing a search navigation
            setSelectedAlignment(null);
          }
        } else {
          console.log(`No alignment found for this target anchor`);
          // Clear any selected alignment since we're doing a search navigation
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    } else {
      console.warn(`Could not match language "${lang}" to either document`);
    }
  };

  // Filter alignments by current source page
  const filteredAlignments = alignments.filter(alignment => {
    const sourceAnchor = sourceAnchors.find(a => a.anchorId === alignment.sourceAnchorId);
    return sourceAnchor && sourceAnchor.page === currentSourcePage;
  });

  // Get selected source and target anchors for highlighting
  // Priority: search highlight > alignment selection
  const selectedSourceAnchors = searchHighlightAnchor && sourceAnchors.includes(searchHighlightAnchor)
    ? [searchHighlightAnchor]
    : selectedAlignment
    ? sourceAnchors.filter(a => a.anchorId === selectedAlignment.sourceAnchorId).slice(0, 1)
    : [];
  const selectedTargetAnchors = searchHighlightAnchor && targetAnchors.includes(searchHighlightAnchor)
    ? [searchHighlightAnchor]
    : selectedAlignment
    ? targetAnchors.filter(a => a.anchorId === selectedAlignment.targetAnchorId).slice(0, 1)
    : [];

  // Debug logging for search highlight
  if (searchHighlightAnchor) {
    console.log('Search highlight anchor:', searchHighlightAnchor);
    console.log('Is in sourceAnchors?', sourceAnchors.includes(searchHighlightAnchor));
    console.log('Is in targetAnchors?', targetAnchors.includes(searchHighlightAnchor));
    console.log('Selected source anchors:', selectedSourceAnchors);
    console.log('Selected target anchors:', selectedTargetAnchors);
  }

  // Debug logging
  if (selectedAlignment) {
    console.log('Selected alignment:', selectedAlignment);
    console.log('Source anchors to highlight:', selectedSourceAnchors.length, selectedSourceAnchors.map(a => ({ id: a.anchorId, page: a.page, quote: a.quote.substring(0, 50) })));
    console.log('Target anchors to highlight:', selectedTargetAnchors.length, selectedTargetAnchors.map(a => ({ id: a.anchorId, page: a.page, quote: a.quote.substring(0, 50) })));

    const matchingSource = sourceAnchors.filter(a => a.anchorId === selectedAlignment.sourceAnchorId);
    const matchingTarget = targetAnchors.filter(a => a.anchorId === selectedAlignment.targetAnchorId);

    if (matchingSource.length > 1) {
      console.warn(`⚠️ Multiple SOURCE anchors found for anchorId ${selectedAlignment.sourceAnchorId}:`, matchingSource.length);
    }
    if (matchingTarget.length > 1) {
      console.warn(`⚠️ Multiple TARGET anchors found for anchorId ${selectedAlignment.targetAnchorId}:`, matchingTarget.length);
    }
  }

  // Get target page to scroll to when alignment is selected
  const alignmentTargetPage = selectedTargetAnchors.length > 0
    ? selectedTargetAnchors[0].page
    : undefined;

  // Clear navigation requests after they've been used
  useEffect(() => {
    if (requestedSourcePage !== undefined) {
      const timer = setTimeout(() => setRequestedSourcePage(undefined), 100);
      return () => clearTimeout(timer);
    }
  }, [requestedSourcePage]);

  useEffect(() => {
    if (requestedTargetPage !== undefined) {
      const timer = setTimeout(() => setRequestedTargetPage(undefined), 100);
      return () => clearTimeout(timer);
    }
  }, [requestedTargetPage]);

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
                onSourcePageChange={setCurrentSourcePage}
                selectedSourceAnchors={selectedSourceAnchors}
                selectedTargetAnchors={selectedTargetAnchors}
                sourceScrollToPage={requestedSourcePage}
                targetScrollToPage={requestedTargetPage !== undefined ? requestedTargetPage : alignmentTargetPage}
              />
              {/* Search Panel */}
              <div className="w-80 bg-white border-l overflow-y-auto">
                <div className="p-2 border-b bg-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Search</h3>
                </div>
                <SearchPanel
                  chunkMap={chunkMap}
                  sourceAnchors={sourceAnchors}
                  targetAnchors={targetAnchors}
                  onNavigate={handleSearchNavigate}
                />
              </div>

              {/* Alignment Panel */}
              <div className="w-80 bg-white border-l overflow-y-auto">
                <div className="p-3 border-b space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncScrollEnabled}
                      onChange={(e) => setSyncScrollEnabled(e.target.checked)}
                    />
                    <span className="text-sm">Sync Scroll</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={useCache}
                      onChange={(e) => setUseCache(e.target.checked)}
                    />
                    <span className="text-sm">Use Cache</span>
                  </label>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>
                      Viewing page {currentSourcePage} alignments ({filteredAlignments.length} of {alignments.length})
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={sourceDocCached ? 'text-green-600' : 'text-gray-400'}>
                        {sourceDocCached ? '✓' : '○'} Source cached
                      </span>
                      <button
                        onClick={async () => {
                          if (sourceDocument) {
                            const data = await loadDocumentData(sourceDocument.driveFileId, sourceDocument.filename, true);
                            setSourceFileData(data);
                            setSourceDocCached(true);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                        title="Force refresh from Drive"
                      >
                        ↻
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={targetDocCached ? 'text-green-600' : 'text-gray-400'}>
                        {targetDocCached ? '✓' : '○'} Target cached
                      </span>
                      <button
                        onClick={async () => {
                          if (targetDocument) {
                            const data = await loadDocumentData(targetDocument.driveFileId, targetDocument.filename, true);
                            setTargetFileData(data);
                            setTargetDocCached(true);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                        title="Force refresh from Drive"
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                </div>
                <AlignmentVisualization
                  alignments={filteredAlignments}
                  sourceAnchors={sourceAnchors}
                  targetAnchors={targetAnchors}
                  onSelect={handleAlignmentSelect}
                  selectedAlignmentId={selectedAlignment?.alignmentId}
                  onAudit={handleAuditClick}
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
