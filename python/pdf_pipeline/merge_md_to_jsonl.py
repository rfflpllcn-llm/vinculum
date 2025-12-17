#!/usr/bin/env python3
"""
Script to merge markdown files from multiple directories into a single JSONL file.
Each line from the MD files becomes a separate JSON entry.
"""

import argparse
import json
import re
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional


def load_config(config_path: Path) -> dict:
    """
    Load YAML configuration file.

    Args:
        config_path: Path to config.yaml

    Returns:
        Configuration dictionary
    """
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def extract_language_and_page(filename: str, pattern: Optional[str] = None) -> tuple[str, str]:
    """
    Extract language and page from filename pattern.
    Default pattern: {prefix}_{language}_page_{page}.md
    Extracts only the language code (en, hu, it, sr, etc.) not the full prefix.

    Args:
        filename: The filename to parse
        pattern: Optional regex pattern to use

    Returns:
        Tuple of (language, page)
    """
    if pattern is None:
        # Match {anything}_{language_code}_page_{number}.md
        # Language code is captured as the part between the last underscore before "_page_"
        pattern = r".*_(\w+)_page_(\d+)\.md"

    match = re.match(pattern, filename)

    if not match:
        raise ValueError(f"Filename '{filename}' does not match expected pattern")

    language = match.group(1)
    page = match.group(2)

    return language, page


def process_md_files(
    directories: List[Path],
    output_file: Path,
    text_field: str = "text",
    metadata_fields: Optional[List[str]] = None
) -> None:
    """
    Process all markdown files from the given directories and merge into JSONL.

    Args:
        directories: List of directory paths containing MD files
        output_file: Path to the output JSONL file
        text_field: Name of the field to store the text content (default: "text")
        metadata_fields: List of metadata fields to include (default: ["chunk_id", "language", "page"])
    """
    if metadata_fields is None:
        metadata_fields = ["chunk_id", "language", "page"]

    chunk_id = 0
    entries = []

    # Collect all MD files from all directories
    all_files = []
    for directory in directories:
        if not directory.exists():
            print(f"Warning: Directory {directory} does not exist, skipping...")
            continue

        md_files = sorted(directory.glob("*.md"))
        all_files.extend(md_files)

    print(f"Found {len(all_files)} markdown files")

    # Process each file
    for md_file in sorted(all_files):
        try:
            language, page = extract_language_and_page(md_file.name)
        except ValueError as e:
            print(f"Warning: {e}, skipping file...")
            continue

        # Read file and process each line
        with open(md_file, 'r', encoding='utf-8') as f:
            for line in f:
                # Strip whitespace
                text = line.rstrip('\n\r')

                # Skip empty lines
                if not text.strip():
                    continue

                # Create JSON entry with configurable fields
                entry = {}

                # Add text field
                entry[text_field] = text

                # Add metadata fields
                available_metadata = {
                    "chunk_id": chunk_id,
                    "language": language,
                    "page": page
                }

                for field in metadata_fields:
                    if field in available_metadata:
                        entry[field] = available_metadata[field]

                entries.append(entry)
                chunk_id += 1

    # Write to JSONL file
    print(f"Writing {len(entries)} entries to {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')

    print(f"Successfully created {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Merge markdown files from multiple directories into a single JSONL file"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config.yaml",
        help="Path to config.yaml file (default: config.yaml)"
    )
    parser.add_argument(
        "--text-field",
        type=str,
        default="text",
        help="Name of the field to store text content (default: text)"
    )
    parser.add_argument(
        "--metadata-fields",
        type=str,
        nargs="+",
        default=["chunk_id", "language", "page"],
        help="Metadata fields to include (default: chunk_id language page)"
    )

    args = parser.parse_args()

    # Load configuration
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Error: Config file {config_path} not found")
        return

    config = load_config(config_path)

    # Extract paths from config
    base_data_dir = Path(config['paths']['base_data_dir'])
    source_data_subdir = config['paths']['source_data_subdir']
    source_data_file = config['paths']['source_data_file']
    experiments_subdir = config['paths']['experiments_subdir']

    # Build path to source data subdirectory
    source_base_path = base_data_dir / source_data_subdir

    # Discover all subdirectories (language-specific folders)
    if not source_base_path.exists():
        print(f"Error: Source directory {source_base_path} does not exist")
        return

    directories = [d for d in source_base_path.iterdir() if d.is_dir()]

    if not directories:
        print(f"Warning: No subdirectories found in {source_base_path}")
        return

    print(f"Found {len(directories)} directories to process:")
    for d in directories:
        print(f"  - {d.name}")

    # Define output file in experiments subdirectory
    output_file = base_data_dir / experiments_subdir / source_data_file

    # Create output directory if it doesn't exist
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Process files
    process_md_files(
        directories,
        output_file,
        text_field=args.text_field,
        metadata_fields=args.metadata_fields
    )


if __name__ == "__main__":
    main()