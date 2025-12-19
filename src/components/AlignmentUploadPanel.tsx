"use client";

import { useState, useEffect } from 'react';
import { Document } from '@/types/schemas';
import { authFetch } from '@/lib/authFetch';

const SUPPORTED_LANGUAGES = [
  { code: 'ca', name: 'Catalan' },
  { code: 'zh', name: 'Chinese' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tr', name: 'Turkish' },
] as const;

const getLanguageName = (code: string) =>
  SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.name;

const getNextAvailableLanguage = (existing: string[]) =>
  SUPPORTED_LANGUAGES.find(({ code }) => !existing.includes(code))?.code;

const formatLanguageLabel = (code: string) => {
  const name = getLanguageName(code);
  return name ? `${code.toUpperCase()} · ${name}` : code.toUpperCase();
};

/**
 * Alignment Upload Panel
 * UI for uploading JSONL alignment files and configuring dual view
 * Supports both manual upload and PDF generation
 */

type UploadMode = 'upload' | 'generate';

interface AlignmentUploadPanelProps {
  documents: Document[];
  onUpload: (
    chunksFile: File,
    alignmentsFile: File,
    sourceDoc: Document,
    targetDoc: Document,
    sourceLanguage?: string,
    targetLanguage?: string
  ) => Promise<void>;
}

export default function AlignmentUploadPanel({
  documents,
  onUpload,
}: AlignmentUploadPanelProps) {
  const [mode, setMode] = useState<UploadMode>('upload');
  const [sourceDocId, setSourceDocId] = useState<string>('');
  const [targetDocId, setTargetDocId] = useState<string>('');
  const [chunksFile, setChunksFile] = useState<File | null>(null);
  const [alignmentsFile, setAlignmentsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate mode state
  const [pdfSource, setPdfSource] = useState<'drive' | 'upload'>('upload');
  const [pdfFiles, setPdfFiles] = useState<Record<string, File>>({});
  const [pdfDocIds, setPdfDocIds] = useState<Record<string, string>>({}); // For drive mode
  const [languages, setLanguages] = useState<string[]>(['en', 'it']);
  const [textField, setTextField] = useState('text');
  const [metadataFields, setMetadataFields] = useState('chunk_id,language,page');
  const [keepAllAlignments, setKeepAllAlignments] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [uploadSourceLanguage, setUploadSourceLanguage] = useState('en');
  const [uploadTargetLanguage, setUploadTargetLanguage] = useState('it');

  // Generated files for download
  const [generatedChunksId, setGeneratedChunksId] = useState<string | null>(null);
  const [generatedAlignmentsId, setGeneratedAlignmentsId] = useState<string | null>(null);
  const [generatedAlignmentFilename, setGeneratedAlignmentFilename] = useState<string>('alignment.jsonl');

  const downloadDriveFile = async (fileId: string, filename: string): Promise<File> => {
    const response = await authFetch(`/api/documents/${fileId}`);
    if (!response.ok) {
      throw new Error(`Failed to download ${filename}`);
    }
    const buffer = await response.arrayBuffer();
    return new File([buffer], filename, { type: "application/jsonl" });
  };

  const parseLangsFromFilename = (filename: string): { sourceLang?: string; targetLang?: string } => {
    const base = filename.replace(/\.jsonl$/i, "");
    const match = base.match(/([a-z]{2,})-([a-z]{2,})$/i);
    if (!match) {
      return {};
    }
    return { sourceLang: match[1].toLowerCase(), targetLang: match[2].toLowerCase() };
  };

  const normalizeAlignments = (alignments: any): Array<{
    driveFileId: string;
    filename: string;
    sourceLang?: string;
    targetLang?: string;
  }> => {
    if (Array.isArray(alignments)) {
      return alignments.map((alignment) => {
        const filename = alignment.filename || "alignment.jsonl";
        const parsed = parseLangsFromFilename(filename);
        return {
          driveFileId: alignment.driveFileId || alignment.path,
          filename,
          sourceLang: alignment.sourceLang || parsed.sourceLang,
          targetLang: alignment.targetLang || parsed.targetLang,
        };
      });
    }

    if (alignments && typeof alignments === "object") {
      return Object.entries(alignments).map(([key, value]: [string, any]) => {
        const parsed = parseLangsFromFilename(key);
        return {
          driveFileId: value.path || value.driveFileId,
          filename: `${key}.jsonl`,
          sourceLang: parsed.sourceLang,
          targetLang: parsed.targetLang,
        };
      });
    }

    return [];
  };

  const getDocsForAlignment = (sourceLang?: string, targetLang?: string) => {
    if (pdfSource !== 'drive') {
      throw new Error('Cached files are available, but auto-load requires Drive PDFs.');
    }
    if (!sourceLang || !targetLang) {
      throw new Error('Unable to determine source/target languages for cached alignment.');
    }

    const sourceDocId = pdfDocIds[sourceLang];
    const targetDocId = pdfDocIds[targetLang];

    const sourceDoc = documents.find((doc) => doc.driveFileId === sourceDocId);
    const targetDoc = documents.find((doc) => doc.driveFileId === targetDocId);

    if (!sourceDoc || !targetDoc) {
      throw new Error(`Missing selected documents for ${sourceLang}-${targetLang}.`);
    }

    return { sourceDoc, targetDoc };
  };

  const useCachedFiles = async (data: any) => {
    const chunksId = data.chunks?.driveFileId || data.chunks?.path;
    if (!chunksId) {
      throw new Error('Cached chunks file not found.');
    }

    const alignments = normalizeAlignments(data.alignments);
    if (alignments.length === 0) {
      // Alignments not found in cache - this is not an error, just means we need to generate them
      console.log('No cached alignment files found, but this is expected for new PDFs');
      return null; // Signal that we should proceed with generation instead
    }

    const preferredPairs = languages.length >= 2
      ? [
          { source: languages[0], target: languages[1] },
          { source: languages[1], target: languages[0] },
        ]
      : [];

    const selectedAlignment =
      preferredPairs
        .map((pair) => alignments.find((alignment) =>
          alignment.sourceLang === pair.source && alignment.targetLang === pair.target
        ))
        .find(Boolean) || alignments[0];

    if (!selectedAlignment || !selectedAlignment.driveFileId) {
      throw new Error('Cached alignment file is missing.');
    }

    const chunksFilename = data.chunks?.filename || "chunks.jsonl";
    const chunksFile = await downloadDriveFile(chunksId, chunksFilename);
    const alignmentsFile = await downloadDriveFile(
      selectedAlignment.driveFileId,
      selectedAlignment.filename
    );

    if (pdfSource !== 'drive') {
      setMode('upload');
      setChunksFile(chunksFile);
      setAlignmentsFile(alignmentsFile);
      alert('Cached JSONL files loaded. Select source/target documents and click Upload to continue.');
      return;
    }

    const { sourceDoc, targetDoc } = getDocsForAlignment(
      selectedAlignment.sourceLang,
      selectedAlignment.targetLang
    );

    await onUpload(
      chunksFile,
      alignmentsFile,
      sourceDoc,
      targetDoc,
      selectedAlignment.sourceLang || languages[0],
      selectedAlignment.targetLang || languages[1]
    );
  };

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
      await onUpload(
        chunksFile,
        alignmentsFile,
        sourceDoc,
        targetDoc,
        uploadSourceLanguage,
        uploadTargetLanguage
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Poll task status
  useEffect(() => {
    if (!taskId || !generating) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await authFetch(`/api/alignments/generate/${taskId}`);
        const data = await response.json();

        setProgress(data.progress);
        setProgressMessage(data.message);

        if (data.status === 'completed') {
          setGenerating(false);
          setTaskId(null);

          // Store generated file IDs for download
          const chunksId = data.result?.chunks?.path || data.result?.chunks?.driveFileId;
          if (chunksId) {
            setGeneratedChunksId(chunksId);
          }

          const alignments = normalizeAlignments(data.result?.alignments);
          if (alignments.length > 0) {
            // Prefer first alignment for download
            setGeneratedAlignmentsId(alignments[0].driveFileId);
            setGeneratedAlignmentFilename(alignments[0].filename);
          }

          try {
            const result = await useCachedFiles(data.result);
            if (result === null) {
              // No alignment files generated - this shouldn't happen after completion
              setError('Generation completed but no alignment files were created. Please try again.');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load generated files');
          }
        } else if (data.status === 'failed') {
          setGenerating(false);
          setTaskId(null);
          setError(data.error || 'Generation failed');
        }
      } catch (err) {
        console.error('Error polling task:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, generating]);

  const handleGenerate = async () => {
    if (languages.length < 2) {
      setError('Please add at least 2 languages');
      return;
    }

    // Validation based on source
    if (pdfSource === 'drive') {
      const missingDocs = languages.filter(lang => !pdfDocIds[lang]);
      if (missingDocs.length > 0) {
        setError(`Please select PDF documents for: ${missingDocs.join(', ')}`);
        return;
      }
    } else {
      const missingPdfs = languages.filter(lang => !pdfFiles[lang]);
      if (missingPdfs.length > 0) {
        setError(`Missing PDF files for: ${missingPdfs.join(', ')}`);
        return;
      }
    }

    try {
      setGenerating(true);
      setError(null);
      setProgress(0);
      setProgressMessage('Starting generation...');

      // Prepare form data
      const formData = new FormData();

      formData.append('pdfSource', pdfSource);

      if (pdfSource === 'drive') {
        // Send Drive file IDs
        formData.append('pdfDocIds', JSON.stringify(pdfDocIds));
      } else {
        // Send uploaded files
        const pdfFilesConfig: Record<string, string> = {};
        languages.forEach((lang) => {
          const fieldName = `pdf_${lang}`;
          formData.append(fieldName, pdfFiles[lang]);
          pdfFilesConfig[lang] = fieldName;
        });
        formData.append('pdfFiles', JSON.stringify(pdfFilesConfig));
      }

      formData.append('textField', textField);
      formData.append('metadataFields', metadataFields);
      formData.append('runAlignment', 'true');
      formData.append('keepAllAlignments', keepAllAlignments.toString());

      // Start generation
      const response = await authFetch('/api/alignments/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Generation request failed');
      }

      const data = await response.json();

      if (data.cached) {
        try {
          const result = await useCachedFiles(data);
          if (result === null) {
            // Cache found chunks but not alignments - tell user to regenerate
            setError('Cached chunks found but alignment files are missing. The system will now generate alignment files. Please click "Generate Alignment Files" again to proceed.');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load cached files');
        } finally {
          setGenerating(false);
        }
      } else {
        // Start polling
        setTaskId(data.taskId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setGenerating(false);
    }
  };

  const addLanguage = () => {
    const nextLang = getNextAvailableLanguage(languages);
    if (!nextLang) {
      setError('All supported languages have been added.');
      return;
    }
    setLanguages([...languages, nextLang]);
    setError(null);
  };

  const handleLanguageChange = (index: number, newLang: string) => {
    const oldLang = languages[index];

    if (!SUPPORTED_LANGUAGES.some((lang) => lang.code === newLang)) {
      setError('Selected language is not supported');
      return;
    }

    if (languages.some((lang, i) => i !== index && lang === newLang)) {
      setError(`Language "${newLang}" is already added`);
      return;
    }

    if (newLang === oldLang) {
      setError(null);
      return;
    }

    const updatedLanguages = [...languages];
    updatedLanguages[index] = newLang;

    const updatedPdfDocIds = { ...pdfDocIds };
    if (updatedPdfDocIds[oldLang]) {
      updatedPdfDocIds[newLang] = updatedPdfDocIds[oldLang];
    }
    delete updatedPdfDocIds[oldLang];

    const updatedPdfFiles = { ...pdfFiles };
    if (updatedPdfFiles[oldLang]) {
      updatedPdfFiles[newLang] = updatedPdfFiles[oldLang];
    }
    delete updatedPdfFiles[oldLang];

    setLanguages(updatedLanguages);
    setPdfDocIds(updatedPdfDocIds);
    setPdfFiles(updatedPdfFiles);
    setError(null);
  };

  const removeLanguage = (lang: string) => {
    if (languages.length <= 2) {
      setError('Must have at least 2 languages');
      return;
    }
    setLanguages(languages.filter(l => l !== lang));
    const newPdfFiles = { ...pdfFiles };
    delete newPdfFiles[lang];
    setPdfFiles(newPdfFiles);
  };

  // Download JSONL file helper
  const handleDownload = (fileId: string, filename: string) => {
    const url = `/api/alignments/download?fileId=${encodeURIComponent(fileId)}&filename=${encodeURIComponent(filename)}`;
    window.location.href = url;
  };

  const canUpload = sourceDocId && targetDocId && chunksFile && alignmentsFile && !uploading;
  const canGenerate = languages.length >= 2 && !generating &&
    (pdfSource === 'drive'
      ? languages.every(lang => pdfDocIds[lang])
      : languages.every(lang => pdfFiles[lang]));

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dual View Setup</h2>
        <p className="text-gray-600">
          {mode === 'upload'
            ? 'Upload alignment files to view documents side-by-side with synchronized scrolling'
            : 'Generate alignment files from PDFs using AI-powered alignment'}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setMode('upload')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            mode === 'upload'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Upload JSONL Files
        </button>
        <button
          onClick={() => setMode('generate')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            mode === 'generate'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Generate from PDFs
        </button>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <>
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
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Source Language
                  </label>
                  <select
                    value={uploadSourceLanguage}
                    onChange={(e) => setUploadSourceLanguage(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={uploading}
                  >
                    {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {code.toUpperCase()} — {name}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Target Language
                  </label>
                  <select
                    value={uploadTargetLanguage}
                    onChange={(e) => setUploadTargetLanguage(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={uploading}
                  >
                    {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {code.toUpperCase()} — {name}
                      </option>
                    ))}
                  </select>
                </div>
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
        </>
      )}

      {/* Generate Mode */}
      {mode === 'generate' && (
        <>
          {/* PDF Source Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">1. Choose PDF Source</h3>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="drive"
                  checked={pdfSource === 'drive'}
                  onChange={(e) => setPdfSource(e.target.value as 'drive' | 'upload')}
                  disabled={generating}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Select from Google Drive</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="upload"
                  checked={pdfSource === 'upload'}
                  onChange={(e) => setPdfSource(e.target.value as 'drive' | 'upload')}
                  disabled={generating}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Upload from Computer</span>
              </label>
            </div>
          </div>

          {/* PDF Files Selection/Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              2. {pdfSource === 'drive' ? 'Select PDF Documents' : 'Upload PDF Files'}
            </h3>

            <div className="space-y-3">
              {pdfSource === 'drive' ? (
                // From Google Drive
                <>
                  {languages.map((lang, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Language
                        </label>
                        <select
                          value={lang}
                          onChange={(e) => handleLanguageChange(index, e.target.value)}
                          className="w-full border rounded px-3 py-2"
                          disabled={generating}
                        >
                          {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                            <option key={code} value={code}>
                              {code.toUpperCase()} — {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {formatLanguageLabel(lang)} Document
                        </label>
                        <select
                          value={pdfDocIds[lang] || ''}
                          onChange={(e) => setPdfDocIds({ ...pdfDocIds, [lang]: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                          disabled={generating}
                        >
                          <option value="">Select PDF...</option>
                          {documents.filter(d => d.mimeType === 'application/pdf').map((doc) => (
                            <option key={doc.driveFileId} value={doc.driveFileId}>
                              {doc.filename}
                            </option>
                          ))}
                        </select>
                      </div>
                      {languages.length > 2 && (
                        <button
                          onClick={() => removeLanguage(lang)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                          disabled={generating}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                // Upload from Computer
                <>
                  {languages.map((lang, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Language
                        </label>
                        <select
                          value={lang}
                          onChange={(e) => handleLanguageChange(index, e.target.value)}
                          className="w-full border rounded px-3 py-2"
                          disabled={generating}
                        >
                          {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                            <option key={code} value={code}>
                              {code.toUpperCase()} — {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {formatLanguageLabel(lang)} PDF File
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPdfFiles({ ...pdfFiles, [lang]: file });
                            }
                          }}
                          className="w-full border rounded px-3 py-2"
                          disabled={generating}
                        />
                        {pdfFiles[lang] && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {pdfFiles[lang].name} ({(pdfFiles[lang].size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>
                      {languages.length > 2 && (
                        <button
                          onClick={() => removeLanguage(lang)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                          disabled={generating}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}

              <button
                onClick={addLanguage}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                disabled={generating}
              >
                + Add Another Language
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">3. Configure Fields (Advanced)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Field Name
                </label>
                <input
                  type="text"
                  value={textField}
                  onChange={(e) => setTextField(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={generating}
                  placeholder="text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metadata Fields (comma-separated)
                </label>
                <input
                  type="text"
                  value={metadataFields}
                  onChange={(e) => setMetadataFields(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={generating}
                  placeholder="chunk_id,language,page"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="keepAllAlignments"
                checked={keepAllAlignments}
                onChange={(e) => setKeepAllAlignments(e.target.checked)}
                disabled={generating}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="keepAllAlignments" className="text-sm font-medium text-gray-700 cursor-pointer">
                Keep all alignments (including unmatched chunks)
              </label>
            </div>
          </div>

          {/* Progress Bar */}
          {generating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{progressMessage}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating JSONL Files...' : 'Generate Alignment Files'}
            </button>
            {!canGenerate && !generating && (
              <p className="text-sm text-gray-500 text-center mt-2">
                {pdfSource === 'drive'
                  ? 'Select PDF documents for all languages'
                  : 'Upload PDF files for all languages'}
              </p>
            )}
          </div>

          {/* Download Generated Files */}
          {(generatedChunksId || generatedAlignmentsId) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Download Generated Files:</h4>
              <div className="flex gap-2">
                {generatedChunksId && (
                  <button
                    onClick={() => handleDownload(generatedChunksId, 'chunks.jsonl')}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors text-sm"
                  >
                    ↓ Download Chunks
                  </button>
                )}
                {generatedAlignmentsId && (
                  <button
                    onClick={() => handleDownload(generatedAlignmentsId, generatedAlignmentFilename)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors text-sm"
                  >
                    ↓ Download Alignments
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-900 mb-2">How it works:</h4>
            <ul className="text-xs text-green-800 space-y-1 list-disc list-inside">
              <li>PDFs are converted to markdown and then to JSONL format</li>
              <li>BERT-based alignment creates language pairs automatically</li>
              <li>Results are cached for future use (no need to regenerate)</li>
              <li>Generation may take 2-5 minutes depending on PDF size</li>
            </ul>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
