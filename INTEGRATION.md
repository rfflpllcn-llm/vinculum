# PDF-to-JSONL Integration Guide

This document explains how the vinculum project integrates with pdfalign-aligner to automatically generate JSONL alignment files from PDFs.

## Overview

Vinculum now supports two modes for loading alignment data:

1. **Upload Mode** (Original): Manually upload pre-generated `chunks.jsonl` and `alignments.jsonl` files
2. **Generate Mode** (New): Upload PDF files and automatically generate JSONL files using the Python pipeline

## Architecture

```
User uploads PDFs
    ↓
Next.js API receives files
    ↓
Python wrapper processes PDFs
    ↓
    ├── PDF → Markdown conversion
    ├── Markdown → chunks.jsonl
    └── BERT alignment → alignments.jsonl
    ↓
Cache in Google Drive
    ↓
Return to frontend
```

### Key Components

1. **Python Integration** (`/python`)
   - `wrapper.py` - CLI interface for Node.js
   - `pdfalign_aligner/` - PDF processing pipeline
   - `bertalign/` - BERT-based alignment
   - `pdf_pipeline/` - PDF→Markdown conversion

2. **Caching Service** (`src/lib/jsonlCache.ts`)
   - SHA-256 hashing of PDF content
   - Google Drive storage for cached files
   - Automatic cache invalidation on PDF changes

3. **Task Manager** (`src/lib/taskManager.ts`)
   - Background job tracking
   - Progress polling
   - In-memory task storage (can be migrated to Redis)

4. **API Routes**
   - `POST /api/alignments/generate` - Start JSONL generation
   - `GET /api/alignments/generate/[taskId]` - Poll generation status

5. **Frontend** (`src/components/AlignmentUploadPanel.tsx`)
   - Tab interface for Upload vs Generate
   - PDF file upload with language selection
   - Progress bar with real-time updates
   - Custom field configuration

## Using the Generate Feature

### From the UI

1. Navigate to the Dual View Setup panel
2. Click the "Generate from PDFs" tab
3. Select source and target documents
4. Upload PDF files for each language:
   - Click "Upload PDF" for each language
   - Supported: EN, IT, HU, FR, DE, ES, etc.
   - Click "+ Add Another Language" for more languages
5. (Optional) Configure custom fields:
   - **Text Field Name**: Field name for the text content (default: `text`)
   - **Metadata Fields**: Comma-separated list (default: `chunk_id,language,page`)
6. Click "Generate Alignment Files"
7. Wait for processing (2-5 minutes depending on PDF size)
8. Files are automatically cached for future use

### Custom Fields (Advanced)

For embedding generation or custom data structures, you can configure field names:

**Example: Dante Divina Commedia queries**
- Text Field: `query`
- Metadata Fields: `custom_id,cantica,canto,verse_range,source_type,query_type`

This produces JSONL like:
```json
{
  "query": "Nel mezzo del cammin di nostra vita...",
  "custom_id": "1_1_dante_original_syntactic_reorder_106ebd75",
  "cantica": 1,
  "canto": 1,
  "verse_range": "1-3",
  "source_type": "dante_original",
  "query_type": "syntactic_reorder"
}
```

### Caching Behavior

**Cache Key**: SHA-256 hash of all PDF contents combined

**Cache Hit**: If PDFs with the same hash have been processed before:
- Instant return of cached files
- No regeneration needed
- Saved in Google Drive `/Vinculum_Data/Cache/`

**Cache Miss**: If PDFs are new or modified:
- Full processing pipeline runs
- Results cached for future use
- Typically takes 2-5 minutes

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- Google Drive API credentials

### Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Install Python dependencies:
   ```bash
   pip install -r python/requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Test Python wrapper:
   ```bash
   python3 python/wrapper.py \
     --pdf-files '{"en": "/path/to/en.pdf", "it": "/path/to/it.pdf"}' \
     --output-dir ./test-output \
     --text-field text \
     --metadata-fields chunk_id,language,page
   ```

## Docker Deployment

### Build Docker Image

```bash
docker build -t vinculum:latest .
```

### Run Locally with Docker

```bash
docker-compose up
```

### Environment Variables

Required:
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXTAUTH_URL` - Application URL (e.g., https://yourapp.azurewebsites.net)
- `NEXTAUTH_SECRET` - Random secret for session encryption
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)

Optional:
- `OPENAI_API_KEY` - For AI audit features
- `NODE_ENV` - Set to `production` in production

## Azure Deployment

### Option 1: Azure Container Apps (Recommended)

1. **Create Azure resources:**
   ```bash
   az group create --name vinculum-rg --location eastus

   az containerapp env create \
     --name vinculum-env \
     --resource-group vinculum-rg \
     --location eastus
   ```

2. **Deploy container:**
   ```bash
   az containerapp create \
     --name vinculum \
     --resource-group vinculum-rg \
     --environment vinculum-env \
     --image vinculum:latest \
     --target-port 3000 \
     --ingress external \
     --env-vars \
       GOOGLE_CLIENT_ID=secretref:google-client-id \
       GOOGLE_CLIENT_SECRET=secretref:google-client-secret \
       NEXTAUTH_URL=https://vinculum.azurecontainerapps.io \
       NEXTAUTH_SECRET=secretref:nextauth-secret
   ```

