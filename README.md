# Vinculum

A scholarly web application for reading aligned documents, creating persistent anchors, and performing alignment-aware AI audit and explanation.

## Overview

Vinculum is designed for literary scholars, translators, and digital humanities researchers who work with parallel texts. It provides:

- Google Drive-backed document library
- PDF rendering with persistent anchors
- Markdown notes linked to document coordinates (auto-save + preview)
- Dual-document alignment with sync scroll
- AI audit and explanation tools
- Future: long-term memory via vector search (Phase 3)

## Current Status: Phase 2 (Alignment + AI) Complete

Phase 2 features implemented:
- Drive OAuth authentication and library browser
- Single and dual PDF viewer with sync scroll
- Anchor creation (rectangular selection) with persistent notes
- Alignment upload (JSONL) or PDF-driven generation pipeline
- AI audit modal with editable source/target text and copyable prompt
- Supabase-backed document registry, audit history, and generation task state

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **PDF Rendering**: pdfjs-dist
- **Editor**: Monaco Editor (Markdown)
- **Storage**: Google Drive (OAuth) + Supabase (PostgreSQL)
- **Authentication**: NextAuth.js
- **Alignment Pipeline**: Python 3.11 (pdfalign + bertalign)

## Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account with Drive API enabled
- Google OAuth 2.0 credentials
- Supabase project (PostgreSQL) for document registry, audit history, and task state
- Python 3.11+ (required only for alignment generation)
- OpenAI API key (optional; required for AI audit)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - Add your production URL when deploying
5. Copy your Client ID and Client Secret

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (optional; required for AI audit)
OPENAI_API_KEY=your-openai-key

# Cron + generation task retention (optional)
CRON_SECRET=your_cron_secret
GENERATION_TASK_RETENTION_HOURS=1
```

To generate a secure `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 4. Supabase Database Setup

Create tables to match `src/types/supabase.ts`.

Starting point:
- `scripts/supabase/documents.sql` for the `documents` table
- `docs/USE-CASES.md` for example `audit_sessions` SQL

### 5. (Optional) Install Python Dependencies

Required only for alignment generation:

```bash
pip install -r python/requirements.txt
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Upload Test Documents

1. Sign in with your Google account
2. Upload PDF files to your Google Drive
3. Place them in `/Vinculum_Data/Books/` folder (created automatically on first login)
4. Markdown files can be stored but render a placeholder (PDF rendering only)

## Project Structure

```
vinculum/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── documents/     # Document management
│   │   │   └── anchors/       # Anchor CRUD
│   │   ├── auth/              # Auth pages
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main application
│   ├── components/            # React components
│   │   ├── LibraryPanel.tsx   # Document browser
│   │   ├── PDFViewer.tsx      # PDF rendering
│   │   ├── NotesPanel.tsx     # Markdown notes editor
│   │   └── SessionProvider.tsx
│   ├── lib/                   # Utilities and services
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── drive.ts           # Google Drive service
│   │   └── utils.ts           # Helper functions
│   └── types/                 # TypeScript types
│       └── schemas.ts         # Data contracts
├── docs/                      # Usage + integration guides
├── python/                    # PDF alignment pipeline
├── scripts/                   # Local setup helpers
├── specs/                     # Project specifications
│   ├── AGENTS.md             # Development rules
│   └── docs/                 # Detailed specifications
└── package.json
```

## Data Schemas

All data structures conform to `specs/docs/05_DATA_SCHEMAS.md`. Key entities:

- **Document**: PDF or Markdown file from Google Drive
- **Anchor**: Spatial reference to PDF location with quoted text
- **Note**: User annotation attached to an anchor
- **Alignment**: Semantic link between two anchors (Phase 2)

Storage structure in Google Drive:
```
/Vinculum_Data/
  /Books/          # PDF and Markdown files
  /Metadata/       # Anchors, notes, alignments (JSON)
    /Cache/        # Generated JSONL cache
  /Backups/        # Future use
```

## Usage

1. **Sign In**: Click "Sign in with Google" to authenticate
2. **Browse Library**: Click "Library" to view your documents
3. **Open Document**: Select a PDF from the library
4. **Create Anchor**:
   - Click and drag to select text in the PDF
   - Release to create an anchor
5. **Add Notes**:
   - Write Markdown notes in the right panel
   - Notes auto-save after idle and on anchor switch
   - Use the Preview toggle to render Markdown
6. **Use Dual View**:
   - Toggle to Dual mode
   - Upload JSONL files or generate from PDFs
   - Review alignments and run AI audit

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Run tests
npm test
```

## Architecture

Vinculum follows a client-centric architecture:

- **Frontend (Browser)**: Renders PDFs, manages UI, handles user interactions
- **Application Server (Thin)**: OAuth, Drive API proxy, alignment pipeline orchestration
- **Storage**: Google Drive (documents, metadata, JSONL cache) + Supabase (registry, audits, tasks)
- **Future**: Vector DB (Phase 3)

See `specs/docs/07_ARCHITECTURE.md` for details.

## Roadmap

### Phase 3: Memory (Planned)
- Embedding pipeline
- Vector DB integration (Qdrant)
- Related-notes sidebar
- Conversational memory chatbot

## Documentation

All specifications are in the `specs/` directory, and usage guides are in `docs/`:

- `specs/AGENTS.md` - Development guidelines for AI agents
- `specs/docs/00_INDEX.md` - Documentation index
- `specs/docs/01_PRD.md` - Product requirements
- `specs/docs/05_DATA_SCHEMAS.md` - Data contracts (authoritative)
- `specs/docs/04_UI_SPECS.md` - UI behavior specifications
- `specs/docs/07_ARCHITECTURE.md` - System architecture
- `specs/docs/08_ACCEPTANCE_TESTS.md` - Acceptance criteria
- `docs/DUAL_VIEW_USAGE.md` - Dual view setup and workflow
- `docs/INTEGRATION.md` - Alignment generation pipeline
- `docs/HIGHLIGHTING.md` - Anchor highlighting behavior
- `docs/TESTING.md` - Test and verification steps

## Contributing

This project follows strict specification-driven development:

1. All changes must conform to specifications in `specs/docs/`
2. Data schema changes require updating:
   - `specs/docs/05_DATA_SCHEMAS.md`
   - `specs/docs/09_DECISIONS.md`
3. Follow canonical source hierarchy (see `specs/AGENTS.md`)

## License

[License to be determined]

## Support

For issues or questions, please refer to the specifications in `specs/docs/`.
