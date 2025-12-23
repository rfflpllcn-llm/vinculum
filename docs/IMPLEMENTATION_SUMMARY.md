# Implementation Summary: PDF-to-JSONL Integration

## Overview

The app integrates a Python alignment pipeline to generate JSONL chunks and alignments from PDFs. It supports two paths:
- Upload existing JSONL files.
- Generate JSONL from PDFs via a background task.

Generated JSONL files are cached in Google Drive. Task state is persisted in Supabase.

## What Is Implemented

### 1. Python pipeline (/python)

- `python/wrapper.py` provides a CLI interface for Node.js.
- Pipeline modules under `python/pdfalign_aligner`, `python/bertalign`, `python/pdf_pipeline`, and `python/validation`.
- Outputs chunks.jsonl and alignment JSONL files to a target folder and emits JSON to stdout for the API.

### 2. Backend services

**JSONL cache** (`src/lib/jsonlCache.ts`)
- Cache key is a SHA-256 hash of PDF content + config.
- Cache files stored in Google Drive under `/Vinculum_Data/Metadata/Cache/`.
- Cache metadata validates config (text field, metadata fields, alignment runs).

**Task manager** (`src/lib/taskManager.ts`)
- Task state stored in Supabase table `generation_tasks`.
- Tracks status, progress, messages, results, errors, and timestamps.
- Cleanup endpoint removes old completed/failed tasks.

### 3. API routes

- `POST /api/alignments/generate`
  - Accepts PDFs from Drive or upload.
  - Computes hashes and checks cache.
  - Spawns Python pipeline on cache miss and returns a task id.
- `GET /api/alignments/generate/[taskId]`
  - Polls Supabase task state.
- `POST /api/alignments/upload`
  - Parses JSONL and persists anchors + alignments in Drive.
  - Merges existing manual anchors with alignment anchors.
- `GET /api/health`
  - Simple health check for deployment.
- `GET /api/cron/cleanup-generation-tasks`
  - Removes stale completed/failed tasks (configurable).

### 4. Frontend

**AlignmentUploadPanel** (`src/components/AlignmentUploadPanel.tsx`)
- Upload vs Generate tabs.
- Drive or local PDF source for generation.
- Language configuration and visible language selection.
- Progress polling for long-running tasks.
- Cached JSONL auto-load support.

**Dual view**
- Sidebar alignment list and search panel.
- Sync scroll toggle and caching controls.

## Data Flow

### Cache hit
```
PDFs -> hash -> cache hit -> return cached JSONL -> load dual view
```

### Cache miss
```
PDFs -> hash -> create task -> run Python -> save JSONL to Drive cache -> update task -> load dual view
```

## Configuration

Default fields:
```
textField: "text"
metadataFields: ["chunk_id", "language", "page"]
```

Custom fields are supported via the generate UI and are stored in cache metadata.

## Performance Notes

- Processing time scales with page count and number of languages.
- Cache hits are near-instant; cache misses take minutes for large PDFs.
- Task progress is polled (no streaming).

## Known Limitations

- Python pipeline is single-process per task.
- Progress uses polling (no WebSocket stream).
- Alignment creation is JSONL-based (no manual alignment UI).
- Markdown document rendering is not implemented (PDF-only viewer).

## Local Development

Prereqs:
- Node.js 18+
- Python 3.11+

Setup:
```
npm install
pip install -r python/requirements.txt
npm run dev
```

## File Map (core pieces)

```
python/
  wrapper.py
  requirements.txt
  pdfalign_aligner/
  bertalign/
  pdf_pipeline/
src/
  app/api/alignments/generate/
  app/api/alignments/upload/
  app/api/alignments/generate/[taskId]/
  app/api/cron/cleanup-generation-tasks/
  app/api/health/
  components/AlignmentUploadPanel.tsx
  lib/jsonlCache.ts
  lib/taskManager.ts
```
