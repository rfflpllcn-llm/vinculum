#!/usr/bin/env python3
"""
Split PDF files into individual pages using parallel processing.

For each PDF file, creates individual PDF files with one page each.
Output files are named: original_name_page_001.pdf, original_name_page_002.pdf, etc.

This version uses multiprocessing to split multiple PDFs concurrently.

Requirements:
    pip install PyPDF2

Usage:
    python3 split_pdfs_by_page_parallel.py [OPTIONS] [DIRECTORY]

Options:
    --yes, -y           Auto-confirm changes without prompting
    --preview, -p       Preview changes without splitting files
    --recursive, -r     Process PDFs recursively in subdirectories
    --output-dir DIR    Specify output directory (default: same directory as PDF)
    --workers N         Number of parallel workers (default: CPU count)
    --help, -h          Show this help message

Arguments:
    DIRECTORY           Directory containing PDF files (default: current directory)

Examples:
    python3 split_pdfs_by_page_parallel.py
    python3 split_pdfs_by_page_parallel.py --preview
    python3 split_pdfs_by_page_parallel.py --yes /path/to/pdfs
    python3 split_pdfs_by_page_parallel.py --workers 4
"""

import sys
import multiprocessing
from pathlib import Path
from functools import partial

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    print("ERROR: PyPDF2 is not installed.")
    print("Please install it with: pip install PyPDF2")
    sys.exit(1)


def split_pdf(pdf_path, output_dir=None, preview=False):
    """
    Split a PDF file into individual pages.

    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save page files (default: same as PDF)
        preview: If True, don't actually create files

    Returns:
        Dict with results: {'path': pdf_path, 'pages_created': N, 'error': None or error_msg}
    """
    try:
        reader = PdfReader(pdf_path)
        num_pages = len(reader.pages)

        if num_pages == 0:
            return {
                'path': pdf_path,
                'pages_created': 0,
                'error': 'PDF has no pages'
            }

        # Determine output directory
        if output_dir is None:
            out_dir = pdf_path.parent
        else:
            out_dir = Path(output_dir)
            out_dir.mkdir(parents=True, exist_ok=True)

        # Get base name without extension
        base_name = pdf_path.stem

        # If not preview, create the individual page files
        if not preview:
            for page_num in range(num_pages):
                # Format: original_name_page_001.pdf
                page_filename = f"{base_name}_page_{page_num + 1:03d}.pdf"
                page_path = out_dir / page_filename

                writer = PdfWriter()
                writer.add_page(reader.pages[page_num])

                with open(page_path, 'wb') as output_file:
                    writer.write(output_file)

        return {
            'path': pdf_path,
            'pages_created': num_pages,
            'error': None
        }

    except Exception as e:
        return {
            'path': pdf_path,
            'pages_created': 0,
            'error': str(e)
        }


