"use client";

import { useEffect, useState } from "react";
import { Document } from "@/types/schemas";
import { authFetch } from "@/lib/authFetch";

interface LibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (doc: Document) => void;
}

export default function LibraryPanel({
  isOpen,
  onClose,
  onSelectDocument,
}: LibraryPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/documents");
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }
      const data = await response.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-start">
      <div className="bg-white w-96 h-full shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Library</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!loading && !error && documents.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">No documents found</p>
              <p className="text-sm">
                Upload PDF or Markdown files to your Google Drive folder:
              </p>
              <p className="text-sm font-mono mt-1">
                /Vinculum_Data/Books/
              </p>
            </div>
          )}

          {!loading && !error && documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <button
                  key={doc.driveFileId}
                  onClick={() => {
                    onSelectDocument(doc);
                    onClose();
                  }}
                  className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <div className="font-medium text-gray-900 truncate">
                    {doc.filename}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {doc.mimeType === "application/pdf" ? "PDF" : "Markdown"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
