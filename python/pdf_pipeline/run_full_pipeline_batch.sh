#!/bin/bash

# Full PDF to Markdown Pipeline with Batch Processing
# This script processes PDFs in the DATA_DIR directory
# Uses batch API processing for OCR cleaning

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="/home/rp/git/rfflpllcn-llm/pdfalign-aligner/pdf_pipeline"
PYTHON_PATH="/home/rp/git/rfflpllcn-llm/pdfalign-aligner/.venv/bin/python3"
CONFIG_FILE="$SCRIPT_DIR/../config.yaml"

# Read DATA_DIR from config.yaml (base_data_dir + source_data_subdir)
DATA_DIR=$("$PYTHON_PATH" -c "import yaml; from pathlib import Path; config = yaml.safe_load(open('$CONFIG_FILE')); print(Path(config['paths']['base_data_dir']) / config['paths']['source_data_subdir'])")

echo "========================================"
echo "PDF to Markdown Pipeline (Batch)"
echo "========================================"
echo "Data directory: $DATA_DIR"
echo ""

# 1) Normalize filenames
echo "Step 1/7: Normalizing filenames..."
"$PYTHON_PATH" "$SCRIPT_DIR/normalize_pdf_names.py" "$DATA_DIR" -r -y
echo "✓ Filenames normalized"
echo ""

# 2) Put each PDF into its own same-named folder
echo "Step 2/7: Organizing PDFs into folders..."
"$PYTHON_PATH" "$SCRIPT_DIR/organize_pdfs_into_folders.py" "$DATA_DIR" -r -y
echo "✓ PDFs organized into folders"
echo ""

# 3) Split PDFs into one file per page (keeps originals until step 4/7)
echo "Step 3/7: Splitting PDFs by page (parallel)..."
"$PYTHON_PATH" "$SCRIPT_DIR/split_pdfs_by_page_parallel.py" "$DATA_DIR" -r -y
echo "✓ PDFs split by page"
echo ""

# 4) Remove PDFs matching their folder name (post-split cleanup)
echo "Step 4/7: Removing original PDFs (post-split cleanup)..."
"$PYTHON_PATH" "$SCRIPT_DIR/remove_pdfs_matching_folder.py" -y -r "$DATA_DIR"
echo "✓ Original PDFs removed"
echo ""

# 5) Convert PDFs (remaining page-level PDFs) to Markdown
echo "Step 5/7: Converting PDFs to Markdown (parallel)..."
"$SCRIPT_DIR/run_pdf_to_markdown_parallel.sh" "$DATA_DIR"
echo "✓ PDFs converted to Markdown"
echo ""

# 6) Remove any remaining PDFs
echo "Step 6/7: Removing all remaining PDFs..."
"$PYTHON_PATH" "$SCRIPT_DIR/remove_all_pdfs.py" -y -r "$DATA_DIR"
echo "✓ All PDFs removed"
echo ""

# 7) Merge all markdown files into a single JSONL file
echo "Step 7/7: Merging markdown files into JSONL..."
"$PYTHON_PATH" "$SCRIPT_DIR/merge_md_to_jsonl.py" --config "$SCRIPT_DIR/../config.yaml"
echo "✓ Markdown files merged to JSONL"
echo ""
