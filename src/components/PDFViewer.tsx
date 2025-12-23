"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Document, NormalizedRect, ScrollPosition, Anchor } from "@/types/schemas";

// Configure PDF.js worker - use local worker file
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PDFViewerProps {
  document: Document;
  fileData: ArrayBuffer;
  onAnchorCreate?: (page: number, rect: NormalizedRect, quote: string) => void;
  externalScrollPosition?: ScrollPosition;
  onScroll?: (position: ScrollPosition) => void;
  readOnly?: boolean;
  highlightedAnchors?: Anchor[];
  selectedAnchors?: Anchor[]; // Anchors to highlight with selection color
  onPageChange?: (page: number) => void; // Callback when page changes
  onAnchorSelect?: (anchor: Anchor) => void;
}

export default function PDFViewer({
  document: doc,
  fileData,
  onAnchorCreate,
  externalScrollPosition,
  onScroll,
  readOnly = false,
  highlightedAnchors = [],
  selectedAnchors = [],
  onPageChange,
  onAnchorSelect,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<pdfjsLib.PDFRenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [pageInputValue, setPageInputValue] = useState<string>(currentPage.toString());
  const canSelectAnchors = Boolean(onAnchorSelect);

  // Load PDF document
  useEffect(() => {
    let isMounted = true;

    const loadPDF = async () => {
      try {
        if (isMounted) setLoading(true);

        if (loadingTaskRef.current) {
          await loadingTaskRef.current.destroy();
          loadingTaskRef.current = null;
        }

        if (fileData.byteLength === 0) {
          console.warn("PDFViewer: fileData buffer is detached or empty.");
          if (isMounted) setLoading(false);
          return;
        }

        const dataCopy = new Uint8Array(fileData).slice();
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        loadingTaskRef.current = loadingTask;

        const pdf = await loadingTask.promise;

        // Only update state if component is still mounted
        if (isMounted) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setLoading(false);
        }
      } catch (error) {
        // Ignore errors from cancelled/destroyed workers
        if (error instanceof Error && error.message.includes('Worker was destroyed')) {
          console.log('PDF loading cancelled (component unmounted)');
        } else {
          console.error("Error loading PDF:", error);
        }
        if (isMounted) setLoading(false);
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {
          // Ignore cleanup errors
        });
        loadingTaskRef.current = null;
      }
    };
  }, [fileData]);

  // Notify parent when page changes
  useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange]);

  // Sync page input with current page
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  // Store text content for line-based highlighting
  const [pageTextContent, setPageTextContent] = useState<any>(null);

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Cancel previous render task if it exists
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;

        // Get text content for line-based highlighting
        const textContent = await page.getTextContent();
        setPageTextContent({ textContent, viewport });
      } catch (error) {
        // Ignore cancellation errors
        if (error instanceof Error && error.name === 'RenderingCancelledException') {
          return;
        }
        console.error("Error rendering page:", error);
      }
    };

    renderPage();

    // Cleanup: cancel render task if component unmounts or dependencies change
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale]);

  // Handle scroll events and emit scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onScroll) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Calculate current scroll position
      const normalizedY = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

      const position: ScrollPosition = {
        page: currentPage,
        offsetY: scrollTop,
        normalizedY,
      };

      onScroll(position);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPage, onScroll]);

  // Handle external scroll position updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !externalScrollPosition) return;

    console.log('PDFViewer: externalScrollPosition received:', externalScrollPosition);
    console.log('PDFViewer: currentPage:', currentPage);

    // Update current page if needed
    if (externalScrollPosition.page !== currentPage) {
      console.log(`PDFViewer: Changing page from ${currentPage} to ${externalScrollPosition.page}`);
      setCurrentPage(externalScrollPosition.page);

      // Scroll will happen after page render completes
      // Give the new page time to render before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const scrollHeight = container.scrollHeight;
          const targetScrollTop = externalScrollPosition.normalizedY * scrollHeight;
          console.log(`PDFViewer: Scrolling to ${targetScrollTop} (normalizedY: ${externalScrollPosition.normalizedY})`);

          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        });
      });
    } else {
      // Same page, just scroll
      const scrollHeight = container.scrollHeight;
      const targetScrollTop = externalScrollPosition.normalizedY * scrollHeight;
      console.log(`PDFViewer: Same page scroll to ${targetScrollTop}`);

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    }
  }, [externalScrollPosition, currentPage]);

  // Handle mouse events for selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Disable selection in read-only mode
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelecting(true);
    setSelectionStart({ x, y });
    setSelectionRect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selecting || !selectionStart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = x - selectionStart.x;
    const height = y - selectionStart.y;

    setSelectionRect(
      new DOMRect(
        Math.min(selectionStart.x, x),
        Math.min(selectionStart.y, y),
        Math.abs(width),
        Math.abs(height)
      )
    );
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selecting || !selectionRect || !canvasRef.current || !pdfDoc) {
      setSelecting(false);
      setSelectionStart(null);
      setSelectionRect(null);
      return;
    }

    setSelecting(false);

    const canvas = canvasRef.current;
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });

    // Convert to normalized coordinates (0-1)
    const normalizedRect: NormalizedRect = {
      x: selectionRect.x / viewport.width,
      y: selectionRect.y / viewport.height,
      w: selectionRect.width / viewport.width,
      h: selectionRect.height / viewport.height,
    };

    // Extract text from selection
    const quote = await extractTextFromRect(page, viewport, selectionRect);

    if (onAnchorCreate) {
      onAnchorCreate(currentPage, normalizedRect, quote);
    }

    setSelectionStart(null);
    setSelectionRect(null);
  };

  type LineGroup = {
    key: number;
    items: Array<{ x: number; top: number; bottom: number; width: number; text: string }>;
    fullText: string;
  };

  const lineLayout = useMemo(() => {
    if (!pageTextContent) return null;
    const { textContent, viewport } = pageTextContent;

    const lineGroups: LineGroup[] = [];

    // Group text items into lines based on their top coordinate
    for (const item of textContent.items) {
      if (!item.transform || !item.str) continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const height = Math.abs(item.transform[3]) || 12;
      const width = (item.width || 0) * viewport.scale;

      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      const top = y - height;
      const bottom = y;

      const key = Math.round(top);
      let group = lineGroups.find((g) => Math.abs(g.key - key) <= 2);

      if (!group) {
        group = { key, items: [], fullText: "" };
        lineGroups.push(group);
      }

      group.items.push({ x, top, bottom, width, text: item.str });
    }

    // Build full text for each line and sort top to bottom
    lineGroups.forEach((group) => {
      const sortedItems = group.items.sort((a, b) => a.x - b.x);
      group.fullText = sortedItems.map((item) => item.text).join(" ").trim();
    });

    lineGroups.sort((a, b) => a.key - b.key);

    const substantialLines = lineGroups.filter(
      (g) => g.fullText.length > 3 || lineGroups.length <= 5
    );

    return { lineGroups, substantialLines, viewport };
  }, [pageTextContent]);

  /**
   * Compute line-based highlight rectangle from rowNumber using cached line groups
   * @param rowNumber - 1-indexed line number within the page
   * @param quoteText - Optional text to match for more accurate positioning
   * @returns Rectangle for the line, or null if not found
   */
  const computeLineRect = (rowNumber: number, quoteText?: string): NormalizedRect | null => {
    if (!lineLayout) return null;

    const { lineGroups, substantialLines, viewport } = lineLayout;

    let targetGroup: LineGroup | null = null;

    if (quoteText && quoteText.trim().length > 0) {
      const normalizedQuote = quoteText.trim().toLowerCase();

      targetGroup =
        substantialLines.find((g) => g.fullText.toLowerCase().includes(normalizedQuote)) ||
        null;

      if (!targetGroup && normalizedQuote.length > 10) {
        const quotePrefix = normalizedQuote.substring(0, Math.min(30, normalizedQuote.length));
        targetGroup =
          substantialLines.find((g) => g.fullText.toLowerCase().includes(quotePrefix)) || null;
      }
    }

    if (!targetGroup) {
      if (rowNumber < 1 || rowNumber > substantialLines.length) {
        console.warn(
          `Row number ${rowNumber} out of range (page has ${substantialLines.length} substantial lines out of ${lineGroups.length} total)`
        );
        if (rowNumber >= 1 && rowNumber <= lineGroups.length) {
          targetGroup = lineGroups[rowNumber - 1];
        } else {
          return null;
        }
      } else {
        targetGroup = substantialLines[rowNumber - 1];
      }
    }

    if (!targetGroup || targetGroup.items.length === 0) {
      return null;
    }

    const minX = Math.min(...targetGroup.items.map((i) => i.x));
    const maxX = Math.max(...targetGroup.items.map((i) => i.x + i.width));
    const minTop = Math.min(...targetGroup.items.map((i) => i.top));
    const maxBottom = Math.max(...targetGroup.items.map((i) => i.bottom));

    return {
      x: minX / viewport.width,
      y: minTop / viewport.height,
      w: (maxX - minX) / viewport.width,
      h: (maxBottom - minTop) / viewport.height,
    };
  };

  // Navigation handlers
  const goToPage = (page: number) => {
    const targetPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(targetPage);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(pageInputValue, 10);
      if (!isNaN(pageNum)) {
        goToPage(pageNum);
      } else {
        setPageInputValue(currentPage.toString());
      }
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue, 10);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
    } else {
      setPageInputValue(currentPage.toString());
    }
  };

  /**
   * Extract text from a rectangular selection on the PDF page
   */
  const extractTextFromRect = async (
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport,
    rect: DOMRect
  ): Promise<string> => {
    try {
      const textContent = await page.getTextContent();
      const selectedTexts: Array<{ text: string; y: number; x: number }> = [];

      // Iterate through text items and check if they're within the selection
      textContent.items.forEach((item: any) => {
        if (!item.transform || !item.str) return;

        // Get text position in viewport coordinates
        const tx = item.transform[4];
        const ty = item.transform[5];
        const itemHeight = item.height || 12;
        const itemWidth = item.width || 0;

        // Convert PDF coordinates to viewport coordinates
        const [x, y] = viewport.convertToViewportPoint(tx, ty);
        const [x2, y2] = viewport.convertToViewportPoint(
          tx + itemWidth,
          ty + itemHeight
        );

        // Check if text item is mostly within the selection rectangle
        const itemRect = {
          left: Math.min(x, x2),
          right: Math.max(x, x2),
          top: Math.min(y, y2),
          bottom: Math.max(y, y2),
        };

        const selRect = {
          left: rect.x,
          right: rect.x + rect.width,
          top: rect.y,
          bottom: rect.y + rect.height,
        };

        // Check if text item overlaps significantly with selection rectangle
        // Calculate overlap area to avoid capturing text from adjacent lines
        const hasOverlap =
          itemRect.left < selRect.right &&
          itemRect.right > selRect.left &&
          itemRect.top < selRect.bottom &&
          itemRect.bottom > selRect.top;

        if (hasOverlap) {
          // Calculate the overlapping area
          const overlapLeft = Math.max(itemRect.left, selRect.left);
          const overlapRight = Math.min(itemRect.right, selRect.right);
          const overlapTop = Math.max(itemRect.top, selRect.top);
          const overlapBottom = Math.min(itemRect.bottom, selRect.bottom);

          const overlapWidth = overlapRight - overlapLeft;
          const overlapHeight = overlapBottom - overlapTop;
          const overlapArea = overlapWidth * overlapHeight;

          const itemWidth = itemRect.right - itemRect.left;
          const itemHeight = itemRect.bottom - itemRect.top;
          const itemArea = itemWidth * itemHeight;

          // Calculate overlap ratio - what percentage of the text item is within selection
          const overlapRatio = itemArea > 0 ? overlapArea / itemArea : 0;

          // Also check vertical overlap - if selection covers most of text height, include it
          const verticalOverlap = overlapHeight / itemHeight;

          // Include text if:
          // 1. At least 50% of text area is in selection, OR
          // 2. At least 70% of text height overlaps (good for narrow horizontal selections)
          if (overlapRatio >= 0.5 || verticalOverlap >= 0.7) {
            selectedTexts.push({
              text: item.str,
              y: Math.min(y, y2),
              x: Math.min(x, x2),
            });
          }
        }
      });

      // Sort by vertical position (top to bottom), then horizontal (left to right)
      selectedTexts.sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 5) return yDiff; // Different lines
        return a.x - b.x; // Same line, sort by x
      });

      // Combine text with proper spacing
      let result = "";
      let lastY = -1;
      selectedTexts.forEach((item, index) => {
        if (lastY >= 0 && Math.abs(item.y - lastY) > 5) {
          // New line
          result += "\n";
        } else if (index > 0) {
          // Same line, add space
          result += " ";
        }
        result += item.text;
        lastY = item.y;
      });

      return result.trim();
    } catch (error) {
      console.error("Error extracting text:", error);
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading PDF...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 min-h-0">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 bg-white border-b">
        {/* Page Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage <= 1}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="First page"
          >
            ⏮
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            ◀
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Page</span>
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              className="w-14 px-2 py-1 text-sm text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Enter page number and press Enter"
            />
            <span className="text-sm text-gray-600">of {totalPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            ▶
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Last page"
          >
            ⏭
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.25))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-sm text-gray-700 min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.25))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-start justify-center"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`shadow-lg ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
          />
          {selectionRect && !readOnly && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30 pointer-events-none"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
              }}
            />
          )}
          {/* Render highlighted anchors (all anchors in yellow) */}
          {highlightedAnchors
            .filter(anchor => anchor.documentId === doc.documentId && anchor.page === currentPage)
            .map((anchor) => {
              if (!canvasRef.current) return null;
              const canvas = canvasRef.current;

              // Use line-based highlighting if rowNumber is available
              // Pass quote text for better matching across alignment types
              const rect = anchor.rowNumber != null
                ? computeLineRect(anchor.rowNumber, anchor.quote ?? "") || anchor.rect
                : anchor.rect;

              return (
                <div
                  key={anchor.anchorId}
                  className={`absolute border-2 border-yellow-500 bg-yellow-200 bg-opacity-20 ${
                    canSelectAnchors ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
                  }`}
                  style={{
                    left: rect.x * canvas.width,
                    top: rect.y * canvas.height,
                    width: rect.w * canvas.width,
                    height: rect.h * canvas.height,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnchorSelect?.(anchor);
                  }}
                />
              );
            })}
          {/* Render selected anchors (highlighted in green on top) */}
          {selectedAnchors
            .filter(anchor => anchor.documentId === doc.documentId && anchor.page === currentPage)
            .map((anchor) => {
              if (!canvasRef.current) return null;
              const canvas = canvasRef.current;

              // Use line-based highlighting if rowNumber is available
              // Pass quote text for better matching across alignment types
              const rect = anchor.rowNumber != null
                ? computeLineRect(anchor.rowNumber, anchor.quote ?? "") || anchor.rect
                : anchor.rect;

              return (
                <div
                  key={`selected-${anchor.anchorId}`}
                  className={`absolute border-2 border-green-600 bg-green-300 bg-opacity-40 ${
                    canSelectAnchors ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
                  }`}
                  style={{
                    left: rect.x * canvas.width,
                    top: rect.y * canvas.height,
                    width: rect.w * canvas.width,
                    height: rect.h * canvas.height,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnchorSelect?.(anchor);
                  }}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}
