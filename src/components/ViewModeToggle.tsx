"use client";

import { ViewMode } from '@/types/schemas';

/**
 * View Mode Toggle Component
 * Allows switching between single and dual PDF view
 */

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

export default function ViewModeToggle({
  viewMode,
  onChange,
  disabled = false,
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">View:</span>
      <div className="flex border rounded overflow-hidden">
        <button
          onClick={() => onChange('single')}
          disabled={disabled}
          className={`px-3 py-1 text-sm transition-colors ${
            viewMode === 'single'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Single
        </button>
        <button
          onClick={() => onChange('dual')}
          disabled={disabled}
          className={`px-3 py-1 text-sm border-l transition-colors ${
            viewMode === 'dual'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Dual
        </button>
      </div>
    </div>
  );
}
