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
}

export default function AIAuditModal({
  isOpen,
  onClose,
  alignment,
  sourceAnchor,
  targetAnchor,
}: AIAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<AITask>('audit');

  const handleAudit = async () => {
    if (!sourceAnchor || !targetAnchor) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
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
              quote: sourceAnchor.quote,
              documentId: sourceAnchor.documentId,
            },
            {
              anchorId: targetAnchor.anchorId,
              quote: targetAnchor.quote,
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

        {/* Source and Target Quotes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Source Text:</h3>
            <div className="border rounded p-3 bg-gray-50 text-sm max-h-32 overflow-y-auto">
              {sourceAnchor?.quote || 'N/A'}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Target Text:</h3>
            <div className="border rounded p-3 bg-gray-50 text-sm max-h-32 overflow-y-auto">
              {targetAnchor?.quote || 'N/A'}
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
            {loading ? 'Analyzing...' : 'Run AI Audit'}
          </button>
        </div>

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
