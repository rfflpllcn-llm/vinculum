"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AIAuditModal from "@/components/AIAuditModal";
import AlignmentUploadPanel from "@/components/AlignmentUploadPanel";
import DualViewAlignmentSidebar from "@/components/DualViewAlignmentSidebar";
import DualViewSearchSidebar from "@/components/DualViewSearchSidebar";
import DualViewWorkspace from "@/components/DualViewWorkspace";
import { Alignment, Anchor, Document } from "@/types/schemas";
import { authFetch } from "@/lib/authFetch";
import { cachePDF, getCachedPDF, isPDFCached } from "@/lib/pdfCache";

type DualViewPageProps = {
  onRegisterReset?: (reset: () => void) => void;
  onDocumentsChange?: (hasDocuments: boolean) => void;
  onSelectedAlignmentIdChange?: (alignmentId: string | undefined) => void;
};

export default function DualViewPage({
  onRegisterReset,
  onDocumentsChange,
  onSelectedAlignmentIdChange,
}: DualViewPageProps) {
  const [loadingAlignmentData, setLoadingAlignmentData] = useState(false);
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
  const [currentSourcePage, setCurrentSourcePage] = useState<number>(1);
  const [currentTargetPage, setCurrentTargetPage] = useState<number>(1);
  const [chunkMap, setChunkMap] = useState<Map<number, any>>(new Map());
  const [requestedSourcePage, setRequestedSourcePage] = useState<number | undefined>(undefined);
  const [requestedTargetPage, setRequestedTargetPage] = useState<number | undefined>(undefined);
  const [searchHighlightAnchor, setSearchHighlightAnchor] = useState<Anchor | null>(null);
  const [useCache, setUseCache] = useState(true);
  const [sourceDocCached, setSourceDocCached] = useState(false);
  const [targetDocCached, setTargetDocCached] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<string>("en");
  const [targetLanguage, setTargetLanguage] = useState<string>("it");
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(null);
  const [alignmentMeta, setAlignmentMeta] = useState<Array<{
    driveFileId: string;
    filename: string;
    sourceLang?: string;
    targetLang?: string;
  }>>([]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await authFetch("/api/documents");
        if (response.ok) {
          const data = await response.json();
          setAvailableDocuments(data.documents || []);
        }
      } catch (error) {
        console.error("Error loading documents:", error);
      }
    };

    loadDocuments();
  }, []);

  const handleResetDualView = useCallback(() => {
    setSourceDocument(null);
    setTargetDocument(null);
    setSourceFileData(null);
    setTargetFileData(null);
    setSourceAnchors([]);
    setTargetAnchors([]);
    setAlignments([]);
    setSelectedAlignment(null);
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
  }, []);

  useEffect(() => {
    onRegisterReset?.(handleResetDualView);
  }, [handleResetDualView, onRegisterReset]);

  const hasDocuments = Boolean(sourceDocument && targetDocument);
  useEffect(() => {
    onDocumentsChange?.(hasDocuments);
  }, [hasDocuments, onDocumentsChange]);

  useEffect(() => {
    onSelectedAlignmentIdChange?.(selectedAlignment?.alignmentId);
  }, [onSelectedAlignmentIdChange, selectedAlignment]);

  const loadDocumentData = async (
    driveFileId: string,
    filename: string,
    forceRefresh: boolean = false
  ): Promise<ArrayBuffer> => {
    if (useCache && !forceRefresh) {
      const cached = await getCachedPDF(driveFileId);
      if (cached) {
        console.log(`Using cached PDF: ${filename} (${(cached.size / 1024 / 1024).toFixed(2)} MB)`);
        return cached.data;
      }
    }

    console.log(`Downloading PDF from Drive: ${filename}`);
    const response = await authFetch(`/api/documents/${driveFileId}`);
    if (!response.ok) throw new Error(`Failed to load file: ${filename}`);
    const arrayBuffer = await response.arrayBuffer();

    try {
      await cachePDF(driveFileId, filename, arrayBuffer);
      console.log(`Cached PDF: ${filename} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.warn("Failed to cache PDF:", error);
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
      formData.append("chunksFile", chunksFile);
      formData.append("alignmentsFile", alignmentsFile);
      formData.append("sourceDocId", sourceDoc.documentId);
      formData.append("targetDocId", targetDoc.documentId);
      formData.append("sourceDriveFileId", sourceDoc.driveFileId);
      formData.append("targetDriveFileId", targetDoc.driveFileId);
      if (sourceLanguageHint) formData.append("sourceLanguage", sourceLanguageHint);
      if (targetLanguageHint) formData.append("targetLanguage", targetLanguageHint);

      const response = await authFetch("/api/alignments/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload alignments");

      const result = await response.json();
      console.log("Alignment upload result:", result);

      setSourceDocument(sourceDoc);
      setTargetDocument(targetDoc);
      setLoadingAlignmentData(true);

      const [sourceCached, targetCached] = await Promise.all([
        isPDFCached(sourceDoc.driveFileId),
        isPDFCached(targetDoc.driveFileId),
      ]);
      setSourceDocCached(sourceCached);
      setTargetDocCached(targetCached);

      const [sourceData, targetData] = await Promise.all([
        loadDocumentData(sourceDoc.driveFileId, sourceDoc.filename),
        loadDocumentData(targetDoc.driveFileId, targetDoc.filename),
      ]);

      setSourceFileData(sourceData);
      setTargetFileData(targetData);
      setSourceDocCached(true);
      setTargetDocCached(true);

      const [sourceAnchorsData, targetAnchorsData] = await Promise.all([
        authFetch(`/api/anchors?documentId=${sourceDoc.documentId}`).then((r) => r.json()),
        authFetch(`/api/anchors?documentId=${targetDoc.documentId}`).then((r) => r.json()),
      ]);

      setSourceAnchors(sourceAnchorsData.anchors || []);
      setTargetAnchors(targetAnchorsData.anchors || []);

      const alignmentsResponse = await authFetch(
        `/api/alignments?sourceDocId=${sourceDoc.documentId}&targetDocId=${targetDoc.documentId}`
      );
      const alignmentsData = await alignmentsResponse.json();
      setAlignments(alignmentsData.alignments || []);

      const { parseJSONL } = await import("@/lib/alignmentParser");
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

      const langArray = Array.from(languages).sort();
      if (sourceLanguageHint && targetLanguageHint) {
        setSourceLanguage(sourceLanguageHint);
        setTargetLanguage(targetLanguageHint);
      } else if (langArray.length >= 2) {
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[1]);
      } else if (langArray.length === 1) {
        setSourceLanguage(langArray[0]);
        setTargetLanguage(langArray[0]);
      }

      if (options?.alignmentMeta) {
        setAlignmentMeta(options.alignmentMeta);
      } else {
        setAlignmentMeta([]);
      }

      setOriginalLanguage(options?.originalLanguage || null);
      setLoadingAlignmentData(false);

      alert(
        `Loaded ${result.sourceAnchorsCount} source anchors, ${result.targetAnchorsCount} target anchors, and ${result.alignmentsCount} alignments!`
      );
    } catch (error) {
      console.error("Error uploading alignments:", error);
      setLoadingAlignmentData(false);
      alert(
        "Failed to upload alignments: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
      throw error;
    }
  };

  const handleAlignmentSelect = (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    setSearchHighlightAnchor(null);
  };

  const handleAuditClick = (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    setShowAuditModal(true);
    setSearchHighlightAnchor(null);
  };

  const handleSearchNavigate = (page: number, lang: string, rowNumber?: number) => {
    const sourceLangMatch = sourceDocument?.filename.toLowerCase().includes(lang.toLowerCase());
    const targetLangMatch = targetDocument?.filename.toLowerCase().includes(lang.toLowerCase());

    let anchor: Anchor | null = null;

    if (sourceLangMatch) {
      anchor = sourceAnchors.find((a) => a.page === page && a.rowNumber === rowNumber) || null;

      setRequestedSourcePage(page);
      setCurrentSourcePage(page);
      setSearchHighlightAnchor(anchor);

      if (anchor) {
        const alignment = alignments.find(
          (al) => al.sourceAnchorId === anchor!.anchorId || al.sourceAnchorIds?.includes(anchor!.anchorId)
        );
        if (alignment) {
          const targetAnchorId = alignment.targetAnchorIds?.[0] || alignment.targetAnchorId;
          const targetAnchor = targetAnchors.find((a) => a.anchorId === targetAnchorId);
          if (targetAnchor) {
            setRequestedTargetPage(targetAnchor.page);
            setCurrentTargetPage(targetAnchor.page);
            setSelectedAlignment(alignment);
          } else {
            setSelectedAlignment(null);
          }
        } else {
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    } else if (targetLangMatch) {
      anchor = targetAnchors.find((a) => a.page === page && a.rowNumber === rowNumber) || null;

      setRequestedTargetPage(page);
      setCurrentTargetPage(page);
      setSearchHighlightAnchor(anchor);

      if (anchor) {
        const alignment = alignments.find(
          (al) => al.targetAnchorId === anchor!.anchorId || al.targetAnchorIds?.includes(anchor!.anchorId)
        );
        if (alignment) {
          const sourceAnchorId = alignment.sourceAnchorIds?.[0] || alignment.sourceAnchorId;
          const sourceAnchor = sourceAnchors.find((a) => a.anchorId === sourceAnchorId);
          if (sourceAnchor) {
            setRequestedSourcePage(sourceAnchor.page);
            setCurrentSourcePage(sourceAnchor.page);
            setSelectedAlignment(alignment);
          } else {
            setSelectedAlignment(null);
          }
        } else {
          setSelectedAlignment(null);
        }
      } else {
        setSelectedAlignment(null);
      }
    }
  };

  const anchorIdToSourceAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    sourceAnchors.forEach((anchor) => {
      map.set(anchor.anchorId, anchor);
    });
    return map;
  }, [sourceAnchors]);

  const anchorIdToTargetAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    targetAnchors.forEach((anchor) => {
      map.set(anchor.anchorId, anchor);
    });
    return map;
  }, [targetAnchors]);

  const pageToSourceAnchorIds = useMemo(() => {
    const map = new Map<number, Set<string>>();
    sourceAnchors.forEach((anchor) => {
      if (!map.has(anchor.page)) {
        map.set(anchor.page, new Set());
      }
      map.get(anchor.page)!.add(anchor.anchorId);
    });
    return map;
  }, [sourceAnchors]);

  const filteredAlignments = useMemo(() => {
    const anchorIdsOnPage = pageToSourceAnchorIds.get(currentSourcePage);
    if (!anchorIdsOnPage) return [];

    return alignments.filter((alignment) => {
      if (anchorIdsOnPage.has(alignment.sourceAnchorId)) {
        return true;
      }
      if (alignment.sourceAnchorIds) {
        return alignment.sourceAnchorIds.some((anchorId) => anchorIdsOnPage.has(anchorId));
      }
      return false;
    });
  }, [alignments, pageToSourceAnchorIds, currentSourcePage]);

  const selectedSourceAnchors = useMemo(() => {
    if (searchHighlightAnchor && anchorIdToSourceAnchor.has(searchHighlightAnchor.anchorId)) {
      return [searchHighlightAnchor];
    }
    if (selectedAlignment) {
      const anchorIds = selectedAlignment.sourceAnchorIds || [selectedAlignment.sourceAnchorId];
      return anchorIds
        .map((id) => anchorIdToSourceAnchor.get(id))
        .filter((anchor): anchor is Anchor => anchor !== undefined);
    }
    return [];
  }, [searchHighlightAnchor, selectedAlignment, anchorIdToSourceAnchor]);

  const selectedTargetAnchors = useMemo(() => {
    if (searchHighlightAnchor && anchorIdToTargetAnchor.has(searchHighlightAnchor.anchorId)) {
      return [searchHighlightAnchor];
    }
    if (selectedAlignment) {
      const anchorIds = selectedAlignment.targetAnchorIds || [selectedAlignment.targetAnchorId];
      return anchorIds
        .map((id) => anchorIdToTargetAnchor.get(id))
        .filter((anchor): anchor is Anchor => anchor !== undefined);
    }
    return [];
  }, [searchHighlightAnchor, selectedAlignment, anchorIdToTargetAnchor]);

  const alignmentTargetPage = selectedTargetAnchors.length > 0
    ? selectedTargetAnchors[0].page
    : undefined;

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

  const handleRefreshSource = async () => {
    if (!sourceDocument) return;
    const data = await loadDocumentData(
      sourceDocument.driveFileId,
      sourceDocument.filename,
      true
    );
    setSourceFileData(data);
    setSourceDocCached(true);
  };

  const handleRefreshTarget = async () => {
    if (!targetDocument) return;
    const data = await loadDocumentData(
      targetDocument.driveFileId,
      targetDocument.filename,
      true
    );
    setTargetFileData(data);
    setTargetDocCached(true);
  };

  return (
    <>
      {sourceDocument && targetDocument && sourceFileData && targetFileData ? (
        <>
          <DualViewWorkspace
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
            requestedSourcePage={requestedSourcePage}
            requestedTargetPage={requestedTargetPage}
            alignmentTargetPage={alignmentTargetPage}
            loadingAlignmentData={loadingAlignmentData}
          />
          <DualViewSearchSidebar
            chunkMap={chunkMap}
            sourceAnchors={sourceAnchors}
            targetAnchors={targetAnchors}
            onNavigate={handleSearchNavigate}
          />
          <DualViewAlignmentSidebar
            syncScrollEnabled={syncScrollEnabled}
            useCache={useCache}
            onToggleSyncScroll={setSyncScrollEnabled}
            onToggleUseCache={setUseCache}
            currentSourcePage={currentSourcePage}
            filteredAlignmentsCount={filteredAlignments.length}
            totalAlignmentsCount={alignments.length}
            sourceDocCached={sourceDocCached}
            targetDocCached={targetDocCached}
            sourceDocument={sourceDocument}
            targetDocument={targetDocument}
            onRefreshSource={handleRefreshSource}
            onRefreshTarget={handleRefreshTarget}
            filteredAlignments={filteredAlignments}
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
        </>
      ) : (
        <div className="flex items-center justify-center w-full">
          <AlignmentUploadPanel documents={availableDocuments} onUpload={handleAlignmentUpload} />
        </div>
      )}

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
    </>
  );
}
