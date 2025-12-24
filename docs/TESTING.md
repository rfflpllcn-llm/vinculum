# Testing Guide - Vinculum

This guide describes a local test flow for current features (single view, dual view, alignment upload/generation, AI audit).

## Prerequisites

- Node.js 18+ and npm
- Google account (Drive + OAuth)
- Supabase service role key (audit history + generation task tracking)
- Optional: OpenAI API key (AI explain/compare)
- Optional: Python 3 + pip (alignment generation)
- PDFs to test with (selectable text recommended)

## Step 1: Configure Google OAuth

1. Go to https://console.cloud.google.com/
2. Create a new project.
3. Enable the Google Drive API.
4. Configure OAuth consent screen (External, test user added).
5. Create OAuth client ID (Web application).
   - Redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret.

Scopes to include:
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/drive.appdata`

## Step 2: Configure Environment Variables

1. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here

   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=generate_a_random_secret_here

   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Optional - required for AI explain/compare
   OPENAI_API_KEY=your_openai_api_key

   # Optional - cron security for cleanup route
   CRON_SECRET=your_cron_secret
   ```

3. Generate `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

## Step 3: Initialize Supabase tables

1. In your Supabase project, open SQL Editor -> New query.
2. Paste the contents of `docs/supabase_builder.sql`.
3. Run the query to create the required tables, indexes, and RLS policies.

Note: the script drops and recreates `documents`, `generation_tasks`, and `audit_sessions` (plus the `task_type_enum` type), so only run it on a fresh project or after backing up data.

## Step 4: Install and Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with Google.

## Step 5: Upload Test PDFs

1. In Google Drive, create or open `/Vinculum_Data/Books/`.
2. Upload one or more PDF files.

## Step 6: Single View Tests

1. Click **Library** and select a PDF.
2. Verify the PDF loads and page/zoom controls work.
3. Create an anchor by selecting text in the PDF.
4. In the Notes panel:
   - Type Markdown in the editor.
   - Auto-save runs after a short delay.
   - The **Save** button forces immediate save.
   - Toggle **Preview** to view rendered Markdown.
   - Toggle **Show my anchors** to display overlays.
5. Refresh the page and re-open the document.
   - Anchors and notes should reload from Drive.

## Step 7: Dual View + Alignments

1. Switch to **Dual** using the View toggle in the top bar.
2. Use **Alignment Upload**:
   - Upload a chunks JSONL file and an alignments JSONL file.
   - Select source/target documents.
3. OR use **Generate Alignment Files**:
   - Requires Python 3 + dependencies:
     ```bash
     python3 -m venv .venv
     . .venv/bin/activate
     pip install -r python/requirements.txt
     ```
   - Use the UI to generate and upload alignment files.
4. Verify:
   - Both PDFs load side-by-side.
   - Alignment list appears in the sidebar.
   - Search panel can navigate to anchors.
   - Sync scroll can be toggled.

## Step 8: AI Audit

1. Select an alignment from the sidebar.
2. Click **AI Audit**.
3. For **Audit Translation Quality**:
   - Adjust context settings if needed.
   - Edit source/target text.
   - Click **Prepare Prompt** and copy it.
   - Paste the model output and save.
4. For **Explain** or **Compare**:
   - Requires `OPENAI_API_KEY`.
   - Click **Run AI Audit** to get results.
5. Verify **Audit History** shows saved entries.

## Data Persistence Locations

Google Drive:
```
/Vinculum_Data/
  /Books/                <-- PDFs
  /Metadata/
    anchors_<docId>.json
    notes_<docId>.json
    alignment_<source>_<target>.json
    /Cache/              <-- JSONL cache (if generated)
```

Supabase:
- `documents` registry
- `audit_sessions`
- `generation_tasks`

## Known Limitations

- Markdown document rendering is not implemented (PDF-only viewer).
- Alignment creation is JSONL-based; no manual alignment UI.
- Sync scroll manual override is limited to automatic behavior (no explicit UI control).
