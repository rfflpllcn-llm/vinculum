"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Anchor, Note } from "@/types/schemas";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-gray-500">Loading editor...</div>,
});

const AUTO_SAVE_DELAY_MS = 800;

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; content: string }
  | { type: "code"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; content: string };

const splitTableRow = (line: string) => {
  const trimmed = line.trim();
  const withoutLeading = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = withoutLeading.endsWith("|")
    ? withoutLeading.slice(0, -1)
    : withoutLeading;
  return withoutTrailing.split("|").map((cell) => cell.trim());
};

const isTableSeparator = (line: string) => {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const normalizeTableRow = (cells: string[], length: number) => {
  if (cells.length >= length) return cells;
  return [...cells, ...Array.from({ length: length - cells.length }, () => "")];
};

const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let quoteLines: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push({ type: "quote", content: quoteLines.join("\n") });
    quoteLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", content: codeLines.join("\n") });
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const nextLine = lines[i + 1] ?? "";
    if (line.includes("|") && isTableSeparator(nextLine)) {
      flushParagraph();
      flushList();
      flushQuote();
      const headers = splitTableRow(line);
      i += 1; // Skip separator line
      const rows: string[][] = [];
      while (i + 1 < lines.length) {
        const rowLine = lines[i + 1];
        if (rowLine.trim() === "" || rowLine.trim().startsWith("```")) {
          break;
        }
        if (!rowLine.includes("|")) {
          break;
        }
        rows.push(splitTableRow(rowLine));
        i += 1;
      }
      const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 0);
      const normalizedHeaders = normalizeTableRow(headers, columnCount);
      const normalizedRows = rows.map((row) => normalizeTableRow(row, columnCount));
      blocks.push({ type: "table", headers: normalizedHeaders, rows: normalizedRows });
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      quoteLines.push(line.replace(/^>\s?/, ""));
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      flushQuote();
      listItems.push(listMatch[1]);
      continue;
    }

    if (listItems.length > 0) {
      flushList();
    }

    paragraphLines.push(line);
  }

  if (inCodeBlock) {
    blocks.push({ type: "code", content: codeLines.join("\n") });
  }

  flushParagraph();
  flushList();
  flushQuote();

  return blocks;
};

const renderInline = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const content = part.slice(1, -1);
      return (
        <code
          key={`code-${index}`}
          className="rounded bg-gray-200 px-1 py-0.5 text-xs"
        >
          {content}
        </code>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
};

