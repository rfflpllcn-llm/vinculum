# Dual View Mode - Usage Guide

## Overview

Dual View Mode allows you to view two PDF documents side-by-side with synchronized scrolling based on alignment metadata. This is useful for comparing translations, parallel texts, or aligned documents.

## Getting Started

### 1. Switch to Dual View Mode

- Look for the **View Mode Toggle** in the top navigation bar
- Click **"Dual"** to switch from single view to dual view mode

### 2. Provide Alignment Data (Upload or Generate)

When you enter Dual View mode for the first time, you'll see the **Alignment Upload Panel** with the following steps:

#### Option A: Upload JSONL Files

##### Step 1: Select Documents

- **Source Document**: Choose the source/original document from the dropdown
- **Target Document**: Choose the target/translated document from the dropdown

Your documents must be already uploaded to Google Drive in the `/Vinculum_Data/Books/` folder.

##### Step 2: Upload JSONL Files

You need two JSONL files:

1. **Language Chunks File** (`chunks.jsonl`)
   - Contains text segments with their metadata
   - Format: One chunk per line
   ```json
   {"text": "Nel mezzo del cammin di nostra vita", "chunk_id": 1, "language": "it", "page": "001"}
   {"text": "Midway upon the journey of our life", "chunk_id": 2, "language": "en", "page": "001"}
   ```

2. **Alignments File** (`alignments.jsonl`)
   - Contains alignment pairs linking source and target chunks
   - Format: One alignment per line
   ```json
   {"alignment_id": 1, "pair_id": 1, "src_text": "...", "tgt_text": "...", "src_chunks": [1], "tgt_chunks": [2], "src_lang": "it", "tgt_lang": "en", "alignment_type": "1-1", "validation": {...}}
   ```

##### Step 3: Upload and Process

- Click **"Upload and Load Alignments"** button
- The system will:
  1. Parse your JSONL files
  2. Create anchors for each chunk (row-number based)
  3. Save alignments to Google Drive
  4. Load the documents side-by-side

#### Option B: Generate JSONL from PDFs

##### Step 1: Choose PDF Source

- **Select from Google Drive** or **Upload from Computer**

##### Step 2: Select or Upload PDFs

- Choose PDFs for each language
- Set the **original** language and the two **visible** languages for Dual View

##### Step 3: Generate

- Click **"Generate Alignment Files"**
- The system runs the Python alignment pipeline and caches results in Drive
- You can download the generated JSONL files from the panel

## Using Dual View

Once loaded, you'll see:

### Side-by-Side PDFs

- **Left Panel**: Source document
- **Right Panel**: Target document
- **Right Sidebar**: Alignment list, search panel, and controls

### Synchronized Scrolling

- **Sync Scroll Checkbox**: Toggle synchronized scrolling on/off
- **Use Cache Checkbox**: Prefer cached PDFs when available
- **Refresh buttons**: Force a re-download from Drive
- When enabled, scrolling in the source document automatically scrolls the target document to the corresponding aligned position
- Drift constraint: ≤20px for accurate alignment

### Alignment Visualization

- Click an alignment in the sidebar to:
  - See the source and target text
  - View alignment metadata (type, confidence)
  - Highlight the corresponding anchors
  - Open the AI Audit modal

### AI Audit

- Select an alignment from the sidebar
- An AI Audit modal will open showing:
  - Source and target quotes
  - Task type selector (Audit, Explain, Compare)
  - Source/target text fields are editable
- For **Audit**:
  - Click **Prepare Prompt** and copy the prompt
  - Paste the model output and save the result
- For **Explain** or **Compare**:
  - Click **Run AI Audit** (requires `OPENAI_API_KEY`)
  - Results are shown in the modal and can be saved

## JSONL Format Requirements

### Chunks File

Required fields:
- `text` (string): The text content
- `chunk_id` (number): Unique identifier for this chunk
- `language` (string): Language code (e.g., "en", "it")
- `page` (string): Page number (e.g., "001")

### Alignments File

Required fields:
- `alignment_id` (number): Unique identifier
- `pair_id` (number): Pair identifier
- `src_text` (string): Source text
- `tgt_text` (string): Target text
- `src_lang` (string): Source language code
- `tgt_lang` (string): Target language code
- `alignment_type` (string): Type of alignment (e.g., "1-1", "1-N")
- `src_chunks` (array): Array of source chunk IDs
- `tgt_chunks` (array): Array of target chunk IDs
- `validation` (object): Validation metadata
  - `is_valid_alignment` (boolean)
  - `confidence` (number): 0.0-1.0
  - `reason` (string)
  - `validation_success` (boolean)
  - `error` (string | null)

## Tips

1. **Document Selection**: Make sure both documents are PDFs uploaded to Google Drive
2. **Language Codes**: Use consistent language codes in your JSONL files
3. **Page Numbers**: Use zero-padded strings for page numbers (e.g., "001", not "1")
4. **Row Numbers**: Chunk order drives rowNumber highlighting, so chunk order should match page order
5. **Sync Scroll**: If sync scroll isn't working well, verify that your alignment chunk IDs are correct

## Troubleshooting

### "Text not found" warnings

- These warnings can appear when row-number based highlights cannot map to visible text lines
- Verify page numbers and chunk ordering for the affected language

### Sync scroll drift

- Ensure page numbers in chunks are correct
- Verify alignment chunk ID references are valid
- Check that alignments link corresponding text segments

### Upload fails

- Verify JSONL files are valid (one JSON object per line)
- Check that chunk IDs are unique and referenced correctly in alignments
- Ensure both source and target documents are accessible

## Requirements

- Google Drive connection configured
- PDFs uploaded to `/Vinculum_Data/Books/`
- Valid JSONL alignment files (upload mode) or Python generation pipeline (generate mode)
- OpenAI API key (for Explain/Compare in AI Audit)

## Next Steps

After setting up Dual View:
1. Explore alignments in the sidebar
2. Test synchronized scrolling
3. Use AI Audit to analyze alignment quality
4. Toggle sync scroll on/off as needed
5. Switch back to Single View mode anytime using the View Mode toggle
