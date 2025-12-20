"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { Anchor, Alignment, AITask } from '@/types/schemas';
import { authFetch } from '@/lib/authFetch';
import { buildTripleAlignmentAuditPrompt } from '@/lib/aiPrompts';

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
  sourceLanguageCode?: string;
  targetLanguageCode?: string;
  originalLanguageCode?: string | null;
  alignmentMeta?: Array<{
    driveFileId: string;
    filename: string;
    sourceLang?: string;
    targetLang?: string;
  }>;
  chunkMap?: Map<number, any>;
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
  sourceLanguageCode,
  targetLanguageCode,
  originalLanguageCode,
  alignmentMeta = [],
  chunkMap,
}: AIAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<AITask>('audit');
  const [includeContext, setIncludeContext] = useState(true);
  const [contextBefore, setContextBefore] = useState(2);
  const [contextAfter, setContextAfter] = useState(2);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

 // Editable text state
  const [editableSourceText, setEditableSourceText] = useState<string>('');
  const [editableTargetText, setEditableTargetText] = useState<string>('');

  // Audit saving state
  const [gptResult, setGptResult] = useState<string>('');
  const [gptModel, setGptModel] = useState<string>('gpt-4');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const contextEnabled = task === 'audit' && includeContext;
  const sourceQuote = sourceAnchor
    ? (contextEnabled ? buildContextQuoteRange(sourceAnchor, sourceAnchors, contextBefore, contextAfter) : sourceAnchor.quote)
    : '';
  const targetQuote = targetAnchor
    ? (contextEnabled ? buildContextQuoteRange(targetAnchor, targetAnchors, contextBefore, contextAfter) : targetAnchor.quote)
    : '';

  // Update editable text when source/target quotes change
  useEffect(() => {
    setEditableSourceText(sourceQuote);
  }, [sourceQuote]);

  useEffect(() => {
    setEditableTargetText(targetQuote);
  }, [targetQuote]);

  const anchorIdToChunkId = useMemo(() => {
    const map = new Map<string, number>();
    if (!chunkMap) return map;

    Array.from(chunkMap.entries()).forEach(([chunkId, chunk]) => {
      const sourceMatch = sourceAnchors.find(a => a.quote === chunk.text);
      const targetMatch = targetAnchors.find(a => a.quote === chunk.text);
      if (sourceMatch) map.set(sourceMatch.anchorId, chunkId);
      if (targetMatch) map.set(targetMatch.anchorId, chunkId);
    });
    return map;
  }, [chunkMap, sourceAnchors, targetAnchors]);

  const alignmentCache = useRef<Map<string, Map<number, Set<number>>>>(new Map());

  const parseJsonlText = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (typeof parsed === 'string') {
        return parseJsonlText(parsed);
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed];
      }
    } catch {
      // Fall through to line-based parsing.
    }

    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  };

  const extractChunkIds = (chunks: Array<any> | undefined) => {
    if (!Array.isArray(chunks)) return [];
    return chunks
      .map((chunk) => (typeof chunk === 'number' ? chunk : chunk?.chunk_id))
      .filter((id): id is number => typeof id === 'number');
  };

  const loadAlignmentMap = async (sourceLang: string, targetLang: string) => {
    const meta = alignmentMeta.find(
      (entry) =>
        entry.sourceLang?.toLowerCase() === sourceLang &&
        entry.targetLang?.toLowerCase() === targetLang
    );
    if (!meta?.driveFileId) {
      return null;
    }

    if (alignmentCache.current.has(meta.driveFileId)) {
      return alignmentCache.current.get(meta.driveFileId) || null;
    }

    const response = await authFetch(`/api/documents/${meta.driveFileId}`);
    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const entries = parseJsonlText(text);
    const targetToSource = new Map<number, Set<number>>();

    entries.forEach((entry) => {
      const srcIds = extractChunkIds(entry?.src_chunks);
      const tgtIds = extractChunkIds(entry?.tgt_chunks);
      if (srcIds.length === 0 || tgtIds.length === 0) {
        return;
      }
      tgtIds.forEach((tgtId) => {
        const set = targetToSource.get(tgtId) || new Set<number>();
        srcIds.forEach((srcId) => set.add(srcId));
        targetToSource.set(tgtId, set);
      });
    });

    alignmentCache.current.set(meta.driveFileId, targetToSource);
    return targetToSource;
  };

  const buildOriginalContextText = (
    orderedChunks: Array<{ chunk_id: number; text: string }>,
    selectedChunkIds: Set<number>,
    radius: number
  ) => {
    if (orderedChunks.length === 0 || selectedChunkIds.size === 0) {
      return '';
    }

    const included = new Set<number>();
    orderedChunks.forEach((chunk, index) => {
      if (!selectedChunkIds.has(chunk.chunk_id)) {
        return;
      }
      const start = Math.max(0, index - radius);
      const end = Math.min(orderedChunks.length, index + radius + 1);
      for (let i = start; i < end; i += 1) {
        included.add(orderedChunks[i].chunk_id);
      }
    });

    return orderedChunks
      .filter((chunk) => included.has(chunk.chunk_id))
      .map((chunk) => chunk.text)
      .join('\n');
  };

  const handleAudit = async () => {
    if (!sourceAnchor || !targetAnchor) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPrompt(null);
    setCopyState('idle');

    try {
      if (task === 'audit') {
        if (!chunkMap) {
          throw new Error('Chunks are not available for AI audit.');
        }
        if (!alignment) {
          throw new Error('Alignment data is missing for AI audit.');
        }
        if (!sourceLanguageCode || !targetLanguageCode || !originalLanguageCode) {
          throw new Error('Original/source/target language codes are required.');
        }

        const normalizedSourceLang = sourceLanguageCode.toLowerCase();
        const normalizedTargetLang = targetLanguageCode.toLowerCase();
        const normalizedOriginalLang = originalLanguageCode.toLowerCase();

        const sourceAnchorIds = alignment.sourceAnchorIds || [alignment.sourceAnchorId];
        const targetAnchorIds = alignment.targetAnchorIds || [alignment.targetAnchorId];

        const sourceChunkIds = sourceAnchorIds
          .map((id) => anchorIdToChunkId.get(id))
          .filter((id): id is number => id !== undefined);
        const targetChunkIds = targetAnchorIds
          .map((id) => anchorIdToChunkId.get(id))
          .filter((id): id is number => id !== undefined);

        const originalChunkIds = new Set<number>();

        if (normalizedOriginalLang === normalizedSourceLang) {
          sourceChunkIds.forEach((id) => originalChunkIds.add(id));
        } else {
          const sourceMap = await loadAlignmentMap(normalizedOriginalLang, normalizedSourceLang);
          if (!sourceMap) {
            throw new Error(`Missing alignments for ${normalizedOriginalLang}-${normalizedSourceLang}.`);
          }
          sourceChunkIds.forEach((id) => {
            sourceMap.get(id)?.forEach((srcId) => originalChunkIds.add(srcId));
          });
        }

        if (normalizedOriginalLang === normalizedTargetLang) {
          targetChunkIds.forEach((id) => originalChunkIds.add(id));
        } else {
          const targetMap = await loadAlignmentMap(normalizedOriginalLang, normalizedTargetLang);
          if (!targetMap) {
            throw new Error(`Missing alignments for ${normalizedOriginalLang}-${normalizedTargetLang}.`);
          }
          targetChunkIds.forEach((id) => {
            targetMap.get(id)?.forEach((srcId) => originalChunkIds.add(srcId));
          });
        }

        const originalChunks = Array.from(originalChunkIds)
          .map((id) => chunkMap.get(id))
          .filter((chunk) => chunk && chunk.language === normalizedOriginalLang)
          .sort((a, b) => a.chunk_id - b.chunk_id);

        if (originalChunks.length === 0) {
          throw new Error('No original text found for the selected alignment.');
        }

        const orderedOriginalChunks = Array.from(chunkMap.values())
          .filter((chunk) => chunk && chunk.language === normalizedOriginalLang)
          .sort((a, b) => {
            const pageDiff = Number(a.page) - Number(b.page);
            return pageDiff !== 0 ? pageDiff : a.chunk_id - b.chunk_id;
          });

        const orgText = contextEnabled
          ? buildOriginalContextText(orderedOriginalChunks, originalChunkIds, 2)
          : originalChunks.map((chunk) => chunk.text).join('\n');

        const promptText = buildTripleAlignmentAuditPrompt({
          orgLanguage: normalizedOriginalLang,
          srcLanguage: normalizedSourceLang,
          tgtLanguage: normalizedTargetLang,
          orgText,
          srcText: editableSourceText,
          tgtText: editableTargetText,
        });
        setPrompt(promptText);
        return;
      }

      const response = await authFetch('/api/ai/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          anchors: [
            {
              anchorId: sourceAnchor.anchorId,
              quote: editableSourceText,
              documentId: sourceAnchor.documentId,
            },
            {
              anchorId: targetAnchor.anchorId,
              quote: editableTargetText,
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

  const handleSaveResult = async () => {
    if (!prompt || !gptResult) {
      setSaveError('Both prompt and result are required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await authFetch('/api/ai/audit/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alignmentId: alignment?.alignmentId || null,
          promptText: prompt,
          gptResponse: gptResult,
          gptModel,
          taskType: task,
          sourceText: editableSourceText,
          targetText: editableTargetText,
          originalText: null, // TODO: build original text if needed
          sourceLanguage: sourceLanguageCode,
          targetLanguage: targetLanguageCode,
          originalLanguage: originalLanguageCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Reset state when modal opens
  const handleOpen = () => {
    setResult(null);
    setError(null);
    setTask('audit');
    setIncludeContext(true);
    setContextBefore(2);
    setContextAfter(2);
    setPrompt(null);
    setCopyState('idle');
    setGptResult('');
    setGptModel('gpt-4');
    setSaving(false);
    setSaveSuccess(false);
    setSaveError(null);
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
          <div className="space-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                disabled={loading}
              />
              Include surrounding rows
            </label>
            {includeContext && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <label className="flex items-center gap-2">
                  Before
                  <input
                    type="number"
                    min={0}
                    value={contextBefore}
                    onChange={(e) => setContextBefore(Math.max(0, Number(e.target.value)))}
                    className="w-16 border rounded px-2 py-1 text-xs"
                    disabled={loading}
                  />
                </label>
                <label className="flex items-center gap-2">
                  After
                  <input
                    type="number"
                    min={0}
                    value={contextAfter}
                    onChange={(e) => setContextAfter(Math.max(0, Number(e.target.value)))}
                    className="w-16 border rounded px-2 py-1 text-xs"
                    disabled={loading}
                  />
                </label>
                <span className="text-gray-500">Example: x-2 to x+1</span>
              </div>
            )}
          </div>
        )}

        {/* Source and Target Quotes - Editable */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Source Text (editable):</h3>
            <textarea
              value={editableSourceText}
              onChange={(e) => setEditableSourceText(e.target.value)}
              disabled={loading}
              className="w-full border rounded p-3 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Source text will appear here..."
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Target Text (editable):</h3>
            <textarea
              value={editableTargetText}
              onChange={(e) => setEditableTargetText(e.target.value)}
              disabled={loading}
              className="w-full border rounded p-3 text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Target text will appear here..."
            />
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

        {/* GPT Result Input & Save */}
        {prompt && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Paste GPT Result</h3>
              <select
                value={gptModel}
                onChange={(e) => setGptModel(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="o1">o1</option>
                <option value="o1-mini">o1-mini</option>
              </select>
            </div>
            <textarea
              value={gptResult}
              onChange={(e) => setGptResult(e.target.value)}
              placeholder="Paste the markdown table result from GPT here..."
              className="w-full h-64 border rounded p-2 text-xs font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Save Button */}
            <button
              onClick={handleSaveResult}
              disabled={!gptResult || saving}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Result'}
            </button>

            {/* Success Message */}
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                <p className="font-semibold">Success!</p>
                <p className="text-sm">Audit result saved to history.</p>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                <p className="font-semibold">Error:</p>
                <p className="text-sm">{saveError}</p>
              </div>
            )}
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

function buildContextQuoteRange(anchor: Anchor, anchors: Anchor[], before: number, after: number): string {
  if (!anchor.rowNumber) {
    return anchor.quote;
  }

  const safeBefore = Math.max(0, Number.isFinite(before) ? before : 0);
  const safeAfter = Math.max(0, Number.isFinite(after) ? after : 0);

  const ordered = anchors
    .filter((item) => item.rowNumber != null)
    .slice()
    .sort((a, b) => (a.page - b.page) || ((a.rowNumber ?? 0) - (b.rowNumber ?? 0)));

  const index = ordered.findIndex((item) => item.anchorId === anchor.anchorId);
  if (index === -1) {
    return anchor.quote;
  }

  const start = Math.max(0, index - safeBefore);
  const end = Math.min(ordered.length, index + safeAfter + 1);
  return ordered.slice(start, end).map((item) => item.quote).join("\n");
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