const renderInlineWithBreaks = (text: string) => {
  const lines = text.split("\n");
  return lines.map((line, index) => (
    <span key={`line-${index}`}>
      {renderInline(line)}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
};

interface NotesPanelProps {
  selectedAnchor: Anchor | null;
  anchors: Anchor[];
  noteContent: string;
  noteTags: string[];
  notesByAnchorId: Map<string, Note>;
  onNoteChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onNoteSave: (payload?: { markdown?: string; tags?: string[]; silent?: boolean }) => void;
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
  const [showPreview, setShowPreview] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownBlocks = useMemo(
    () => (showPreview ? parseMarkdownBlocks(noteContent) : []),
    [noteContent, showPreview]
  );

  useEffect(() => {
    setHasChanges(false);
    setTagInput(noteTags.join(", "));
  }, [selectedAnchor, noteTags]);

  useEffect(() => {
    if (!selectedAnchor || !hasChanges) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const nextTags = tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      onTagsChange(nextTags);
      onNoteSave({ markdown: noteContent, tags: nextTags, silent: true });
      setHasChanges(false);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [hasChanges, noteContent, onNoteSave, onTagsChange, selectedAnchor, tagInput]);

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
      onNoteSave({ markdown: noteContent, tags: nextTags, silent: true });
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
    return [...result].sort((a, b) => a.page - b.page);
  }, [anchors, notesByAnchorId, queryTags]);

  return (
    <div className="h-full w-full bg-white flex flex-col min-h-0">
      <div className="p-4 border-b flex flex-wrap items-center gap-4">
        <h3 className="font-semibold text-gray-900">Notes</h3>
        <div className="ml-auto flex items-center gap-3">
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
                onClick={() => setShowPreview((prev) => !prev)}
                className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                {showPreview ? "Edit" : "Preview"}
              </button>
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
            <div className="max-h-[30vh] overflow-y-auto divide-y bg-white">
              {filteredAnchors.map((anchor) => (
                <button
                  key={anchor.anchorId}
                  onClick={() => handleAnchorSelect(anchor)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                    selectedAnchor?.anchorId === anchor.anchorId ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                >
                  <div className="text-gray-700 truncate font-medium">
                    {anchor.label || anchor.quote || "Untitled anchor"}
                  </div>
                  {anchor.label && anchor.quote && (
                    <div className="text-[10px] text-gray-500 italic truncate mt-0.5">
                      {anchor.quote}
                    </div>
                  )}
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
              {selectedAnchor.label ? (
                <>
                  <div className="text-xs text-gray-600 mb-1 font-medium">Label:</div>
                  <div className="text-sm text-gray-900 font-semibold mb-2">
                    {selectedAnchor.label}
                  </div>
                  {selectedAnchor.quote && (
                    <>
                      <div className="text-xs text-gray-600 mb-1 font-medium">Quote:</div>
                      <div className="text-xs text-gray-700 italic leading-relaxed">
                        &ldquo;{selectedAnchor.quote}&rdquo;
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-600 mb-1 font-medium">
                    {selectedAnchor.quote ? "Anchor Quote:" : "Anchor:"}
                  </div>
                  <div className="text-sm text-gray-800 italic leading-relaxed">
                    {selectedAnchor.quote ? (
                      <>
                        &ldquo;{selectedAnchor.quote}&rdquo;
                      </>
                    ) : (
                      "Region anchor"
                    )}
                  </div>
                </>
              )}
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
                    if (!hasChanges) return;
                    const next = tagInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    onTagsChange(next);
                    onNoteSave({ markdown: noteContent, tags: next, silent: true });
                    setHasChanges(false);
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="theme, translation, motif"
                />
              </div>
              <div className="flex-1 overflow-hidden">
                {showPreview ? (
                  <div className="h-full overflow-auto p-4 text-sm text-gray-800">
                    {noteContent.trim().length === 0 ? (
                      <div className="text-gray-400">No note content.</div>
                    ) : (
                      <div className="space-y-3">
                        {markdownBlocks.map((block, index) => {
                          switch (block.type) {
                            case "heading": {
                              const HeadingTag = `h${Math.min(block.level, 6)}` as keyof JSX.IntrinsicElements;
                              return (
                                <HeadingTag
                                  key={`heading-${index}`}
                                  className="font-semibold text-gray-900"
                                >
                                  {renderInlineWithBreaks(block.content)}
                                </HeadingTag>
                              );
                            }
                            case "list":
                              return (
                                <ul key={`list-${index}`} className="list-disc list-inside space-y-1">
                                  {block.items.map((item, itemIndex) => (
                                    <li key={`list-item-${index}-${itemIndex}`}>
                                      {renderInlineWithBreaks(item)}
                                    </li>
                                  ))}
                                </ul>
                              );
                            case "quote":
                              return (
                                <blockquote
                                  key={`quote-${index}`}
                                  className="border-l-4 border-gray-300 pl-3 italic text-gray-600"
                                >
                                  {renderInlineWithBreaks(block.content)}
                                </blockquote>
                              );
                          case "code":
                              return (
                                <pre
                                  key={`code-${index}`}
                                  className="overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100"
                                >
                                  <code>{block.content}</code>
                                </pre>
                              );
                          case "table":
                            return (
                              <div
                                key={`table-${index}`}
                                className="overflow-x-auto rounded border border-gray-200"
                              >
                                <table className="w-full border-collapse text-xs text-gray-800">
                                  <thead className="bg-gray-100 text-gray-700">
                                    <tr>
                                      {block.headers.map((header, headerIndex) => (
                                        <th
                                          key={`table-header-${index}-${headerIndex}`}
                                          className="border-b border-gray-200 px-2 py-1 text-left font-semibold"
                                        >
                                          {renderInlineWithBreaks(header)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {block.rows.map((row, rowIndex) => (
                                      <tr
                                        key={`table-row-${index}-${rowIndex}`}
                                        className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                      >
                                        {row.map((cell, cellIndex) => (
                                          <td
                                            key={`table-cell-${index}-${rowIndex}-${cellIndex}`}
                                            className="border-b border-gray-100 px-2 py-1 align-top"
                                          >
                                            {renderInlineWithBreaks(cell)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          case "paragraph":
                          default:
                            return (
                              <p key={`para-${index}`} className="text-sm text-gray-800">
                                {renderInlineWithBreaks(block.content)}
                                </p>
                              );
                          }
                        })}
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
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
