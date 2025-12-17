#!/usr/bin/env python3
"""
PDF to Markdown Converter
Converts all PDF files in a directory to Markdown format.
Optimized for Italian language content.
"""

import os
import sys
from pathlib import Path
import pymupdf
import re

def convert_pdf_to_markdown(pdf_path, output_dir=None):
    """
    Convert a single PDF file to Markdown format.

    Args:
        pdf_path: Path to the PDF file
        output_dir: Optional output directory (defaults to same as PDF)

    Returns:
        Path to the created Markdown file or None if failed
    """
    try:
        pdf_path = Path(pdf_path)

        # Set output directory
        if output_dir:
            output_path = Path(output_dir) / f"{pdf_path.stem}.md"
        else:
            output_path = pdf_path.with_suffix('.md')

        # Convert PDF to Markdown
        print(f"Converting: {pdf_path.name}...")

        # Open PDF with PyMuPDF
        doc = pymupdf.open(str(pdf_path))
        markdown_text = []

        for page_num, page in enumerate(doc, 1):
            # Extract text blocks with formatting
            blocks = page.get_text("dict")["blocks"]

            for block in blocks:
                if block["type"] == 0:  # Text block
                    # Collect all lines in the block
                    block_lines = []
                    for line in block["lines"]:
                        line_text = ""
                        for span in line["spans"]:
                            text = span["text"]
                            # Clean up hyphenation at line breaks
                            text = re.sub(r'-\s+', '', text)
                            line_text += text

                        if line_text.strip():
                            block_lines.append(line_text.strip())

                    # Smart merge: merge fragments but preserve legitimate line breaks
                    if block_lines:
                        merged_lines = []
                        current_line = block_lines[0]

                        for i in range(1, len(block_lines)):
                            next_line = block_lines[i]

                            # Heuristic: merge if current line seems incomplete
                            # - Very short (< 50 chars) AND doesn't end with sentence-ending punctuation
                            # - OR next line is very short (< 30 chars and < 3 words)
                            should_merge = (
                                (len(current_line) < 50 and not current_line[-1] in '.!?:;') or
                                (len(next_line) < 30 and len(next_line.split()) < 3)
                            )

                            if should_merge:
                                # Merge with next line
                                current_line = current_line + ' ' + next_line
                            else:
                                # Keep as separate line
                                merged_lines.append(current_line)
                                current_line = next_line

                        # Add the last line
                        merged_lines.append(current_line)

                        # Clean up multiple spaces in each line
                        for line in merged_lines:
                            line = re.sub(r'\s+', ' ', line.strip())
                            if line:
                                markdown_text.append(line)

            # Add page break
            if page_num < len(doc):
                markdown_text.append("\n---\n")

        doc.close()

        # Join text and clean up
        md_text = '\n\n'.join(markdown_text)

        # Additional cleanup
        # Fix broken words with brackets
        md_text = re.sub(r'\[\s*([^\]]+?)\s*\]', r'\1', md_text)
        # Fix multiple spaces
        md_text = re.sub(r' +', ' ', md_text)
        # Fix multiple newlines
        md_text = re.sub(r'\n{3,}', '\n\n', md_text)

        # Write to file
        output_path.write_text(md_text, encoding='utf-8')
        print(f"✓ Created: {output_path.name}")

        return output_path

    except Exception as e:
        print(f"✗ Error converting {pdf_path.name}: {str(e)}")
        return None

def convert_txt_to_markdown(txt_path, output_dir=None):
    """
    Convert a single text file to Markdown format.

    Args:
        txt_path: Path to the text file
        output_dir: Optional output directory (defaults to same as text file)

    Returns:
        Path to the created Markdown file or None if failed
    """
    try:
        txt_path = Path(txt_path)

        # Set output directory
        if output_dir:
            output_path = Path(output_dir) / f"{txt_path.stem}.md"
        else:
            output_path = txt_path.with_suffix('.md')

        print(f"Converting: {txt_path.name}...")

        # Read the text file
        text_content = txt_path.read_text(encoding='utf-8')

        # Basic text cleanup and formatting
        # Split into paragraphs
        paragraphs = text_content.split('\n\n')

        # Clean each paragraph
        cleaned_paragraphs = []
        for paragraph in paragraphs:
            # Remove extra whitespace and line breaks within paragraphs
            cleaned = re.sub(r'\s+', ' ', paragraph.strip())
            if cleaned:
                cleaned_paragraphs.append(cleaned)

        # Join paragraphs with double newlines (markdown paragraph separator)
        md_text = '\n\n'.join(cleaned_paragraphs)

        # Additional cleanup for Italian text
        # Fix common OCR issues
        md_text = re.sub(r'\s+', ' ', md_text)  # Multiple spaces to single space
        md_text = re.sub(r'\n{3,}', '\n\n', md_text)  # Multiple newlines to double

        # Write to file
        output_path.write_text(md_text, encoding='utf-8')
        print(f"✓ Created: {output_path.name}")

        return output_path

    except Exception as e:
        print(f"✗ Error converting {txt_path.name}: {str(e)}")
        return None

