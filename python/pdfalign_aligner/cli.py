#!/usr/bin/env python3
"""
CLI entry point for the PDF to JSONL pipeline.
"""

import argparse
import sys

from .pipeline import PDFToJSONLPipeline


def main():
    """CLI entry point for the pipeline."""
    parser = argparse.ArgumentParser(
        description="Convert PDFs to JSONL format with per-page markdown intermediate representation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full pipeline
  %(prog)s --config config.yaml

  # Run full pipeline with BERT alignment
  %(prog)s --config config.yaml --align

  # Skip PDF conversion, only merge existing markdown files
  %(prog)s --config config.yaml --skip-pdf-conversion

  # Customize output fields
  %(prog)s --config config.yaml --text-field query --metadata-fields chunk_id language page

  # Run only alignment on existing JSONL
  %(prog)s --config config.yaml --skip-pdf-conversion --align
        """
    )

    parser.add_argument(
        "--config",
        type=str,
        required=True,
        help="Path to config.yaml file"
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
        default=None,
        help="Metadata fields to include (default: chunk_id language page)"
    )

    parser.add_argument(
        "--skip-pdf-conversion",
        action="store_true",
        help="Skip PDF to Markdown conversion, only merge existing markdown files"
    )

    parser.add_argument(
        "--align",
        action="store_true",
        help="Run BERT alignment after merging (requires language config in config.yaml)"
    )

    args = parser.parse_args()

    try:
        pipeline = PDFToJSONLPipeline(args.config)
        success = pipeline.run_full_pipeline(
            text_field=args.text_field,
            metadata_fields=args.metadata_fields,
            skip_pdf_conversion=args.skip_pdf_conversion,
            run_alignment=args.align
        )
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
