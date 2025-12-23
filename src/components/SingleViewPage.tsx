"use client";

import { useEffect, useState } from "react";
import PDFViewer from "@/components/PDFViewer";
import NotesPanel from "@/components/NotesPanel";
import { Anchor, Document, NormalizedRect, Note, ScrollPosition } from "@/types/schemas";
import { authFetch } from "@/lib/authFetch";

type SingleViewPageProps = {
  selectedDocument: Document | null;
};

export default function SingleViewPage({ selectedDocument }: SingleViewPageProps) {
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
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

        if (userLabel === null) {
          return;
        }

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

  const handleNoteSave = async (payload?: { markdown?: string; tags?: string[]; silent?: boolean }) => {
    if (!selectedAnchor || !selectedDocument) return;
    const tagsToSave = payload?.tags ?? noteTags;
    const markdownToSave = payload?.markdown ?? noteContent;
    const silent = payload?.silent ?? false;
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

      if (!silent) {
        alert("Note saved successfully!");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      if (!silent) {
        alert("Failed to save note");
      }
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

  if (selectedDocument && fileData) {
    return (
      <>
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
    );
  }

  if (selectedDocument) {
    return (
      <div className="flex items-center justify-center w-full">
        <div className="text-gray-500">Loading document...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Vinculum</h1>
        <p className="text-gray-600">Scholarly web application for aligned document reading</p>
        <p className="text-sm text-gray-500 mt-2">
          Click <strong>Library</strong> to get started
        </p>
      </div>
    </div>
  );
}
