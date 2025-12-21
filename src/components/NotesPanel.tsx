"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Anchor, Note } from "@/types/schemas";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-gray-500">Loading editor...</div>,
});

interface NotesPanelProps {
  selectedAnchor: Anchor | null;
  anchors: Anchor[];
  noteContent: string;
  noteTags: string[];
  notesByAnchorId: Map<string, Note>;
  onNoteChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onNoteSave: () => void;
  onNoteDelete: () => void;
  onSelectAnchor: (anchor: Anchor) => void;
  showAnchors: boolean;
  onToggleAnchors: (enabled: boolean) => void;
}

export default function NotesPanel({
  selectedAnchor,
  anchors,
  noteContent,
  noteTags,
  notesByAnchorId,
  onNoteChange,
  onTagsChange,
  onNoteSave,
  onNoteDelete,
  onSelectAnchor,
  showAnchors,
  onToggleAnchors,
}: NotesPanelProps) {
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setHasChanges(false);
  }, [selectedAnchor]);

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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showAnchors}
              onChange={(e) => onToggleAnchors(e.target.checked)}
            />
            Show my anchors
          </label>
          {selectedAnchor && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={!hasChanges}
              >
                Save
              </button>
              <button
                onClick={onNoteDelete}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {showAnchors && anchors.length > 0 && (
          <div className="border-b bg-white">
            <div className="px-3 py-2 text-xs text-gray-500">My anchors</div>
            <div className="max-h-40 overflow-y-auto divide-y">
              {anchors.map((anchor) => (
                <button
                  key={anchor.anchorId}
                  onClick={() => onSelectAnchor(anchor)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                    selectedAnchor?.anchorId === anchor.anchorId ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="text-gray-700 truncate">
                    {anchor.quote || "Untitled anchor"}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Page {anchor.page}</span>
                    <span>{notesByAnchorId.has(anchor.anchorId) ? "Has note" : "No note"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
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
              <div className="p-3 border-b bg-gray-50">
                <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={noteTags.join(", ")}
                  onChange={(e) => {
                    const next = e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    onTagsChange(next);
                    setHasChanges(true);
                  }}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="theme, translation, motif"
                />
              </div>
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
