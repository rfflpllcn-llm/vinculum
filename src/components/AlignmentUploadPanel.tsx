"use client";

import { useState } from 'react';
import { Document } from '@/types/schemas';

/**
 * Alignment Upload Panel
 * UI for uploading JSONL alignment files and configuring dual view
 */

interface AlignmentUploadPanelProps {
  documents: Document[];
  onUpload: (
    chunksFile: File,
    alignmentsFile: File,
    sourceDoc: Document,
    targetDoc: Document
  ) => Promise<void>;
}

export default function AlignmentUploadPanel({
  documents,
  onUpload,
}: AlignmentUploadPanelProps) {
  const [sourceDocId, setSourceDocId] = useState<string>('');
  const [targetDocId, setTargetDocId] = useState<string>('');
  const [chunksFile, setChunksFile] = useState<File | null>(null);
  const [alignmentsFile, setAlignmentsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!sourceDocId || !targetDocId || !chunksFile || !alignmentsFile) {
      setError('Please select both documents and both JSONL files');
      return;
    }

    const sourceDoc = documents.find(d => d.driveFileId === sourceDocId);
    const targetDoc = documents.find(d => d.driveFileId === targetDocId);

    if (!sourceDoc || !targetDoc) {
      setError('Invalid document selection');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      await onUpload(chunksFile, alignmentsFile, sourceDoc, targetDoc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const canUpload = sourceDocId && targetDocId && chunksFile && alignmentsFile && !uploading;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dual View Setup</h2>
        <p className="text-gray-600">
          Upload alignment files to view documents side-by-side with synchronized scrolling
        </p>
      </div>

      {/* Document Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">1. Select Documents</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Document
            </label>
            <select
              value={sourceDocId}
              onChange={(e) => setSourceDocId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            >
              <option value="">Select source...</option>
              {documents.map((doc) => (
                <option key={doc.driveFileId} value={doc.driveFileId}>
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Document
            </label>
            <select
              value={targetDocId}
              onChange={(e) => setTargetDocId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            >
              <option value="">Select target...</option>
              {documents.map((doc) => (
                <option key={doc.driveFileId} value={doc.driveFileId}>
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">2. Upload JSONL Files</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language Chunks File (.jsonl)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Format: {`{"text": "...", "chunk_id": N, "language": "en/it", "page": "001"}`}
            </p>
            <input
              type="file"
              accept=".jsonl,.json"
              onChange={(e) => setChunksFile(e.target.files?.[0] || null)}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            />
            {chunksFile && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {chunksFile.name} ({(chunksFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alignments File (.jsonl)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Format: {`{"alignment_id": N, "src_text": "...", "tgt_text": "...", "src_chunks": [...], "tgt_chunks": [...]}`}
            </p>
            <input
              type="file"
              accept=".jsonl,.json"
              onChange={(e) => setAlignmentsFile(e.target.files?.[0] || null)}
              className="w-full border rounded px-3 py-2"
              disabled={uploading}
            />
            {alignmentsFile && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {alignmentsFile.name} ({(alignmentsFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Upload Button */}
      <div>
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading and Processing...' : 'Upload and Load Alignments'}
        </button>
        {!canUpload && !uploading && (
          <p className="text-sm text-gray-500 text-center mt-2">
            Complete all fields above to enable upload
          </p>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Expected JSONL Format:</h4>
        <div className="text-xs text-blue-800 space-y-2">
          <div>
            <strong>Chunks file:</strong> One chunk per line
            <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
              {`{"text": "Nel mezzo del cammin...", "chunk_id": 1, "language": "it", "page": "001"}`}
            </pre>
          </div>
          <div>
            <strong>Alignments file:</strong> One alignment per line
            <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
              {`{"alignment_id": 1, "src_chunks": [1], "tgt_chunks": [2], ...}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
