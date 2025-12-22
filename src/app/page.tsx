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
import AuditHistoryPanel from "@/components/AuditHistoryPanel";
import { Document, NormalizedRect, Anchor, ViewMode, Alignment, Note, ScrollPosition } from "@/types/schemas";
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
  const [loadingAlignmentData, setLoadingAlignmentData] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<Anchor | null>(null);
  const [singleViewAnchors, setSingleViewAnchors] = useState<Anchor[]>([]);
  const [singleViewNotes, setSingleViewNotes] = useState<Map<string, Note>>(new Map());
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [showSingleViewAnchors, setShowSingleViewAnchors] = useState(true);
  const [singleViewScrollPosition, setSingleViewScrollPosition] = useState<ScrollPosition | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem("showSingleViewAnchors");
    if (saved !== null) {
      setShowSingleViewAnchors(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("showSingleViewAnchors", String(showSingleViewAnchors));
  }, [showSingleViewAnchors]);

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
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
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
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(null);
  const [alignmentMeta, setAlignmentMeta] = useState<Array<{
    driveFileId: string;
    filename: string;
    sourceLang?: string;
    targetLang?: string;
  }>>([]);

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
        setSingleViewAnchors([]);
        setSelectedAnchor(null);
        setSingleViewNotes(new Map());
        setNoteContent("");
        setNoteTags([]);
        return;
      }

      setLoadingFile(true);
      try {
        const [response, anchorsResponse, notesResponse] = await Promise.all([
          authFetch(`/api/documents/${selectedDocument.driveFileId}`),
          authFetch(`/api/anchors?documentId=${selectedDocument.documentId}`),
          authFetch(`/api/notes?documentId=${selectedDocument.documentId}`, {
            cache: "no-store",
          }),
        ]);

        if (!response.ok) throw new Error("Failed to load file");
        const arrayBuffer = await response.arrayBuffer();
        setFileData(arrayBuffer);

        if (anchorsResponse.ok) {
          const anchorsData = await anchorsResponse.json();
          setSingleViewAnchors(anchorsData.anchors || []);
        }

        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          const noteMap = new Map<string, Note>();
          (notesData.notes || []).forEach((note: Note) => {
            noteMap.set(note.anchorId, note);
          });
          setSingleViewNotes(noteMap);
        }
      } catch (error) {
        console.error("Error loading file:", error);
      } finally {
        setLoadingFile(false);
      }
    };

    loadFile();
  }, [selectedDocument]);

  useEffect(() => {
    if (!selectedAnchor) {
      setNoteContent("");
      setNoteTags([]);
      return;
    }

    const note = singleViewNotes.get(selectedAnchor.anchorId);
    setNoteContent(note?.markdown || "");
    setNoteTags(note?.tags || []);
  }, [selectedAnchor, singleViewNotes]);

  useEffect(() => {
    if (!selectedAnchor) return;
    const targetY = selectedAnchor.rect.y + selectedAnchor.rect.h / 2;
    const normalizedY = Math.min(1, Math.max(0, targetY));
    setSingleViewScrollPosition({
      page: selectedAnchor.page,
      offsetY: 0,
      normalizedY,
    });
    const timer = setTimeout(() => setSingleViewScrollPosition(undefined), 100);
    return () => clearTimeout(timer);
  }, [selectedAnchor]);

  const handleAnchorCreate = async (page: number, rect: NormalizedRect, quote: string) => {
    if (!selectedDocument) return;

    try {
      const trimmedQuote = quote.trim();
      const isRegion = trimmedQuote.length === 0;
      let label: string | undefined;

      if (isRegion) {
        const userLabel = window.prompt(
          "No text found in selection. Enter a description for this region:",
          ""
        );

        // If user cancels, don't create the anchor
        if (userLabel === null) {
          return;
        }

        // Use the label if provided
        label = userLabel.trim() || undefined;
      }

      const response = await authFetch("/api/anchors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocument.documentId,
          page,
          rect,
          kind: isRegion ? "region" : "text",
          quote: trimmedQuote || undefined,
          label,
        }),
      });

      if (!response.ok) throw new Error("Failed to create anchor");

      const { anchor } = await response.json();
      setSelectedAnchor(anchor);
      setSingleViewAnchors((prev) => [...prev, anchor]);
      setNoteContent("");
    } catch (error) {
      console.error("Error creating anchor:", error);
      alert("Failed to create anchor");
    }
  };

  const handleNoteSave = async (payload?: { markdown?: string; tags?: string[] }) => {
    if (!selectedAnchor || !selectedDocument) return;
    const tagsToSave = payload?.tags ?? noteTags;
    const markdownToSave = payload?.markdown ?? noteContent;
    if (payload?.tags) {
      setNoteTags(payload.tags);
    }
    if (payload?.markdown !== undefined) {
      setNoteContent(payload.markdown);
    }

    try {
      const response = await authFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocument.documentId,
          anchorId: selectedAnchor.anchorId,
          markdown: markdownToSave,
          tags: tagsToSave,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save note");

      if (data.note) {
        setSingleViewNotes((prev) => {
          const next = new Map(prev);
          if (data.note.deleted) {
            next.delete(data.note.anchorId);
          } else {
            next.set(data.note.anchorId, data.note);
          }
          return next;
        });
        setNoteTags(data.note.tags || []);
      }

      alert("Note saved successfully!");
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note");
    }
  };

  const handleNoteDelete = async () => {
    if (!selectedAnchor || !selectedDocument) return;

    if (!confirm("Delete this note?")) {
      return;
    }

    try {
      const response = await authFetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocument.documentId,
          anchorId: selectedAnchor.anchorId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete note");

      const anchorId = selectedAnchor.anchorId;
      setSingleViewNotes((prev) => {
        const next = new Map(prev);
        next.delete(anchorId);
        return next;
      });
      setNoteContent("");
      setNoteTags([]);
      alert("Note deleted");
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Failed to delete note");
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
    targetDoc: Document,
    sourceLanguageHint?: string,
    targetLanguageHint?: string,
    options?: {
      alignmentMeta?: Array<{
        driveFileId: string;
        filename: string;
        sourceLang?: string;
        targetLang?: string;
      }>;
      originalLanguage?: string | null;
    }
  ) => {
    try {
      const formData = new FormData();
      formData.append('chunksFile', chunksFile);
      formData.append('alignmentsFile', alignmentsFile);
      formData.append('sourceDocId', sourceDoc.documentId);
      formData.append('targetDocId', targetDoc.documentId);
      formData.append('sourceDriveFileId', sourceDoc.driveFileId);
      formData.append('targetDriveFileId', targetDoc.driveFileId);
      if (sourceLanguageHint) formData.append('sourceLanguage', sourceLanguageHint);
      if (targetLanguageHint) formData.append('targetLanguage', targetLanguageHint);

      const response = await authFetch('/api/alignments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload alignments');

      const result = await response.json();
      console.log('Alignment upload result:', result);

      // Store document IDs
      setSourceDocId(sourceDoc.documentId);
      setTargetDocId(targetDoc.documentId);

      // Load source and target documents with updated documentIds
      setSourceDocument(sourceDoc);
      setTargetDocument(targetDoc);

      // Set loading state - PDFs will show but data is still loading
      setLoadingAlignmentData(true);

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
        authFetch(`/api/anchors?documentId=${sourceDoc.documentId}`).then(r => r.json()),
        authFetch(`/api/anchors?documentId=${targetDoc.documentId}`).then(r => r.json()),
      ]);

      setSourceAnchors(sourceAnchorsData.anchors || []);
      setTargetAnchors(targetAnchorsData.anchors || []);

      // Load alignments
      const alignmentsResponse = await authFetch(
        `/api/alignments?sourceDocId=${sourceDoc.documentId}&targetDocId=${targetDoc.documentId}`
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
      if (sourceLanguageHint && targetLanguageHint) {
        setSourceLanguage(sourceLanguageHint);
        setTargetLanguage(targetLanguageHint);
      } else if (langArray.length >= 2) {
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[1]);
      } else if (langArray.length === 1) {
        // If only one language found, use it for both (edge case)
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[0]);
      }

      if (options?.alignmentMeta) {
        setAlignmentMeta(options.alignmentMeta);
      } else {
        setAlignmentMeta([]);
      }

      setOriginalLanguage(options?.originalLanguage || null);

      // All data loaded successfully
      setLoadingAlignmentData(false);

      alert(
        `Loaded ${result.sourceAnchorsCount} source anchors, ${result.targetAnchorsCount} target anchors, and ${result.alignmentsCount} alignments!`
      );
    } catch (error) {
      console.error('Error uploading alignments:', error);
      setLoadingAlignmentData(false);
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
    setAlignmentMeta([]);
    setOriginalLanguage(null);
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
    <main className="flex h-screen flex-col">
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
            <button
              onClick={() => setAuditHistoryOpen(true)}
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Audit History
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

      <div className="flex-1 flex bg-gray-50 overflow-hidden min-h-0">
        {viewMode === 'single' ? (
          /* Single View Mode */
          selectedDocument && fileData ? (
            <>
              {/* PDF/Document Viewer */}
              <div className="flex-1 flex flex-col min-h-0">
                {loadingFile ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Loading document...</div>
                  </div>
                ) : selectedDocument.mimeType === "application/pdf" ? (
                  <PDFViewer
                    document={selectedDocument}
                    fileData={fileData}
                    onAnchorCreate={handleAnchorCreate}
                    onAnchorSelect={setSelectedAnchor}
                    externalScrollPosition={singleViewScrollPosition}
                    highlightedAnchors={
                      showSingleViewAnchors
                        ? singleViewAnchors.filter((anchor) => anchor.rowNumber == null)
                        : []
                    }
                    selectedAnchors={selectedAnchor ? [selectedAnchor] : []}
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
        anchors={singleViewAnchors.filter(
          (anchor) => anchor.rowNumber == null
        )}
        noteContent={noteContent}
        noteTags={noteTags}
        notesByAnchorId={singleViewNotes}
        onNoteChange={setNoteContent}
        onTagsChange={setNoteTags}
        onNoteSave={handleNoteSave}
        onNoteDelete={handleNoteDelete}
        onSelectAnchor={setSelectedAnchor}
        showAnchors={showSingleViewAnchors}
        onToggleAnchors={setShowSingleViewAnchors}
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
                  onAlignmentSelect={handleAlignmentSelect}
                  onSourcePageChange={setCurrentSourcePage}
                  selectedSourceAnchors={selectedSourceAnchors}
                  selectedTargetAnchors={selectedTargetAnchors}
                  sourceScrollToPage={requestedSourcePage}
                  targetScrollToPage={requestedTargetPage !== undefined ? requestedTargetPage : alignmentTargetPage}
                />
                {/* Loading overlay */}
                {loadingAlignmentData && (
                  <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <div className="text-gray-700 font-medium">Loading alignment data...</div>
                      <div className="text-sm text-gray-500 mt-2">Please wait while chunks and alignments are being loaded</div>
                    </div>
                  </div>
                )}
              </div>
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
        sourceLanguageCode={sourceLanguage}
        targetLanguageCode={targetLanguage}
        originalLanguageCode={originalLanguage}
        alignmentMeta={alignmentMeta}
        chunkMap={chunkMap}
      />

      <AuditHistoryPanel
        isOpen={auditHistoryOpen}
        onClose={() => setAuditHistoryOpen(false)}
        alignmentId={selectedAlignment?.alignmentId}
      />
    </main>
  );
}
