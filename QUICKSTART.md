# Quick Start Guide: PDF-to-JSONL Integration

## What's New?

Vinculum now automatically generates JSONL alignment files from PDFs using the pdfalign-aligner pipeline. No need to manually run Python scripts!

## Quick Setup (Local Development)

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
pip install -r python/requirements.txt
```

### 2. Environment Variables

Create `.env.local`:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2.1 Supabase Database Setup

Create the `documents` table in Supabase (for stable `documentId` values).
SQL is documented in `audit-history-storage-implementation-plan.md`.

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Using the Feature

1. **Login** with Google
2. **Upload** your PDF documents to Google Drive via the Library panel
3. **Click** "Dual View Setup"
4. **Switch** to "Generate from PDFs" tab
5. **Select** source and target documents
6. **Upload** PDF files for each language (EN, IT, etc.)
7. **Click** "Generate Alignment Files"
8. **Wait** 2-5 minutes for processing
9. **Done!** Files are automatically loaded and cached

## Docker Quick Start

```bash
# Build
docker build -t vinculum .

# Run
docker-compose up
```

## Azure Deploy (One Command)

```bash
az containerapp up \
  --name vinculum \
  --resource-group vinculum-rg \
  --location eastus \
  --source .
```

## Custom Fields for Embeddings

For embedding use cases (e.g., Dante Divina Commedia):

1. Click "Generate from PDFs"
2. Upload your PDFs
3. Configure fields:
   - **Text Field**: `query`
   - **Metadata Fields**: `custom_id,cantica,canto,verse_range,source_type,query_type`
4. Click "Generate"

Result:
```json
{
  "query": "Nel mezzo del cammin di nostra vita...",
  "custom_id": "1_1_dante_original_syntactic_reorder_106ebd75",
  "cantica": 1,
  "canto": 1
}
```

## Troubleshooting

**Python not found?**
```bash
# Ensure Python 3.11+ is installed
python3 --version
```

**Dependencies missing?**
```bash
# Reinstall Python packages
pip install -r python/requirements.txt --force-reinstall
```

**Generation stuck?**
- Check browser console for errors
- Check server logs for Python errors
- Ensure PDFs are valid and not corrupted

## Next Steps

- Read [INTEGRATION.md](./INTEGRATION.md) for detailed documentation
- See [DUAL_VIEW_USAGE.md](./DUAL_VIEW_USAGE.md) for alignment features
- Deploy to Azure using [INTEGRATION.md#azure-deployment](./INTEGRATION.md#azure-deployment)

## Support

Questions? Open an issue on GitHub or check the documentation.
