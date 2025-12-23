"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { AuditSession } from "@/types/schemas";
import { authFetch } from "@/lib/authFetch";

const DEFAULT_AUDIT_PANEL_WIDTH = 600;
const MIN_AUDIT_PANEL_WIDTH = 360;

const formatTaskTypeLabel = (taskType: AuditSession["taskType"]) => {
  switch (taskType) {
    case "audit":
      return "Audit Translation Quality";
    case "explain":
      return "Explain Relationship";
    case "compare":
      return "Compare Texts";
    default:
      return "AI Task";
  }
};

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
          className="rounded bg-gray-200 px-1 py-0.5 text-[10px]"
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

interface AuditHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  alignmentId?: string | null; // Filter by specific alignment (optional)
}

export default function AuditHistoryPanel({
  isOpen,
  onClose,
  alignmentId,
}: AuditHistoryPanelProps) {
  const [audits, setAudits] = useState<AuditSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AuditSession | null>(null);
  const [filterByAlignment, setFilterByAlignment] = useState(false);
  const [collapsedPrompts, setCollapsedPrompts] = useState<Set<string>>(new Set());
  const [panelWidth, setPanelWidth] = useState(DEFAULT_AUDIT_PANEL_WIDTH);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(DEFAULT_AUDIT_PANEL_WIDTH);

  const loadAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query string
      const params = new URLSearchParams();
      if (filterByAlignment && alignmentId) {
        params.set('alignmentId', alignmentId);
      }
      params.set('limit', '50');
      params.set('offset', '0');

      const response = await authFetch(`/api/ai/audit/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load audit history");
      }
      const data = await response.json();
      setAudits(data.audits);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [alignmentId, filterByAlignment]);

  useEffect(() => {
    if (isOpen) {
      loadAudits();
    }
  }, [isOpen, loadAudits]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const { width: containerWidth } = container.getBoundingClientRect();
      const maxWidth = Math.max(MIN_AUDIT_PANEL_WIDTH, containerWidth - 80);
      const nextWidth = resizeStartWidth.current + (resizeStartX.current - event.clientX);
      const clampedWidth = Math.min(Math.max(nextWidth, MIN_AUDIT_PANEL_WIDTH), maxWidth);
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingPanel(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingPanel]);

  useEffect(() => {
    if (!isResizingPanel) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingPanel]);

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizingPanel(true);
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = panelWidth;
  };

  const togglePromptCollapsed = (auditId: string) => {
    setCollapsedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(auditId)) {
        next.delete(auditId);
      } else {
        next.add(auditId);
      }
      return next;
    });
  };

  const renderMarkdownBlocks = (content: string) => {
    const blocks = parseMarkdownBlocks(content);
    if (blocks.length === 0) {
      return <div className="text-xs text-gray-400">No response.</div>;
    }

    return (
      <div className="space-y-3 text-xs text-gray-800">
        {blocks.map((block, index) => {
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
                  className="overflow-auto rounded bg-gray-900 p-3 text-[10px] text-gray-100"
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
                  <table className="w-full border-collapse text-[11px] text-gray-800">
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
                <p key={`para-${index}`} className="text-xs text-gray-800">
                  {renderInlineWithBreaks(block.content)}
                </p>
              );
          }
        })}
      </div>
    );
  };

  const handleDelete = async (auditId: string) => {
    if (!confirm('Are you sure you want to delete this audit?')) {
      return;
    }

    try {
      const response = await authFetch(`/api/ai/audit/${auditId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete audit');
      }

      // Refresh list
      await loadAudits();

      // Clear selected if it was deleted
      if (selectedAudit?.auditId === auditId) {
        setSelectedAudit(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete audit');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} copied to clipboard!`);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end"
    >
      <div className="flex h-full">
        <div
          className="flex w-2 flex-shrink-0 cursor-col-resize items-stretch bg-transparent hover:bg-blue-50"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize audit history panel"
        >
          <div className="w-px bg-gray-200 self-stretch" />
        </div>
        <div
          className="bg-white h-full shadow-xl flex flex-col"
          style={{ width: panelWidth }}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Audit History</h2>
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

        {/* Filter Toggle */}
        {alignmentId && (
          <div className="p-3 border-b bg-gray-50">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={filterByAlignment}
                onChange={(e) => setFilterByAlignment(e.target.checked)}
              />
              <span>Show only audits for current alignment</span>
            </label>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded">
              {error}
            </div>
          )}

          {!loading && !error && audits.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">No audit history found</p>
              <p className="text-sm">
                Save audit results from the AI Audit modal to see them here.
              </p>
            </div>
          )}

          {!loading && !error && audits.length > 0 && (
            <div className="divide-y">
              {audits.map((audit) => (
                <div
                  key={audit.auditId}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedAudit(selectedAudit?.auditId === audit.auditId ? null : audit)}
                >
                  {/* Audit Summary */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {audit.taskName?.trim() || formatTaskTypeLabel(audit.taskType)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTaskTypeLabel(audit.taskType)} - {new Date(audit.createdAt).toLocaleString()}
                      </div>
                      {audit.sourceLanguage && audit.targetLanguage && (
                        <div className="text-xs text-gray-600 mt-1">
                          {audit.sourceLanguage} → {audit.targetLanguage}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {audit.gptModel}
                    </div>
                  </div>

                  {/* Result Preview */}
                  <div className="text-sm text-gray-700 truncate">
                    {audit.gptResponse.substring(0, 100)}...
                  </div>

                  {/* Expanded Details */}
                  {selectedAudit?.auditId === audit.auditId && (
                    <div className="mt-4 space-y-3 border-t pt-3">
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(audit.promptText, 'Prompt');
                          }}
                          className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                        >
                          Copy Prompt
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(audit.gptResponse, 'Result');
                          }}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                        >
                          Copy Result
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(audit.auditId);
                          }}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Full Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-semibold text-gray-700">Prompt:</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePromptCollapsed(audit.auditId);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {collapsedPrompts.has(audit.auditId) ? "Show Prompt" : "Hide Prompt"}
                          </button>
                        </div>
                        {!collapsedPrompts.has(audit.auditId) && (
                          <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                            {audit.promptText}
                          </pre>
                        )}
                      </div>

                      {/* Full Result */}
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">GPT Result:</div>
                        <div className="text-xs bg-gray-50 p-3 rounded border">
                          {renderMarkdownBlocks(audit.gptResponse)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && audits.length > 0 && (
          <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
            Showing {audits.length} of {total} audits
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
