#!/usr/bin/env python3
"""
Normalize PDF file names by removing special characters and datetime suffixes.
Keeps only alphanumeric characters, underscores, hyphens, periods, and spaces.
Removes datetime patterns like _20251017124126 from filenames.
Limits filename length to 60 characters (excluding extension).

Usage:
    python3 normalize_pdf_names.py [OPTIONS] [DIRECTORY]

Options:
    --yes, -y       Auto-confirm changes without prompting
    --preview, -p   Preview changes without renaming files
    --recursive, -r Search for PDFs recursively in subdirectories
    --help, -h      Show this help message

Arguments:
    DIRECTORY       Directory to search for PDF files (default: current directory)

Examples:
    python3 normalize_pdf_names.py
    python3 normalize_pdf_names.py --preview
    python3 normalize_pdf_names.py --yes /path/to/pdfs
    python3 normalize_pdf_names.py -r --yes
"""

import os
import re
import sys
import unicodedata
from pathlib import Path


def normalize_string(text):
    """
    Normalize a string by removing special characters while preserving numbers.

    Args:
        text: The original string

    Returns:
        Normalized string
    """
    # Normalize unicode characters (convert accented chars to base chars)
    # NFKD = Compatibility Decomposition
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ASCII', 'ignore').decode('ASCII')

    # Replace apostrophes and quotes with nothing
    text = text.replace("'", "")
    text = text.replace('"', '')
    text = text.replace('`', '')

    # Keep only alphanumeric characters, underscores, hyphens, and spaces
    text = re.sub(r'[^a-zA-Z0-9_\-\s]', '', text)

    # Replace multiple underscores or spaces with single underscore
    text = re.sub(r'[_\s]+', '_', text)

    # Remove leading/trailing underscores
    text = text.strip('_')

    return text


def normalize_filename(filename, folder_prefix=None, max_length=60):
    """
    Normalize a filename by removing special characters and datetime suffixes.
    Optionally adds a folder name prefix and limits the length.

    Rules:
    - Adds folder name as prefix (if provided)
    - Removes datetime patterns like _20251017124126 (underscore followed by 14+ digits)
    - Converts accented characters to ASCII equivalents (à -> a, è -> e, etc.)
    - Removes apostrophes, quotes, and other punctuation
    - Keeps only alphanumeric characters, underscores, hyphens, and spaces
    - Collapses multiple underscores/spaces to single underscore
    - Removes leading/trailing underscores
    - Limits filename length to max_length characters (default: 60)
    - Preserves file extension

    Args:
        filename: The original filename
        folder_prefix: Optional folder name to prepend to filename
        max_length: Maximum length for the filename (excluding extension)

    Returns:
        Normalized filename
    """
    # Split into name and extension
    name, ext = os.path.splitext(filename)

    # Remove datetime pattern: underscore followed by 14+ digits
    # Pattern matches: _20251017124126, _20230101000000, etc.
    name = re.sub(r'_\d{14,}', '', name)

    # Normalize the filename (preserves numbers)
    name = normalize_string(name)

    # Add folder prefix if provided and not already present
    if folder_prefix:
        normalized_prefix = normalize_string(folder_prefix)
        if not name.startswith(normalized_prefix + '_'):
            name = normalized_prefix + '_' + name

    # Limit filename length
    if len(name) > max_length:
        name = name[:max_length].rstrip('_')

    return name + ext


def find_pdf_files(directory, recursive=False):
    """
    Find all PDF files in a directory.

    Args:
        directory: Path to search
        recursive: If True, search subdirectories

    Returns:
        List of Path objects for PDF files
    """
    directory = Path(directory)

    if recursive:
        return list(directory.rglob('*.pdf'))
    else:
        return list(directory.glob('*.pdf'))


def show_help():
    """Display help message."""
    print(__doc__)


