"use client";

import { useState } from 'react';
import Modal from './Modal';
import { Anchor, Alignment, AITask } from '@/types/schemas';

/**
 * AI Audit Modal Component
 * Allows user to request AI analysis of text alignments
 */

interface AIAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  alignment: Alignment | null;
  sourceAnchor: Anchor | null;
  targetAnchor: Anchor | null;
  sourceAnchors: Anchor[];
  targetAnchors: Anchor[];
  sourceLabel?: string;
  targetLabel?: string;
}

export default function AIAuditModal({
  isOpen,
  onClose,
  alignment,
  sourceAnchor,
  targetAnchor,
  sourceAnchors,
  targetAnchors,
  sourceLabel = "Source",
  targetLabel = "Target",
}: AIAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<AITask>('audit');
  const [includeContext, setIncludeContext] = useState(true);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const contextEnabled = task === 'audit' && includeContext;
  const sourceQuote = sourceAnchor
    ? (contextEnabled ? buildContextQuote(sourceAnchor, sourceAnchors, 2) : sourceAnchor.quote)
    : '';
  const targetQuote = targetAnchor
    ? (contextEnabled ? buildContextQuote(targetAnchor, targetAnchors, 2) : targetAnchor.quote)
    : '';

  const handleAudit = async () => {
    if (!sourceAnchor || !targetAnchor) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPrompt(null);
    setCopyState('idle');

    try {
      if (task === 'audit') {
        const promptText = buildAuditPrompt({
          orgLanguage: sourceLabel,
          srcLanguage: targetLabel,
          tgtLanguage: "N/A",
          excerptOrig: sourceQuote,
          excerptSrc: targetQuote,
          excerptTgt: "—",
        });
        setPrompt(promptText);
        return;
      }

      const response = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          anchors: [
            {
              anchorId: sourceAnchor.anchorId,
              quote: sourceQuote,
              documentId: sourceAnchor.documentId,
            },
            {
              anchorId: targetAnchor.anchorId,
              quote: targetQuote,
              documentId: targetAnchor.documentId,
            },
          ],
          notes: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to audit alignment');
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Reset state when modal opens
  const handleOpen = () => {
    setResult(null);
    setError(null);
    setTask('audit');
    setIncludeContext(true);
    setPrompt(null);
    setCopyState('idle');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Alignment Audit"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Task Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Task Type:</label>
          <select
            value={task}
            onChange={(e) => setTask(e.target.value as AITask)}
            className="w-full border rounded px-3 py-2"
            disabled={loading}
          >
            <option value="audit">Audit Translation Quality</option>
            <option value="explain">Explain Relationship</option>
            <option value="compare">Compare Texts</option>
          </select>
        </div>

        {task === 'audit' && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              disabled={loading}
            />
            Include surrounding rows (±2)
          </label>
        )}

        {/* Source and Target Quotes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Source Text:</h3>
            <div className="border rounded p-3 bg-gray-50 text-sm max-h-32 overflow-y-auto">
              {sourceAnchor ? sourceQuote || 'N/A' : 'N/A'}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Target Text:</h3>
            <div className="border rounded p-3 bg-gray-50 text-sm max-h-32 overflow-y-auto">
              {targetAnchor ? targetQuote || 'N/A' : 'N/A'}
            </div>
          </div>
        </div>

        {/* Alignment Metadata */}
        {alignment && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            Type: {alignment.type} | Confidence: {(alignment.confidence * 100).toFixed(0)}%
          </div>
        )}

        {/* Audit Button */}
        <div>
          <button
            onClick={handleAudit}
            disabled={loading || !sourceAnchor || !targetAnchor}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Preparing...' : (task === 'audit' ? 'Prepare Prompt' : 'Run AI Audit')}
          </button>
        </div>

        {prompt && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Copyable Prompt</h3>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    setCopyState('copied');
                  } catch {
                    setCopyState('failed');
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Copy prompt
              </button>
            </div>
            {copyState === 'copied' && (
              <div className="text-xs text-green-700">Copied to clipboard.</div>
            )}
            {copyState === 'failed' && (
              <div className="text-xs text-red-700">Copy failed. Select and copy manually.</div>
            )}
            <textarea
              readOnly
              value={prompt}
              className="w-full h-64 border rounded p-2 text-xs font-mono"
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="border rounded p-4 bg-white">
            <h3 className="text-sm font-semibold mb-2">AI Analysis:</h3>
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={result} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function buildContextQuote(anchor: Anchor, anchors: Anchor[], radius: number): string {
  if (!anchor.rowNumber) {
    return anchor.quote;
  }

  const ordered = anchors
    .filter((item) => item.rowNumber != null)
    .slice()
    .sort((a, b) => (a.page - b.page) || ((a.rowNumber ?? 0) - (b.rowNumber ?? 0)));

  const index = ordered.findIndex((item) => item.anchorId === anchor.anchorId);
  if (index === -1) {
    return anchor.quote;
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(ordered.length, index + radius + 1);
  return ordered.slice(start, end).map((item) => item.quote).join("\n");
}

function buildAuditPrompt({
  orgLanguage,
  srcLanguage,
  tgtLanguage,
  excerptOrig,
  excerptSrc,
  excerptTgt,
}: {
  orgLanguage: string;
  srcLanguage: string;
  tgtLanguage: string;
  excerptOrig: string;
  excerptSrc: string;
  excerptTgt: string;
}): string {
  return `Analyze and align the translation against the original text.

CRITICAL INSTRUCTIONS:
1. **Find the alignment/intersection point**: Identify where the texts correspond to each other
2. **Segment ALL text**: Break down the ENTIRE provided text into aligned segments (not just significant parts)
3. **Maintain correspondence**: Each row must contain corresponding segments from the two versions
4. **Handle misalignments**: If texts don't align perfectly, note additions/omissions/reorderings

Output ONLY a Markdown table with these columns:
| Segment | ${orgLanguage} | ${srcLanguage} | Alignment Notes |

Column descriptions:
- **Segment**: Segment number (1, 2, 3, ...)
- **${orgLanguage} (Original)**: The original text segment in ${orgLanguage}
- **${srcLanguage}**: Corresponding translation in ${srcLanguage}
- **Alignment Notes**: How translation align with original; note additions (+), omissions (-), reorderings, or semantic shifts

IMPORTANT:
- Cover the COMPLETE text from the two versions
- Start from the first identifiable correspondence point
- If one version has extra text, mark cells as "—" (em dash) for missing segments
- Be thorough and systematic

---

**Original (${orgLanguage}):**
${excerptOrig}

**Translation 1 (${srcLanguage}):**
${excerptSrc}`;
}

/**
 * Simple Markdown Renderer
 * Renders markdown with anchor reference support
 */
function MarkdownRenderer({ content }: { content: string }) {
  // Parse anchor references: [anchor:anchorId]
  const parts = content.split(/(\[anchor:[^\]]+\])/g);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        const anchorMatch = part.match(/\[anchor:([^\]]+)\]/);
        if (anchorMatch) {
          const anchorId = anchorMatch[1];
          return (
            <span
              key={index}
              className="text-blue-600 underline cursor-pointer hover:text-blue-800"
              onClick={() => {
                console.log('Navigate to anchor:', anchorId);
              }}
            >
              [Anchor {anchorId.substring(0, 8)}]
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
