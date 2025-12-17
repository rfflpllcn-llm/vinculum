#!/usr/bin/env python3
"""
Organize PDF files into folders with the same name as the PDF (without extension).

For each PDF file in the directory, creates a folder with the same name (minus .pdf)
and moves the PDF into that folder.

Example:
    foo.pdf -> foo/foo.pdf
    bar.pdf -> bar/bar.pdf

Usage:
    python3 organize_pdfs_into_folders.py [OPTIONS] [DIRECTORY]

Options:
    --yes, -y       Auto-confirm changes without prompting
    --preview, -p   Preview changes without creating folders/moving files
    --recursive, -r Process PDFs recursively in subdirectories
    --help, -h      Show this help message

Arguments:
    DIRECTORY       Directory containing PDF files (default: current directory)

Examples:
    python3 organize_pdfs_into_folders.py
    python3 organize_pdfs_into_folders.py --preview
    python3 organize_pdfs_into_folders.py --yes /path/to/pdfs
"""

import os
import sys
from pathlib import Path


def get_folder_name_from_pdf(pdf_path):
    """
    Get the folder name for a PDF file (filename without .pdf extension).

    Args:
        pdf_path: Path object for the PDF file

    Returns:
        String with folder name
    """
    return pdf_path.stem


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

    # Prepare organization operations
    operations = []
    for pdf_file in pdf_files:
        folder_name = get_folder_name_from_pdf(pdf_file)
        folder_path = pdf_file.parent / folder_name
        new_pdf_path = folder_path / pdf_file.name

        operations.append({
            'pdf': pdf_file,
            'folder': folder_path,
            'new_path': new_pdf_path,
            'folder_exists': folder_path.exists(),
            'target_exists': new_pdf_path.exists()
        })

    # Show preview
    print(f"{len(operations)} PDF file{'s' if len(operations) != 1 else ''} will be organized:\n")

    max_pdf_len = max(len(str(op['pdf'].name)) for op in operations)
    max_folder_len = max(len(str(op['folder'].name)) for op in operations)
    col_width = max(max_pdf_len, max_folder_len, 30)

    print(f"{'PDF FILE':<{col_width}} -> {'FOLDER/NEW LOCATION':<{col_width}} {'STATUS'}")
    print("=" * (col_width * 2 + 20))

    warnings = []
    for i, op in enumerate(operations):
        status = ""
        if op['target_exists']:
            status = "⚠ TARGET EXISTS"
            warnings.append(f"Target file already exists: {op['new_path']}")
        elif op['folder_exists']:
            status = "✓ FOLDER EXISTS"
        else:
            status = "✓ WILL CREATE"

        if recursive:
            pdf_rel = op['pdf'].relative_to(directory)
            new_rel = op['new_path'].relative_to(directory)
            print(f"{str(pdf_rel):<{col_width}} -> {str(new_rel):<{col_width}} {status}")
        else:
            print(f"{op['pdf'].name:<{col_width}} -> {str(op['new_path'].relative_to(directory)):<{col_width}} {status}")

    if warnings:
        print("\nWARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")

    if preview_only:
        print("\nPreview mode - no folders were created or files moved.")
        print("Run with --yes or -y to perform the organization.")
        return

    # Ask for confirmation if not auto-confirmed
    print("\n" + "=" * (col_width * 2 + 20))

    if not auto_confirm:
        try:
            response = input(f"\nProceed with organizing {len(operations)} file{'s' if len(operations) != 1 else ''}? (yes/no): ").strip().lower()
        except EOFError:
            print("\nNo input received. Use --yes or -y flag to auto-confirm, or --preview to just see changes.")
            return
    else:
        response = 'yes'
        print(f"\nAuto-confirmed: Proceeding with organizing {len(operations)} file{'s' if len(operations) != 1 else ''}...")

    if response in ['yes', 'y']:
        # Perform organization
        success_count = 0
        error_count = 0
        skipped_count = 0

        for op in operations:
            try:
                # Skip if target already exists
                if op['target_exists']:
                    print(f"SKIPPED: '{op['pdf'].name}' - target file already exists at '{op['new_path']}'")
                    skipped_count += 1
                    continue

                # Create folder if it doesn't exist
                if not op['folder_exists']:
                    op['folder'].mkdir(parents=True, exist_ok=True)
                    print(f"Created folder: {op['folder'].name}")

                # Move PDF into folder
                op['pdf'].rename(op['new_path'])
                print(f"Moved: {op['pdf'].name} -> {op['new_path'].relative_to(directory)}")
                success_count += 1

            except Exception as e:
                print(f"ERROR organizing '{op['pdf'].name}': {e}")
                error_count += 1

        print(f"\n{'='*60}")
        print(f"Successfully organized {success_count} file{'s' if success_count != 1 else ''}.")
        if skipped_count > 0:
            print(f"Skipped {skipped_count} file{'s' if skipped_count != 1 else ''} (target already exists).")
        if error_count > 0:
            print(f"Failed to organize {error_count} file{'s' if error_count != 1 else ''}.")
    else:
        print("Organization cancelled.")


if __name__ == "__main__":
    main()
