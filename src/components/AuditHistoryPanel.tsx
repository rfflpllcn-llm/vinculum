"use client";

import { useEffect, useState } from "react";
import { AuditSession } from "@/types/schemas";
import { authFetch } from "@/lib/authFetch";

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

  useEffect(() => {
    if (isOpen) {
      loadAudits();
    }
  }, [isOpen, filterByAlignment, alignmentId]);

  const loadAudits = async () => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end">
      <div className="bg-white w-[600px] h-full shadow-xl flex flex-col">
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
                      <div className="font-medium text-gray-900 capitalize">
                        {audit.taskType} Task
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(audit.createdAt).toLocaleString()}
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
                        <div className="text-xs font-semibold text-gray-700 mb-1">Prompt:</div>
                        <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                          {audit.promptText}
                        </pre>
                      </div>

                      {/* Full Result */}
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">GPT Result:</div>
                        <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                          {audit.gptResponse}
                        </pre>
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
  );
}