def split_pdf_worker(pdf_path, output_dir=None):
    """
    Worker function for parallel processing.

    Args:
        pdf_path: Path to PDF file
        output_dir: Output directory

    Returns:
        Result dictionary
    """
    result = split_pdf(pdf_path, output_dir=output_dir, preview=False)
    return result


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

    # Parse output directory
    output_dir = None
    if '--output-dir' in sys.argv:
        idx = sys.argv.index('--output-dir')
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]

    # Parse number of workers
    num_workers = multiprocessing.cpu_count()
    if '--workers' in sys.argv:
        idx = sys.argv.index('--workers')
        if idx + 1 < len(sys.argv):
            try:
                num_workers = int(sys.argv[idx + 1])
            except ValueError:
                print(f"ERROR: Invalid number of workers: {sys.argv[idx + 1]}")
                return

    if show_help_flag:
        show_help()
        return

    # Get directory from command line or use current directory
    directory = None
    for arg in sys.argv[1:]:
        if not arg.startswith('-') and arg != sys.argv[0] and arg != output_dir and arg != str(num_workers):
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
    print(f"Using {num_workers} parallel workers")
    print()

    # Analyze PDFs
    print("Analyzing PDFs...")
    pdf_info = []
    total_pages = 0

    for pdf_file in pdf_files:
        try:
            reader = PdfReader(pdf_file)
            num_pages = len(reader.pages)
            pdf_info.append({
                'path': pdf_file,
                'pages': num_pages
            })
            total_pages += num_pages
        except Exception as e:
            print(f"ERROR reading {pdf_file.name}: {e}")
            pdf_info.append({
                'path': pdf_file,
                'pages': 0,
                'error': str(e)
            })

    # Show preview
    print(f"\n{len(pdf_info)} PDF file{'s' if len(pdf_info) != 1 else ''} will be split into {total_pages} individual page files:\n")

    max_name_len = max(len(str(info['path'].name)) for info in pdf_info)
    col_width = max(max_name_len, 30)

    print(f"{'PDF FILE':<{col_width}} {'PAGES':>8} {'OUTPUT FILES'}")
    print("=" * (col_width + 50))

    for info in pdf_info:
        if 'error' in info:
            print(f"{info['path'].name:<{col_width}} {'ERROR':>8} {info['error']}")
        else:
            pages = info['pages']
            if pages > 0:
                first_file = f"{info['path'].stem}_page_001.pdf"
                last_file = f"{info['path'].stem}_page_{pages:03d}.pdf"
                output_files = f"{first_file} ... {last_file}" if pages > 1 else first_file
                print(f"{info['path'].name:<{col_width}} {pages:>8} {output_files}")
            else:
                print(f"{info['path'].name:<{col_width}} {pages:>8} (empty PDF)")

    print("\n" + "=" * (col_width + 50))
    print(f"Total: {total_pages} page files will be created")

    if output_dir:
        print(f"Output directory: {output_dir}")

    if preview_only:
        print("\nPreview mode - no files were created.")
        print("Run with --yes or -y to perform the split operation.")
        return

    # Ask for confirmation if not auto-confirmed
    print()

    if not auto_confirm:
        try:
            response = input(f"Proceed with splitting {len(pdf_info)} PDF{'s' if len(pdf_info) != 1 else ''} into {total_pages} pages? (yes/no): ").strip().lower()
        except EOFError:
            print("\nNo input received. Use --yes or -y flag to auto-confirm, or --preview to just see changes.")
            return
    else:
        response = 'yes'
        print(f"Auto-confirmed: Proceeding with splitting {len(pdf_info)} PDF{'s' if len(pdf_info) != 1 else ''} into {total_pages} pages...")

    if response in ['yes', 'y']:
        # Perform splitting in parallel
        print()
        print("Splitting PDFs in parallel...")

        # Filter out PDFs with errors or no pages
        valid_pdfs = [info['path'] for info in pdf_info if 'error' not in info and info['pages'] > 0]

        if not valid_pdfs:
            print("No valid PDFs to process.")
            return

        # Create worker function with output_dir parameter
        worker_func = partial(split_pdf_worker, output_dir=output_dir)

        # Process PDFs in parallel
        success_count = 0
        error_count = 0
        pages_created = 0

        with multiprocessing.Pool(processes=num_workers) as pool:
            # Use imap_unordered for better progress tracking
            results = pool.imap_unordered(worker_func, valid_pdfs)

            for result in results:
                if result['error'] is None:
                    success_count += 1
                    pages_created += result['pages_created']
                    print(f"✓ {result['path'].name}: Created {result['pages_created']} page files")
                else:
                    error_count += 1
                    print(f"✗ {result['path'].name}: ERROR - {result['error']}")

        print(f"\n{'='*60}")
        print(f"Successfully split {success_count} PDF{'s' if success_count != 1 else ''}.")
        print(f"Created {pages_created} individual page files.")
        if error_count > 0:
            print(f"Failed to process {error_count} PDF{'s' if error_count != 1 else ''}.")
    else:
        print("Split operation cancelled.")


if __name__ == "__main__":
    main()