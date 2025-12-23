"use client";

import { useSession, signOut } from "next-auth/react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LibraryPanel from "@/components/LibraryPanel";
import ViewModeToggle from "@/components/ViewModeToggle";
import AuditHistoryPanel from "@/components/AuditHistoryPanel";
import DualViewPage from "@/components/DualViewPage";
import SingleViewPage from "@/components/SingleViewPage";
import { Document, ViewMode } from "@/types/schemas";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [dualViewHasDocuments, setDualViewHasDocuments] = useState(false);
  const [selectedAlignmentId, setSelectedAlignmentId] = useState<string | undefined>(undefined);
  const resetDualViewRef = useRef<null | (() => void)>(null);

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
            {viewMode === 'dual' && dualViewHasDocuments && (
              <button
                onClick={() => resetDualViewRef.current?.()}
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
          <SingleViewPage selectedDocument={selectedDocument} />
        ) : (
          <DualViewPage
            onRegisterReset={(reset) => {
              resetDualViewRef.current = reset;
            }}
            onDocumentsChange={setDualViewHasDocuments}
            onSelectedAlignmentIdChange={setSelectedAlignmentId}
          />
        )}
      </div>

      <LibraryPanel
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelectDocument={(doc) => setSelectedDocument(doc)}
      />

      <AuditHistoryPanel
        isOpen={auditHistoryOpen}
        onClose={() => setAuditHistoryOpen(false)}
        alignmentId={selectedAlignmentId}
      />
    </main>
  );
}
