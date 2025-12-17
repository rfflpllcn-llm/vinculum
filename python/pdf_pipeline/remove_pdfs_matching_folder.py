#!/usr/bin/env python3
"""
Remove PDF files that have the same name as their parent folder.

For example, if a PDF file is located at:
    foo/foo.pdf
This script will remove foo.pdf because it matches the folder name 'foo'.

This is useful after splitting PDFs into pages when you want to keep only
the individual page files and remove the original PDF.

Usage:
    python3 remove_pdfs_matching_folder.py [OPTIONS] [DIRECTORY]

Options:
    --yes, -y       Auto-confirm changes without prompting
    --preview, -p   Preview changes without deleting files
    --recursive, -r Process folders recursively in subdirectories
    --help, -h      Show this help message

Arguments:
    DIRECTORY       Directory to search (default: current directory)

Examples:
    python3 remove_pdfs_matching_folder.py
    python3 remove_pdfs_matching_folder.py --preview
    python3 remove_pdfs_matching_folder.py --yes /path/to/folders
    python3 remove_pdfs_matching_folder.py -r --yes
"""

import sys
from pathlib import Path


def find_matching_pdfs(directory, recursive=False):
    """
    Find PDF files where the filename (without .pdf) matches the parent folder name.

    Args:
        directory: Path to search
        recursive: If True, search subdirectories

    Returns:
        List of Path objects for matching PDF files
    """
    directory = Path(directory)
    matching_pdfs = []

    if recursive:
        # Find all PDF files recursively
        all_pdfs = directory.rglob('*.pdf')
    else:
        # Find PDFs in immediate subdirectories only
        all_pdfs = []
        for subfolder in directory.iterdir():
            if subfolder.is_dir():
                all_pdfs.extend(subfolder.glob('*.pdf'))

    # Check each PDF
    for pdf_path in all_pdfs:
        pdf_stem = pdf_path.stem  # filename without .pdf extension
        folder_name = pdf_path.parent.name

        # If the PDF name matches the folder name, add to list
        if pdf_stem == folder_name:
            matching_pdfs.append(pdf_path)

    return matching_pdfs


def format_size(size_bytes):
    """
    Format file size in human-readable format.

    Args:
        size_bytes: Size in bytes

    Returns:
        Formatted string (e.g., "1.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


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

    # Find matching PDFs
    print(f"Searching for PDF files matching their folder names in '{directory}'...")
    if recursive:
        print("(searching recursively)")
    print()

    matching_pdfs = find_matching_pdfs(directory, recursive)

    if not matching_pdfs:
        print("No PDF files found that match their parent folder name.")
        return

    # Calculate total size
    total_size = 0
    pdf_info = []

    for pdf_path in matching_pdfs:
        try:
            size = pdf_path.stat().st_size
            total_size += size
            pdf_info.append({
                'path': pdf_path,
                'size': size,
                'folder': pdf_path.parent.name
            })
        except Exception as e:
            print(f"WARNING: Could not get size for {pdf_path}: {e}")
            pdf_info.append({
                'path': pdf_path,
                'size': 0,
                'folder': pdf_path.parent.name,
                'error': str(e)
            })

    # Show preview
    print(f"{len(matching_pdfs)} PDF file{'s' if len(matching_pdfs) != 1 else ''} will be removed:\n")

    max_path_len = max(len(str(info['path'].relative_to(directory))) for info in pdf_info)
    col_width = max(max_path_len, 40)

    print(f"{'FILE PATH (relative)':<{col_width}} {'SIZE':>12} {'FOLDER'}")
    print("=" * (col_width + 40))

    for info in pdf_info:
        rel_path = info['path'].relative_to(directory)
        size_str = format_size(info['size']) if 'error' not in info else 'ERROR'
        folder = info['folder']
        print(f"{str(rel_path):<{col_width}} {size_str:>12} {folder}")

    print("\n" + "=" * (col_width + 40))
    print(f"Total size to be freed: {format_size(total_size)}")

    if preview_only:
        print("\nPreview mode - no files were deleted.")
        print("Run with --yes or -y to perform the deletion.")
        return

    # Ask for confirmation if not auto-confirmed
    print()

    if not auto_confirm:
        try:
            response = input(f"\nProceed with deleting {len(matching_pdfs)} file{'s' if len(matching_pdfs) != 1 else ''}? (yes/no): ").strip().lower()
        except EOFError:
            print("\nNo input received. Use --yes or -y flag to auto-confirm, or --preview to just see changes.")
            return
    else:
        response = 'yes'
        print(f"Auto-confirmed: Proceeding with deleting {len(matching_pdfs)} file{'s' if len(matching_pdfs) != 1 else ''}...")

    if response in ['yes', 'y']:
        # Perform deletion
        success_count = 0
        error_count = 0
        bytes_freed = 0

        print()
        for info in pdf_info:
            try:
                pdf_path = info['path']
                size = info['size']

                pdf_path.unlink()
                success_count += 1
                bytes_freed += size
                print(f"✓ Deleted: {pdf_path.relative_to(directory)}")

            except Exception as e:
                print(f"✗ ERROR deleting {pdf_path.relative_to(directory)}: {e}")
                error_count += 1

        print(f"\n{'='*60}")
        print(f"Successfully deleted {success_count} file{'s' if success_count != 1 else ''}.")
        print(f"Freed {format_size(bytes_freed)} of disk space.")
        if error_count > 0:
            print(f"Failed to delete {error_count} file{'s' if error_count != 1 else ''}.")
    else:
        print("Deletion cancelled.")


if __name__ == "__main__":
    main()