def convert_directory(directory, output_dir=None, recursive=False):
    """
    Convert all PDF and text files in a directory to Markdown.

    Args:
        directory: Path to the directory containing PDFs or text files
        output_dir: Optional output directory for Markdown files
        recursive: If True, search subdirectories as well
    """
    directory = Path(directory)

    if not directory.exists():
        print(f"Error: Directory '{directory}' does not exist.")
        return

    if not directory.is_dir():
        print(f"Error: '{directory}' is not a directory.")
        return

    # Create output directory if specified
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    # Find all PDF and text files
    if recursive:
        pdf_files = list(directory.rglob('*.pdf'))
        txt_files = list(directory.rglob('*.txt'))
    else:
        pdf_files = list(directory.glob('*.pdf'))
        txt_files = list(directory.glob('*.txt'))

    all_files = pdf_files + txt_files

    if not all_files:
        print(f"No PDF or text files found in '{directory}'")
        return

    print(f"\nFound {len(pdf_files)} PDF file(s) and {len(txt_files)} text file(s)")
    print("-" * 50)

    # Convert each file
    successful = 0
    failed = 0

    # Convert PDF files
    for pdf_file in pdf_files:
        result = convert_pdf_to_markdown(pdf_file, output_dir)
        if result:
            successful += 1
        else:
            failed += 1

    # Convert text files
    for txt_file in txt_files:
        result = convert_txt_to_markdown(txt_file, output_dir)
        if result:
            successful += 1
        else:
            failed += 1

    # Summary
    print("-" * 50)
    print(f"\nConversion complete!")
    print(f"Total files: {len(all_files)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")

def resolve_directory_paths(dir_name):
    """
    Resolve input and output paths based on directory name.

    Args:
        dir_name: Name of the directory (e.g., 'inglese_dante_guida_alla_divina_commedia')

    Returns:
        tuple: (input_path, output_path) or (None, None) if not found
    """
    base_path = Path("data/essays")

    # Handle both relative and absolute paths
    if not base_path.is_absolute():
        # Try relative to current working directory
        if base_path.exists():
            pass  # Use as-is
        else:
            # Try relative to script directory
            script_dir = Path(__file__).parent
            base_path = script_dir / base_path
            if not base_path.exists():
                print(f"Error: Base path {base_path} does not exist")
                return None, None

    target_dir = base_path / dir_name

    if not target_dir.exists():
        print(f"Error: Directory {target_dir} does not exist")

        # List available directories
        if base_path.exists():
            available = [d.name for d in base_path.iterdir() if d.is_dir()]
            print(f"Available directories in {base_path}:")
            for d in sorted(available):
                print(f"  - {d}")

        return None, None

    # Check if we have files in the root directory or in a pages subdirectory
    pages_dir = target_dir / "pages"

    if pages_dir.exists():
        # Check if there are files in pages directory
        pdf_files_in_pages = list(pages_dir.glob('*.pdf'))
        txt_files_in_pages = list(pages_dir.glob('*.txt'))

        if pdf_files_in_pages or txt_files_in_pages:
            # Files are in pages directory, convert them in place
            input_path = pages_dir
            output_path = pages_dir  # Output to same directory
            return input_path, output_path

    # Default: look for files in root directory, output to pages
    input_path = target_dir
    output_path = target_dir / "pages"

    return input_path, output_path

def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print("Usage: python pdf_to_markdown.py <directory_or_name> [output_directory] [--recursive]")
        print("\nConverts PDF and text files to Markdown format.")
        print("\nExamples:")
        print("  python pdf_to_markdown.py ./pdfs")
        print("  python pdf_to_markdown.py ./text_files ./markdown_output")
        print("  python pdf_to_markdown.py ./mixed_content --recursive")
        print("  python pdf_to_markdown.py inglese_dante_guida_alla_divina_commedia")
        print("  python pdf_to_markdown.py squarotti_critica_dantesca_antologia")
        print("\nDirectory name mode: Automatically resolves paths in data/selected&cured/")
        print("  Input:  data/selected&cured/{name} (searches for .pdf and .txt files)")
        print("  Output: data/selected&cured/{name}/pages")
        sys.exit(1)

    input_arg = sys.argv[1]
    output_dir = None
    recursive = False

    # Parse arguments
    if len(sys.argv) >= 3:
        if sys.argv[2] == '--recursive':
            recursive = True
        else:
            output_dir = sys.argv[2]
            if len(sys.argv) >= 4 and sys.argv[3] == '--recursive':
                recursive = True

    # Determine if input is a path or directory name
    input_dir = Path(input_arg)

    # If input_arg is not an existing path, try to resolve as directory name
    if not input_dir.exists() and not '/' in input_arg and not '\\' in input_arg:
        print(f"Resolving directory name: {input_arg}")
        resolved_input, resolved_output = resolve_directory_paths(input_arg)

        if resolved_input is None:
            sys.exit(1)

        input_dir = resolved_input
        if output_dir is None:
            output_dir = resolved_output

        print(f"✓ Input path:  {input_dir}")
        print(f"✓ Output path: {output_dir}")

    convert_directory(input_dir, output_dir, recursive)

if __name__ == "__main__":
    main()