"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
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
import { authFetch } from "@/lib/authFetch";

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
  const [sourceLanguage, setSourceLanguage] = useState<string>('en');
  const [targetLanguage, setTargetLanguage] = useState<string>('it');

  // Load available documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await authFetch('/api/documents');
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
        const response = await authFetch(`/api/documents/${selectedDocument.driveFileId}`);
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
      const response = await authFetch("/api/anchors", {
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
    const response = await authFetch(`/api/documents/${driveFileId}`);
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

      const response = await authFetch('/api/alignments/upload', {
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
        authFetch(`/api/anchors?documentId=${newSourceDocId}`).then(r => r.json()),
        authFetch(`/api/anchors?documentId=${newTargetDocId}`).then(r => r.json()),
      ]);

      setSourceAnchors(sourceAnchorsData.anchors || []);
      setTargetAnchors(targetAnchorsData.anchors || []);

      // Load alignments
      const alignmentsResponse = await authFetch(
        `/api/alignments?sourceDocId=${newSourceDocId}&targetDocId=${newTargetDocId}`
      );
      const alignmentsData = await alignmentsResponse.json();
      setAlignments(alignmentsData.alignments || []);

      // Parse chunks file locally for search functionality
      const { parseJSONL } = await import('@/lib/alignmentParser');
      const chunks = await parseJSONL(chunksFile);
      const newChunkMap = new Map();
      const languages = new Set<string>();
      chunks.forEach((chunk: any) => {
        newChunkMap.set(chunk.chunk_id, chunk);
        if (chunk.language) {
          languages.add(chunk.language);
        }
      });
      setChunkMap(newChunkMap);
      console.log(`Loaded ${newChunkMap.size} chunks for search`);

      // Extract language codes from chunks (usually two languages)
      const langArray = Array.from(languages).sort();
      if (langArray.length >= 2) {
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[1]);
      } else if (langArray.length === 1) {
        // If only one language found, use it for both (edge case)
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[0]);
      }

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
    // Determine which document based on language
    // Check both exact match and substring match for robustness
    const sourceLangMatch = sourceDocument?.filename.toLowerCase().includes(lang.toLowerCase());
    const targetLangMatch = targetDocument?.filename.toLowerCase().includes(lang.toLowerCase());

    // Find the anchor on that page with the matching rowNumber
    let anchor: Anchor | null = null;

    if (sourceLangMatch) {
      // Find the source anchor at this page and row number
      anchor = sourceAnchors.find(a => a.page === page && a.rowNumber === rowNumber) || null;

      setRequestedSourcePage(page);
      setCurrentSourcePage(page); // Also update current page for alignment filtering
      setSearchHighlightAnchor(anchor);

      // Find the alignment containing this source anchor and navigate target to it
      if (anchor) {
        // Check both primary anchorId and sourceAnchorIds array
        const alignment = alignments.find(al =>
          al.sourceAnchorId === anchor!.anchorId ||
          al.sourceAnchorIds?.includes(anchor!.anchorId)
        );
        if (alignment) {
          // Get first target anchor from the alignment
          const targetAnchorId = alignment.targetAnchorIds?.[0] || alignment.targetAnchorId;
          const targetAnchor = targetAnchors.find(a => a.anchorId === targetAnchorId);
          if (targetAnchor) {
            setRequestedTargetPage(targetAnchor.page);
            setCurrentTargetPage(targetAnchor.page);
            // Select the alignment to show the connection
            setSelectedAlignment(alignment);
          } else {
            // Clear any selected alignment since we're doing a search navigation
            setSelectedAlignment(null);
          }
        } else {
          // Clear any selected alignment since we're doing a search navigation
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    } else if (targetLangMatch) {
      // Find the target anchor at this page and row number
      anchor = targetAnchors.find(a => a.page === page && a.rowNumber === rowNumber) || null;

      setRequestedTargetPage(page);
      setCurrentTargetPage(page); // Also update current page
      setSearchHighlightAnchor(anchor);

      // Find the alignment containing this target anchor and navigate source to it
      if (anchor) {
        // Check both primary anchorId and targetAnchorIds array
        const alignment = alignments.find(al =>
          al.targetAnchorId === anchor!.anchorId ||
          al.targetAnchorIds?.includes(anchor!.anchorId)
        );
        if (alignment) {
          // Get first source anchor from the alignment
          const sourceAnchorId = alignment.sourceAnchorIds?.[0] || alignment.sourceAnchorId;
          const sourceAnchor = sourceAnchors.find(a => a.anchorId === sourceAnchorId);
          if (sourceAnchor) {
            setRequestedSourcePage(sourceAnchor.page);
            setCurrentSourcePage(sourceAnchor.page);
            // Select the alignment to show the connection
            setSelectedAlignment(alignment);
          } else {
            // Clear any selected alignment since we're doing a search navigation
            setSelectedAlignment(null);
          }
        } else {
          // Clear any selected alignment since we're doing a search navigation
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    }
  };

  // Reset dual view state and go back to document selection
  const handleResetDualView = () => {
    setSourceDocument(null);
    setTargetDocument(null);
    setSourceFileData(null);
    setTargetFileData(null);
    setSourceAnchors([]);
    setTargetAnchors([]);
    setAlignments([]);
    setSelectedAlignment(null);
    setSourceDocId('');
    setTargetDocId('');
    setCurrentSourcePage(1);
    setCurrentTargetPage(1);
    setChunkMap(new Map());
    setRequestedSourcePage(undefined);
    setRequestedTargetPage(undefined);
    setSearchHighlightAnchor(null);
    setSourceDocCached(false);
    setTargetDocCached(false);
  };

  // Build memoized lookup maps for O(1) anchor access
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

  const pageToSourceAnchorIds = useMemo(() => {
    const map = new Map<number, Set<string>>();
    sourceAnchors.forEach(anchor => {
      if (!map.has(anchor.page)) {
        map.set(anchor.page, new Set());
      }
      map.get(anchor.page)!.add(anchor.anchorId);
    });
    return map;
  }, [sourceAnchors]);

  // Filter alignments by current source page - O(N) instead of O(N*M)
  // For multi-chunk alignments, check if ANY source anchor is on the current page
  const filteredAlignments = useMemo(() => {
    const anchorIdsOnPage = pageToSourceAnchorIds.get(currentSourcePage);
    if (!anchorIdsOnPage) return [];

    return alignments.filter(alignment => {
      // Check primary source anchor
      if (anchorIdsOnPage.has(alignment.sourceAnchorId)) {
        return true;
      }
      // For multi-chunk alignments, check all source anchors
      if (alignment.sourceAnchorIds) {
        return alignment.sourceAnchorIds.some(anchorId => anchorIdsOnPage.has(anchorId));
      }
      return false;
    });
  }, [alignments, pageToSourceAnchorIds, currentSourcePage]);

  // Get selected source and target anchors for highlighting - O(K) instead of O(M*K)
  // Priority: search highlight > alignment selection
  const selectedSourceAnchors = useMemo(() => {
    if (searchHighlightAnchor && anchorIdToSourceAnchor.has(searchHighlightAnchor.anchorId)) {
      return [searchHighlightAnchor];
    }
    if (selectedAlignment) {
      // Use all source anchors if available (for multi-chunk alignments like "2-1", "3-1")
      const anchorIds = selectedAlignment.sourceAnchorIds || [selectedAlignment.sourceAnchorId];
      return anchorIds
        .map(id => anchorIdToSourceAnchor.get(id))
        .filter((anchor): anchor is Anchor => anchor !== undefined);
    }
    return [];
  }, [searchHighlightAnchor, selectedAlignment, anchorIdToSourceAnchor]);

  const selectedTargetAnchors = useMemo(() => {
    if (searchHighlightAnchor && anchorIdToTargetAnchor.has(searchHighlightAnchor.anchorId)) {
      return [searchHighlightAnchor];
    }
    if (selectedAlignment) {
      // Use all target anchors if available (for multi-chunk alignments like "1-2", "1-3")
      const anchorIds = selectedAlignment.targetAnchorIds || [selectedAlignment.targetAnchorId];
      return anchorIds
        .map(id => anchorIdToTargetAnchor.get(id))
        .filter((anchor): anchor is Anchor => anchor !== undefined);
    }
    return [];
  }, [searchHighlightAnchor, selectedAlignment, anchorIdToTargetAnchor]);


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
            {viewMode === 'dual' && sourceDocument && targetDocument && (
              <button
                onClick={handleResetDualView}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                title="Change documents"
              >
                Change Documents
              </button>
            )}
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
                  allAlignments={alignments}
                  sourceAnchors={sourceAnchors}
                  targetAnchors={targetAnchors}
                  onSelect={handleAlignmentSelect}
                  selectedAlignmentId={selectedAlignment?.alignmentId}
                  onAudit={handleAuditClick}
                  chunkMap={chunkMap}
                  sourceLanguage={sourceLanguage}
                  targetLanguage={targetLanguage}
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
            ? anchorIdToSourceAnchor.get(selectedAlignment.sourceAnchorId) || null
            : null
        }
        targetAnchor={
          selectedAlignment
            ? anchorIdToTargetAnchor.get(selectedAlignment.targetAnchorId) || null
            : null
        }
        sourceAnchors={sourceAnchors}
        targetAnchors={targetAnchors}
        sourceLabel={sourceDocument?.filename || "Source"}
        targetLabel={targetDocument?.filename || "Target"}
      />
    </main>
  );
}