def main():
    # Parse command line arguments
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    preview_only = '--preview' in sys.argv or '-p' in sys.argv
    recursive = '--recursive' in sys.argv or '-r' in sys.argv
    show_help_flag = '--help' in sys.argv or '-h' in sys.argv

    if show_help_flag:
        show_help()
        return

    # Get directory from command line or use current directory
    directory = None
    for arg in sys.argv[1:]:
        if not arg.startswith('-') and arg != sys.argv[0]:
            directory = arg
            break

    if directory is None:
        directory = Path.cwd()
    else:
        directory = Path(directory)

    if not directory.exists():
        print(f"ERROR: Directory '{directory}' does not exist.")
        return

    if not directory.is_dir():
        print(f"ERROR: '{directory}' is not a directory.")
        return

    # Find all PDF files
    pdf_files = find_pdf_files(directory, recursive)

    if not pdf_files:
        print(f"No PDF files found in '{directory}'.")
        if not recursive:
            print("Use --recursive or -r to search subdirectories.")
        return

    print(f"Found {len(pdf_files)} PDF file{'s' if len(pdf_files) != 1 else ''} in '{directory}'")
    if recursive:
        print("(searched recursively)")
    print()

    # Get folder name for prefix
    folder_name = directory.name

    # Prepare rename operations
    rename_operations = []
    for pdf_file in pdf_files:
        old_name = pdf_file.name
        new_name = normalize_filename(old_name, folder_prefix=folder_name)

        if old_name != new_name:
            rename_operations.append((pdf_file, pdf_file.parent / new_name))

    if not rename_operations:
        print("No files need to be renamed. All filenames are already normalized.")
        return

    # Show preview
    print(f"{len(rename_operations)} file{'s' if len(rename_operations) != 1 else ''} will be renamed:\n")

    # Calculate column widths
    max_old = max(len(str(old.name)) for old, _ in rename_operations)
    max_new = max(len(str(new.name)) for _, new in rename_operations)
    col_width = max(max_old, max_new, 20)

    print(f"{'OLD NAME':<{col_width}} -> {'NEW NAME':<{col_width}}")
    print("=" * (col_width * 2 + 4))

    for old_path, new_path in rename_operations:
        # Show relative path if recursive
        if recursive:
            old_rel = old_path.relative_to(directory)
            new_rel = new_path.relative_to(directory)
            print(f"{str(old_rel):<{col_width}} -> {str(new_rel):<{col_width}}")
        else:
            print(f"{old_path.name:<{col_width}} -> {new_path.name:<{col_width}}")

    if preview_only:
        print("\nPreview mode - no files were renamed.")
        print("Run with --yes or -y to perform the rename operation.")
        return

    # Ask for confirmation if not auto-confirmed
    print("\n" + "=" * (col_width * 2 + 4))

    if not auto_confirm:
        try:
            response = input(f"\nProceed with renaming {len(rename_operations)} file{'s' if len(rename_operations) != 1 else ''}? (yes/no): ").strip().lower()
        except EOFError:
            print("\nNo input received. Use --yes or -y flag to auto-confirm, or --preview to just see changes.")
            return
    else:
        response = 'yes'
        print(f"\nAuto-confirmed: Proceeding with renaming {len(rename_operations)} file{'s' if len(rename_operations) != 1 else ''}...")

    if response in ['yes', 'y']:
        # Perform renames
        success_count = 0
        error_count = 0

        for old_path, new_path in rename_operations:
            try:
                # Check if target file already exists
                if new_path.exists():
                    print(f"WARNING: Skipping '{old_path.name}' - target file '{new_path.name}' already exists")
                    error_count += 1
                    continue

                old_path.rename(new_path)
                success_count += 1

            except Exception as e:
                print(f"ERROR renaming '{old_path.name}': {e}")
                error_count += 1

        print(f"\nSuccessfully renamed {success_count} file{'s' if success_count != 1 else ''}.")
        if error_count > 0:
            print(f"Failed to rename {error_count} file{'s' if error_count != 1 else ''}.")
    else:
        print("Rename operation cancelled.")


if __name__ == "__main__":
    main()
