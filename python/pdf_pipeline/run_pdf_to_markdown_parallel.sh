#!/bin/bash

# Resolve script directory for repo-local paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use env-provided python if available, otherwise fall back to python3
PYTHON_PATH="${PYTHON_PATH:-python3}"
SCRIPT_PATH="${SCRIPT_DIR}/pdf_to_markdown.py"

# DATA_DIR must be passed as argument
DATA_DIR="${1:-}"
if [ -z "$DATA_DIR" ]; then
  echo "Usage: $0 <data_dir>"
  exit 1
fi
MAX_PARALLEL=5  # Adjust based on system resources

# Function to process a folder
process_folder() {
    local FOLDER_PATH=$1
    local FOLDER_NAME=$(basename "$FOLDER_PATH")
    echo "Processing folder: $FOLDER_NAME"
    "$PYTHON_PATH" "$SCRIPT_PATH" "$FOLDER_PATH"
    local EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✓ Done with: $FOLDER_NAME"
    else
        echo "✗ Error processing: $FOLDER_NAME (exit code: $EXIT_CODE)"
    fi
    echo "----------------------------------------"
    return $EXIT_CODE
}

# Export function and variables for subshells
export -f process_folder
export PYTHON_PATH SCRIPT_PATH DATA_DIR

# Find all subfolders in DATA_DIR (only direct children, not nested) - use full paths
mapfile -t FOLDERS < <(find "$DATA_DIR" -mindepth 1 -maxdepth 1 -type d)

echo "Found ${#FOLDERS[@]} subfolders in $DATA_DIR"
echo "Starting parallel processing with $MAX_PARALLEL parallel jobs..."
echo "========================================"

# Run in parallel using xargs
printf '%s\n' "${FOLDERS[@]}" | xargs -P "$MAX_PARALLEL" -I {} bash -c 'process_folder "{}"'

echo "========================================"
echo "All folders processed."
