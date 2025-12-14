"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Anchor } from "@/types/schemas";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-gray-500">Loading editor...</div>,
});

interface NotesPanelProps {
  selectedAnchor: Anchor | null;
  noteContent: string;
  onNoteChange: (content: string) => void;
  onNoteSave: () => void;
}

export default function NotesPanel({
  selectedAnchor,
  noteContent,
  onNoteChange,
  onNoteSave,
}: NotesPanelProps) {
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      onNoteChange(value);
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    onNoteSave();
    setHasChanges(false);
  };

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Notes</h3>
        {selectedAnchor && hasChanges && (
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Save
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAnchor ? (
          <>
            <div className="p-3 border-b bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Anchor Quote:</div>
              <div className="text-sm text-gray-700 italic">
                &ldquo;{selectedAnchor.quote}&rdquo;
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Page {selectedAnchor.page}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                height="100%"
                defaultLanguage="markdown"
                value={noteContent}
                onChange={handleChange}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  lineNumbers: "off",
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 p-4 flex items-center justify-center">
            <p className="text-sm text-gray-500 text-center">
              Select text in the PDF to create an anchor and add notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
