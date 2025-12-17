#!/usr/bin/env python3
"""
Wrapper script for pdfalign-aligner to be called from Node.js.
Accepts PDF files and configuration, generates JSONL files.
"""

import argparse
import json
import os
import sys
import tempfile
import shutil
import yaml
from pathlib import Path
from typing import Dict, List, Optional

# Get the directory containing this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Add the current directory to the Python path
sys.path.insert(0, SCRIPT_DIR)

# Change working directory to script directory so relative imports work
os.chdir(SCRIPT_DIR)

from pdfalign_aligner.pipeline import PDFToJSONLPipeline


def create_temp_config(
    base_data_dir: str,
    source_data_subdir: str,
    is_prod: bool = True,
    text_field: str = "text",
    metadata_fields: Optional[List[str]] = None,
    max_align: int = 3,
    keep_all_alignments: bool = False,
) -> str:
    """Create a temporary config file for the pipeline."""

    if metadata_fields is None:
        metadata_fields = ["chunk_id", "language", "page"]

    config = {
        "IS_PROD": is_prod,
        "paths": {
            "base_data_dir": base_data_dir,
            "source_data_subdir": source_data_subdir,
            "source_data_file": "output.jsonl",
            "experiments_subdir": "experiments"
        },
        "alignment": {
            "keep_all_alignments": keep_all_alignments,
            "fake_validation": True
        },
        "bert_aligner": {
            "max_align": max_align,
            "min_win_size": 1,
            "percent": 0.15,
            "win": 10,
            "top_k": 10,
            "is_split": True
        }
    }

    # Create temp config file
    config_path = os.path.join(base_data_dir, "temp_config.yaml")
    with open(config_path, "w") as f:
        yaml.dump(config, f)

    return config_path


def organize_pdfs_by_language(
    pdf_files: Dict[str, str],
    base_dir: str,
    subdir: str
) -> str:
    """
    Organize PDF files into language subdirectories with unique clean names.

    Args:
        pdf_files: Dict mapping language code to PDF file path
        base_dir: Base data directory
        subdir: Source data subdirectory

    Returns:
        Path to the source data subdirectory
    """
    source_dir = os.path.join(base_dir, subdir)
    os.makedirs(source_dir, exist_ok=True)

    for lang, pdf_path in pdf_files.items():
        lang_dir = os.path.join(source_dir, lang)
        os.makedirs(lang_dir, exist_ok=True)

        # Name format: doc_{lang}.pdf so split creates doc_{lang}_page_001.pdf
        # which matches the pattern {prefix}_{lang}_page_{num}.md
        dest_path = os.path.join(lang_dir, f"doc_{lang}.pdf")
        shutil.copy2(pdf_path, dest_path)

    return source_dir


def remove_non_page_pdfs(root_dir: str) -> None:
    """Remove original PDFs so only per-page PDFs are converted to Markdown."""
    root_path = Path(root_dir)
    for pdf_path in root_path.rglob("*.pdf"):
        if "_page_" not in pdf_path.stem:
            try:
                pdf_path.unlink()
            except Exception:
                pass


