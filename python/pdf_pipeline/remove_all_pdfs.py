#!/usr/bin/env python3
"""
Remove all PDF files in a directory (recursively or non-recursively).

WARNING: This script will delete all PDF files it finds. Use with caution!

Usage:
    python3 remove_all_pdfs.py [OPTIONS] [DIRECTORY]

Options:
    --yes, -y       Auto-confirm changes without prompting
    --preview, -p   Preview changes without deleting files
    --recursive, -r Process folders recursively in subdirectories
    --help, -h      Show this help message

Arguments:
    DIRECTORY       Directory to search (default: current directory)

Examples:
    python3 remove_all_pdfs.py --preview
    python3 remove_all_pdfs.py --recursive --preview
    python3 remove_all_pdfs.py --yes /path/to/folder
    python3 remove_all_pdfs.py -r --yes
"""

import sys
from pathlib import Path


def find_all_pdfs(directory, recursive=False):
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

    # Find all PDFs
    print(f"Searching for PDF files in '{directory}'...")
    if recursive:
        print("(searching recursively)")
    print()

    pdf_files = find_all_pdfs(directory, recursive)

    if not pdf_files:
        print("No PDF files found.")
        return

    # Calculate total size
    total_size = 0
    pdf_info = []

    for pdf_path in pdf_files:
        try:
            size = pdf_path.stat().st_size
            total_size += size
            pdf_info.append({
                'path': pdf_path,
                'size': size
            })
        except Exception as e:
            print(f"WARNING: Could not get size for {pdf_path}: {e}")
            pdf_info.append({
                'path': pdf_path,
                'size': 0,
                'error': str(e)
            })

    # Show preview
    print(f"⚠️  WARNING: {len(pdf_files)} PDF file{'s' if len(pdf_files) != 1 else ''} will be PERMANENTLY DELETED!\n")

    max_path_len = max(len(str(info['path'].relative_to(directory))) for info in pdf_info)
    col_width = max(max_path_len, 40)

    print(f"{'FILE PATH (relative)':<{col_width}} {'SIZE':>12}")
    print("=" * (col_width + 15))

    for info in pdf_info:
        rel_path = info['path'].relative_to(directory)
        size_str = format_size(info['size']) if 'error' not in info else 'ERROR'
        print(f"{str(rel_path):<{col_width}} {size_str:>12}")

    print("\n" + "=" * (col_width + 15))
    print(f"Total: {len(pdf_files)} file{'s' if len(pdf_files) != 1 else ''}")
    print(f"Total size: {format_size(total_size)}")

    if preview_only:
        print("\n✓ Preview mode - no files were deleted.")
        print("Run with --yes or -y to perform the deletion.")
        return

    # Ask for confirmation if not auto-confirmed
    print()
    print("⚠️  WARNING: This action cannot be undone!")

    if not auto_confirm:
        try:
            response = input(f"\nAre you SURE you want to delete {len(pdf_files)} PDF file{'s' if len(pdf_files) != 1 else ''}? (yes/no): ").strip().lower()
        except EOFError:
            print("\nNo input received. Use --yes or -y flag to auto-confirm, or --preview to just see changes.")
            return
    else:
        response = 'yes'
        print(f"Auto-confirmed: Proceeding with deleting {len(pdf_files)} PDF file{'s' if len(pdf_files) != 1 else ''}...")

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
