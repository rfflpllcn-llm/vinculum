"use client";

import { useEffect, useMemo, useState } from "react";
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
  onNoteSave: (payload?: { markdown?: string; tags?: string[] }) => void;
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
  const [tagQuery, setTagQuery] = useState("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setHasChanges(false);
    setTagInput(noteTags.join(", "));
  }, [selectedAnchor, noteTags]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      onNoteChange(value);
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    const nextTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onTagsChange(nextTags);
    onNoteSave({ markdown: noteContent, tags: nextTags });
    setHasChanges(false);
  };

  const handleAnchorSelect = (anchor: Anchor) => {
    if (selectedAnchor && hasChanges) {
      const nextTags = tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      onTagsChange(nextTags);
      onNoteSave({ markdown: noteContent, tags: nextTags });
      setHasChanges(false);
    }
    onSelectAnchor(anchor);
  };

  const normalizedTagQuery = tagQuery.trim().toLowerCase();
  const queryTags = normalizedTagQuery
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const filteredAnchors = useMemo(() => {
    let result = anchors;
    if (queryTags.length > 0) {
      result = anchors.filter((anchor) => {
        const note = notesByAnchorId.get(anchor.anchorId);
        if (!note) return false;
        const noteTags = note.tags.map((tag) => tag.toLowerCase());
        return queryTags.every((queryTag) =>
          noteTags.some((tag) => tag.includes(queryTag))
        );
      });
    }
    // Sort by page number
    return result.sort((a, b) => a.page - b.page);
  }, [anchors, notesByAnchorId, queryTags]);

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col min-h-0">
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

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {showAnchors && anchors.length > 0 && (
          <div className="bg-gray-50 border-b-2 border-gray-300">
            <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">My Anchors</div>
            </div>
            <div className="px-3 py-2 bg-white">
              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filter by tag..."
              />
            </div>
            <div className="max-h-120 overflow-y-auto divide-y bg-white">
              {filteredAnchors.map((anchor) => (
                <button
                  key={anchor.anchorId}
                  onClick={() => handleAnchorSelect(anchor)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                    selectedAnchor?.anchorId === anchor.anchorId ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                >
                  <div className="text-gray-700 truncate font-medium">
                    {anchor.quote || "Untitled anchor"}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                    <span>Page {anchor.page}</span>
                    <span>{notesByAnchorId.has(anchor.anchorId) ? "Has note" : "No note"}</span>
                  </div>
                </button>
              ))}
              {filteredAnchors.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-gray-400">
                  No anchors match that tag.
                </div>
              )}
            </div>
          </div>
        )}
        {selectedAnchor ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
              <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Selected Note</div>
            </div>
            <div className="p-3 border-b bg-gradient-to-b from-blue-50 to-white">
              <div className="text-xs text-gray-600 mb-1 font-medium">Anchor Quote:</div>
              <div className="text-sm text-gray-800 italic leading-relaxed">
                &ldquo;{selectedAnchor.quote}&rdquo;
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Page {selectedAnchor.page}
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-gray-50">
                <label className="block text-xs text-gray-600 mb-1 font-medium">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setHasChanges(true);
                  }}
                  onBlur={() => {
                    const next = tagInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    onTagsChange(next);
                    onNoteSave({ tags: next });
                    setHasChanges(false);
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="theme, translation, motif"
                />
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
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-500 text-center">
              Select text in the PDF to create an anchor and add notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
