"use client";

import { useEffect, useRef, useState } from "react";
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
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument({ data: fileData });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (error) {
        console.error("Error loading PDF:", error);
        setLoading(false);
      }
    };

    loadPDF();
  }, [fileData]);

  // Notify parent when page changes
  useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange]);

  // Store text content for line-based highlighting
  const [pageTextContent, setPageTextContent] = useState<any>(null);

  // Render current page
  useEffect(() => {
    let renderTask: any = null;

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
        if (renderTask) {
          renderTask.cancel();
        }

        renderTask = page.render(renderContext);
        await renderTask.promise;

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
      if (renderTask) {
        renderTask.cancel();
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

    // Update current page if needed
    if (externalScrollPosition.page !== currentPage) {
      setCurrentPage(externalScrollPosition.page);
    }

    // Scroll to position
    const scrollHeight = container.scrollHeight;
    const targetScrollTop = externalScrollPosition.normalizedY * scrollHeight;

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
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

  /**
   * Compute line-based highlight rectangle from rowNumber
   * Groups text items into lines by their top coordinate
   * @param rowNumber - 1-indexed line number within the page
   * @returns Rectangle for the line, or null if not found
   */
  const computeLineRect = (rowNumber: number): NormalizedRect | null => {
    if (!pageTextContent || !canvasRef.current) return null;

    const { textContent, viewport } = pageTextContent;
    const canvas = canvasRef.current;

    interface LineGroup {
      key: number;
      items: Array<{ x: number; top: number; bottom: number; width: number }>;
    }

    const lineGroups: LineGroup[] = [];

    // Group text items into lines based on their top coordinate
    for (const item of textContent.items) {
      if (!item.transform || !item.str) continue;

      // Transform to viewport coordinates
      const tx = item.transform[4];
      const ty = item.transform[5];
      const height = Math.abs(item.transform[3]) || 12;
      const width = (item.width || 0) * viewport.scale;

      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      const top = y - height;
      const bottom = y;

      // Use rounded top as grouping key (tolerant of small differences)
      const key = Math.round(top);
      let group = lineGroups.find(g => Math.abs(g.key - key) <= 1);

      if (!group) {
        group = { key, items: [] };
        lineGroups.push(group);
      }

      group.items.push({ x, top, bottom, width });
    }

    // Sort lines top to bottom
    lineGroups.sort((a, b) => a.key - b.key);

    // Check if rowNumber is in range (1-indexed)
    if (rowNumber < 1 || rowNumber > lineGroups.length) {
      console.warn(`Row number ${rowNumber} out of range (page has ${lineGroups.length} lines)`);
      return null;
    }

    // Get the line group (convert to 0-indexed)
    const group = lineGroups[rowNumber - 1];

    // Compute bounding box
    const minX = Math.min(...group.items.map(i => i.x));
    const maxX = Math.max(...group.items.map(i => i.x + i.width));
    const minTop = Math.min(...group.items.map(i => i.top));
    const maxBottom = Math.max(...group.items.map(i => i.bottom));

    // Normalize to 0-1 coordinates
    return {
      x: minX / viewport.width,
      y: minTop / viewport.height,
      w: (maxX - minX) / viewport.width,
      h: (maxBottom - minTop) / viewport.height,
    };
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

        // Calculate the center point of the text item
        const centerX = (itemRect.left + itemRect.right) / 2;
        const centerY = (itemRect.top + itemRect.bottom) / 2;

        // Check if the center of the text is within the selection
        // This provides more precise selection
        const isInside =
          centerX >= selRect.left &&
          centerX <= selRect.right &&
          centerY >= selRect.top &&
          centerY <= selRect.bottom;

        if (isInside) {
          selectedTexts.push({
            text: item.str,
            y: Math.min(y, y2),
            x: Math.min(x, x2),
          });
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

      return result.trim() || `Selected area on page ${currentPage}`;
    } catch (error) {
      console.error("Error extracting text:", error);
      return `Selected area on page ${currentPage}`;
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
    <div className="flex flex-col h-full bg-gray-100">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 bg-white border-b">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.25))}
            className="px-3 py-1 border rounded"
          >
            -
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.25))}
            className="px-3 py-1 border rounded"
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
              const rect = anchor.rowNumber != null
                ? computeLineRect(anchor.rowNumber) || anchor.rect
                : anchor.rect;

              return (
                <div
                  key={anchor.anchorId}
                  className="absolute border-2 border-yellow-500 bg-yellow-200 bg-opacity-20 pointer-events-none"
                  style={{
                    left: rect.x * canvas.width,
                    top: rect.y * canvas.height,
                    width: rect.w * canvas.width,
                    height: rect.h * canvas.height,
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
              const rect = anchor.rowNumber != null
                ? computeLineRect(anchor.rowNumber) || anchor.rect
                : anchor.rect;

              return (
                <div
                  key={`selected-${anchor.anchorId}`}
                  className="absolute border-2 border-green-600 bg-green-300 bg-opacity-40 pointer-events-none"
                  style={{
                    left: rect.x * canvas.width,
                    top: rect.y * canvas.height,
                    width: rect.w * canvas.width,
                    height: rect.h * canvas.height,
                  }}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}