3. **Set secrets:**
   ```bash
   az containerapp secret set \
     --name vinculum \
     --resource-group vinculum-rg \
     --secrets \
       google-client-id=YOUR_CLIENT_ID \
       google-client-secret=YOUR_CLIENT_SECRET \
       nextauth-secret=YOUR_SECRET
   ```

### Option 2: Azure App Service

1. **Create App Service Plan:**
   ```bash
   az appservice plan create \
     --name vinculum-plan \
     --resource-group vinculum-rg \
     --is-linux \
     --sku B1
   ```

2. **Create Web App:**
   ```bash
   az webapp create \
     --name vinculum \
     --resource-group vinculum-rg \
     --plan vinculum-plan \
     --deployment-container-image-name vinculum:latest
   ```

3. **Configure settings:**
   ```bash
   az webapp config appsettings set \
     --name vinculum \
     --resource-group vinculum-rg \
     --settings \
       GOOGLE_CLIENT_ID=xxx \
       GOOGLE_CLIENT_SECRET=xxx \
       NEXTAUTH_URL=https://vinculum.azurewebsites.net \
       NEXTAUTH_SECRET=xxx
   ```

### CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Log in to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push image
        run: |
          az acr build \
            --registry vinculumregistry \
            --image vinculum:${{ github.sha }} \
            --image vinculum:latest \
            --file Dockerfile .

      - name: Deploy to Container App
        run: |
          az containerapp update \
            --name vinculum \
            --resource-group vinculum-rg \
            --image vinculumregistry.azurecr.io/vinculum:${{ github.sha }}
```

## Performance Considerations

### JSONL Generation Times

- **Small PDFs** (10 pages): ~1-2 minutes
- **Medium PDFs** (50 pages): ~3-5 minutes
- **Large PDFs** (100+ pages): ~10-15 minutes

Processing time depends on:
- PDF page count
- Text complexity
- Number of languages
- Server resources (CPU/RAM)

### Scaling Strategies

1. **Cache optimization**: Most requests will hit cache after first generation
2. **Task queue**: For production, migrate from in-memory to Redis-based queue
3. **Worker separation**: Move Python processing to Azure Functions for better scaling
4. **GPU acceleration**: Use GPU-enabled containers for BERT embedding (10x faster)

## Troubleshooting

### Python not found

**Error**: `python3: command not found`

**Solution**: Ensure Dockerfile installs Python correctly. Check with:
```bash
docker exec -it vinculum python3 --version
```

### Memory issues

**Error**: `Process killed due to memory limit`

**Solution**: Increase container memory in Azure:
```bash
az containerapp update \
  --name vinculum \
  --resource-group vinculum-rg \
  --cpu 2 --memory 4Gi
```

### BERT model download fails

**Error**: `Failed to download sentence-transformers model`

**Solution**: Pre-download models in Dockerfile:
```dockerfile
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/LaBSE')"
```

### Task polling timeout

**Error**: Task stuck at "Running"

**Solution**: Check Python subprocess logs. Add logging to `wrapper.py`:
```python
import logging
logging.basicConfig(level=logging.INFO)
```

## API Reference

### POST /api/alignments/generate

Start JSONL generation from PDFs.

**Request:**
```typescript
FormData {
  pdfFiles: string,        // JSON mapping: {"en": "field_name", "it": "field_name"}
  pdf_en: File,            // PDF file for English
  pdf_it: File,            // PDF file for Italian
  textField: string,       // Field name for text (default: "text")
  metadataFields: string,  // Comma-separated fields (default: "chunk_id,language,page")
  runAlignment: string,    // "true" or "false" (default: "true")
  maxAlign: string,        // Max alignment size (default: "3")
}
```

**Response (Cache Hit):**
```json
{
  "cached": true,
  "chunks": {
    "driveFileId": "xxx",
    "count": 1234
  },
  "alignments": [
    {
      "driveFileId": "yyy",
      "filename": "en-it.jsonl",
      "sourceLang": "en",
      "targetLang": "it",
      "count": 567
    }
  ]
}
```

**Response (Cache Miss):**
```json
{
  "cached": false,
  "taskId": "uuid",
  "status": "pending"
}
```

### GET /api/alignments/generate/[taskId]

Poll task status.

**Response:**
```json
{
  "taskId": "uuid",
  "status": "running",    // "pending" | "running" | "completed" | "failed"
  "progress": 45,         // 0-100
  "message": "Running Python pipeline...",
  "result": null,         // Populated when completed
  "error": null,          // Populated when failed
  "createdAt": "2025-12-17T10:00:00Z",
  "updatedAt": "2025-12-17T10:02:30Z"
}
```

## Future Enhancements

1. **Redis task queue** - Replace in-memory task storage
2. **Azure Blob Storage** - Use instead of Google Drive for caching
3. **Webhook notifications** - Alert when generation completes
4. **Batch processing** - Queue multiple PDF sets
5. **GPU support** - Faster BERT embeddings
6. **Streaming progress** - WebSocket updates instead of polling
7. **Resume interrupted tasks** - Checkpoint system for long processes

## Support

For issues or questions:
- GitHub Issues: [vinculum/issues](https://github.com/yourusername/vinculum/issues)
- Email: support@yourdomain.com
