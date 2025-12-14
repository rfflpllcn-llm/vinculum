"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LibraryPanel from "@/components/LibraryPanel";
import PDFViewer from "@/components/PDFViewer";
import NotesPanel from "@/components/NotesPanel";
import { Document, NormalizedRect, Anchor } from "@/types/schemas";
import { generateUUID } from "@/lib/utils";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<Anchor | null>(null);
  const [noteContent, setNoteContent] = useState("");

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
        {selectedDocument && fileData ? (
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
        )}
      </div>

      <LibraryPanel
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelectDocument={(doc) => setSelectedDocument(doc)}
      />
    </main>
  );
}