def generate_jsonl(
    pdf_files: Dict[str, str],
    output_dir: str,
    text_field: str = "text",
    metadata_fields: Optional[List[str]] = None,
    run_alignment: bool = True,
    max_align: int = 3,
    keep_all_alignments: bool = False,
) -> Dict:
    """
    Generate JSONL files from PDFs.

    Args:
        pdf_files: Dict mapping language code to PDF file path
        output_dir: Directory to store output files
        text_field: Name of the text field in JSONL
        metadata_fields: List of metadata field names
        run_alignment: Whether to run alignment
        max_align: Maximum alignment size
        keep_all_alignments: Whether to keep all alignments

    Returns:
        Dict with paths to generated files and statistics
    """
    try:
        # Create temporary working directory
        temp_dir = tempfile.mkdtemp(prefix="pdfalign_")

        # Set up directory structure
        subdir_name = "documents"
        organize_pdfs_by_language(pdf_files, temp_dir, subdir_name)

        # Create config
        config_path = create_temp_config(
            base_data_dir=temp_dir,
            source_data_subdir=subdir_name,
            is_prod=True,
            text_field=text_field,
            metadata_fields=metadata_fields,
            max_align=max_align,
            keep_all_alignments=keep_all_alignments,
        )

        # Initialize pipeline
        pipeline = PDFToJSONLPipeline(config_path)

        # Run pipeline steps individually, skipping normalization
        # We're providing clean filenames so normalization isn't needed

        # Step 1: Skip normalization (files are already clean)
        # Step 2: Skip organization (already organized by language)
        # Step 3: Split PDFs by page
        print("Splitting PDFs by page...")
        import subprocess
        result = subprocess.run([
            pipeline.python_path,
            str(pipeline.pdf_pipeline_dir / "split_pdfs_by_page_parallel.py"),
            str(pipeline.data_dir), "-r", "-y"
        ], check=True, capture_output=True, text=True)

        # Step 4: Remove original PDFs (keep only per-page PDFs)
        remove_non_page_pdfs(str(pipeline.data_dir))

        # Step 5: Convert to Markdown
        print("Converting PDFs to Markdown...")
        result = subprocess.run([
            str(pipeline.pdf_pipeline_dir / "run_pdf_to_markdown_parallel.sh"),
            str(pipeline.data_dir)
        ], check=True, capture_output=True, text=True)

        # Step 6: Remove remaining PDFs
        result = subprocess.run([
            pipeline.python_path,
            str(pipeline.pdf_pipeline_dir / "remove_all_pdfs.py"),
            "-y", "-r", str(pipeline.data_dir)
        ], check=True, capture_output=True, text=True)

        # Merge to JSONL
        print("Merging to JSONL...")
        if not pipeline.run_merge_to_jsonl(text_field, metadata_fields):
            raise Exception("Failed to merge markdown to JSONL")

        # Run alignment if requested
        alignment_failed = False
        if run_alignment:
            print("Running BERT alignment...")
            # Try to ensure bertalign is importable
            try:
                import bertalign
                print(f"Bertalign version: {bertalign.__version__}")
            except Exception as e:
                print(f"Warning: Bertalign import test failed: {e}")
                print("Skipping alignment - chunks.jsonl will still be generated")
                alignment_failed = True

            if not alignment_failed:
                if not pipeline.run_bert_alignment():
                    print("Warning: BERT alignment failed, continuing without alignment")
                    alignment_failed = True

        # Apply production mode to move files to final location
        # We try this regardless of alignment status since we have chunks.jsonl
        try:
            if alignment_failed and run_alignment:
                # Alignment was requested but failed - manually move chunks.jsonl
                experiments_dir = os.path.join(temp_dir, "experiments")
                source_file = os.path.join(experiments_dir, "output.jsonl")
                dest_file = os.path.join(temp_dir, subdir_name, "chunks.jsonl")
                if os.path.exists(source_file):
                    shutil.copy2(source_file, dest_file)
                    print(f"Copied chunks to {dest_file}")
            else:
                # Normal production mode
                if not pipeline.apply_production_mode():
                    print("Warning: Production mode failed")
        except Exception as e:
            print(f"Warning: Production mode error: {e}")

        # Collect output files
        source_dir = os.path.join(temp_dir, subdir_name)
        output_files = {}

        # Copy chunks.jsonl
        chunks_file = os.path.join(source_dir, "chunks.jsonl")
        if os.path.exists(chunks_file):
            output_chunks = os.path.join(output_dir, "chunks.jsonl")
            shutil.copy2(chunks_file, output_chunks)
            output_files["chunks"] = output_chunks

            # Count chunks
            with open(output_chunks, "r") as f:
                chunks_count = sum(1 for _ in f)
            output_files["chunks_count"] = chunks_count

        # Copy alignment files
        alignments = {}
        for file in os.listdir(source_dir):
            if file.endswith(".jsonl") and file != "chunks.jsonl":
                # Alignment file format: {lang1}-{lang2}.jsonl
                alignment_file = os.path.join(source_dir, file)
                output_alignment = os.path.join(output_dir, file)
                shutil.copy2(alignment_file, output_alignment)

                # Count alignments
                with open(output_alignment, "r") as f:
                    alignment_count = sum(1 for _ in f)

                alignments[file] = {
                    "path": output_alignment,
                    "count": alignment_count
                }

        output_files["alignments"] = alignments

        # Clean up temp directory
        shutil.rmtree(temp_dir)

        return {
            "success": True,
            "output_files": output_files
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def main():
    parser = argparse.ArgumentParser(
        description="Generate JSONL files from PDFs for alignment"
    )
    parser.add_argument(
        "--pdf-files",
        type=str,
        required=True,
        help="JSON string mapping language codes to PDF file paths"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="Directory to store output JSONL files"
    )
    parser.add_argument(
        "--text-field",
        type=str,
        default="text",
        help="Name of the text field in JSONL (default: text)"
    )
    parser.add_argument(
        "--metadata-fields",
        type=str,
        default="chunk_id,language,page",
        help="Comma-separated list of metadata field names"
    )
    parser.add_argument(
        "--no-alignment",
        action="store_true",
        help="Skip alignment generation (only generate chunks.jsonl)"
    )
    parser.add_argument(
        "--max-align",
        type=int,
        default=3,
        help="Maximum alignment size (default: 3)"
    )
    parser.add_argument(
        "--keep-all-alignments",
        action="store_true",
        help="Keep all alignments including unmatched"
    )

    args = parser.parse_args()

    # Parse PDF files
    try:
        pdf_files = json.loads(args.pdf_files)
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON for pdf-files: {e}"
        }))
        sys.exit(1)

    # Parse metadata fields
    metadata_fields = [f.strip() for f in args.metadata_fields.split(",")]

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Generate JSONL files
    result = generate_jsonl(
        pdf_files=pdf_files,
        output_dir=args.output_dir,
        text_field=args.text_field,
        metadata_fields=metadata_fields,
        run_alignment=not args.no_alignment,
        max_align=args.max_align,
        keep_all_alignments=args.keep_all_alignments,
    )

    # Output result as JSON
    print(json.dumps(result, indent=2))

    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
