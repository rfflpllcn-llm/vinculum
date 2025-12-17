#!/usr/bin/env python3
"""
Analyze validation results from a validated JSONL file.
Provides statistics on validation success, alignment quality, and confidence scores.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict, Counter


def load_validated_jsonl(file_path: Path) -> List[Dict[str, Any]]:
    """Load records from validated JSONL file."""
    records = []

    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            try:
                record = json.loads(line.strip())
                records.append(record)
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping invalid JSON at line {i}: {e}", file=sys.stderr)
                continue

    return records


def analyze_validation_results(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze validation results and compute statistics."""

    stats = {
        "total_records": len(records),
        "validation_success": 0,
        "validation_errors": 0,
        "valid_alignments": 0,
        "invalid_alignments": 0,
        "confidences": [],
        "by_part": defaultdict(lambda: {
            "total": 0,
            "valid": 0,
            "invalid": 0,
            "errors": 0
        }),
        "by_alignment_type": defaultdict(lambda: {
            "total": 0,
            "valid": 0,
            "invalid": 0
        }),
        "error_types": Counter(),
        "low_confidence_records": [],  # confidence < 0.5
        "high_confidence_records": [],  # confidence >= 0.9
    }

    for record in records:
        validation = record.get("validation", {})
        part = record.get("part", "unknown")
        alignment_type = record.get("alignment_type", "unknown")

        # Count by part
        stats["by_part"][part]["total"] += 1
        stats["by_alignment_type"][alignment_type]["total"] += 1

        # Check validation success
        if validation.get("validation_success"):
            stats["validation_success"] += 1

            # Check alignment validity
            if validation.get("is_valid_alignment"):
                stats["valid_alignments"] += 1
                stats["by_part"][part]["valid"] += 1
                stats["by_alignment_type"][alignment_type]["valid"] += 1
            else:
                stats["invalid_alignments"] += 1
                stats["by_part"][part]["invalid"] += 1
                stats["by_alignment_type"][alignment_type]["invalid"] += 1

            # Collect confidence scores
            confidence = validation.get("confidence")
            if confidence is not None:
                stats["confidences"].append(confidence)

                # Track low/high confidence
                if confidence < 0.5:
                    stats["low_confidence_records"].append({
                        "part": part,
                        "src_text": record.get("src_text", "")[:100],
                        "tgt_text": record.get("tgt_text", "")[:100],
                        "confidence": confidence,
                        "reason": validation.get("reason", "")
                    })
                elif confidence >= 0.9:
                    stats["high_confidence_records"].append({
                        "part": part,
                        "confidence": confidence
                    })
        else:
            stats["validation_errors"] += 1
            stats["by_part"][part]["errors"] += 1

            # Track error types
            error = validation.get("error", "unknown")
            stats["error_types"][error] += 1

    # Compute confidence statistics
    if stats["confidences"]:
        stats["confidence_stats"] = {
            "min": min(stats["confidences"]),
            "max": max(stats["confidences"]),
            "mean": sum(stats["confidences"]) / len(stats["confidences"]),
            "median": sorted(stats["confidences"])[len(stats["confidences"]) // 2]
        }
    else:
        stats["confidence_stats"] = None

    return stats


def print_statistics(stats: Dict[str, Any], verbose: bool = False):
    """Print formatted statistics."""

    print("=" * 80)
    print("VALIDATION RESULTS ANALYSIS")
    print("=" * 80)

    # Overall statistics
    print("\n## Overall Statistics")
    print(f"Total records: {stats['total_records']}")
    print(f"Validation successful: {stats['validation_success']} ({stats['validation_success']/stats['total_records']*100:.1f}%)")
    print(f"Validation errors: {stats['validation_errors']} ({stats['validation_errors']/stats['total_records']*100:.1f}%)")

    # Alignment quality
    if stats['validation_success'] > 0:
        print(f"\n## Alignment Quality (from successful validations)")
        print(f"Valid alignments: {stats['valid_alignments']} ({stats['valid_alignments']/stats['validation_success']*100:.1f}%)")
        print(f"Invalid alignments: {stats['invalid_alignments']} ({stats['invalid_alignments']/stats['validation_success']*100:.1f}%)")

    # Confidence statistics
    if stats['confidence_stats']:
        print(f"\n## Confidence Scores")
        print(f"Average: {stats['confidence_stats']['mean']:.3f}")
        print(f"Median: {stats['confidence_stats']['median']:.3f}")
        print(f"Min: {stats['confidence_stats']['min']:.3f}")
        print(f"Max: {stats['confidence_stats']['max']:.3f}")
        print(f"Low confidence (<0.5): {len(stats['low_confidence_records'])}")
        print(f"High confidence (≥0.9): {len(stats['high_confidence_records'])}")

    # By part statistics
    if stats['by_part']:
        print(f"\n## By Part")
        print(f"{'Part':<10} {'Total':>8} {'Valid':>8} {'Invalid':>8} {'Errors':>8} {'Valid%':>10}")
        print("-" * 60)
        for part in sorted(stats['by_part'].keys()):
            part_stats = stats['by_part'][part]
            valid_pct = (part_stats['valid'] / part_stats['total'] * 100) if part_stats['total'] > 0 else 0
            print(f"{part:<10} {part_stats['total']:>8} {part_stats['valid']:>8} "
                  f"{part_stats['invalid']:>8} {part_stats['errors']:>8} {valid_pct:>9.1f}%")

    # By alignment type
    if stats['by_alignment_type']:
        print(f"\n## By Alignment Type")
        print(f"{'Type':<10} {'Total':>8} {'Valid':>8} {'Invalid':>8} {'Valid%':>10}")
        print("-" * 50)
        for atype in sorted(stats['by_alignment_type'].keys()):
            type_stats = stats['by_alignment_type'][atype]
            total_validated = type_stats['valid'] + type_stats['invalid']
            valid_pct = (type_stats['valid'] / total_validated * 100) if total_validated > 0 else 0
            print(f"{atype:<10} {type_stats['total']:>8} {type_stats['valid']:>8} "
                  f"{type_stats['invalid']:>8} {valid_pct:>9.1f}%")

    # Error types
    if stats['error_types']:
        print(f"\n## Error Types")
        for error, count in stats['error_types'].most_common():
            print(f"  {error}: {count}")

    # Verbose output
    if verbose and stats['low_confidence_records']:
        print(f"\n## Low Confidence Records (showing first 5)")
        for i, rec in enumerate(stats['low_confidence_records'][:5], 1):
            print(f"\n{i}. Part {rec['part']} - Confidence: {rec['confidence']:.3f}")
            print(f"   EN: {rec['src_text']}")
            print(f"   IT: {rec['tgt_text']}")
            print(f"   Reason: {rec['reason']}")

    print("\n" + "=" * 80)


def export_summary(stats: Dict[str, Any], output_path: Path):
    """Export summary statistics to JSON."""

    # Convert defaultdicts to regular dicts for JSON serialization
    export_stats = {
        "total_records": stats["total_records"],
        "validation_success": stats["validation_success"],
        "validation_errors": stats["validation_errors"],
        "valid_alignments": stats["valid_alignments"],
        "invalid_alignments": stats["invalid_alignments"],
        "confidence_stats": stats["confidence_stats"],
        "by_part": dict(stats["by_part"]),
        "by_alignment_type": dict(stats["by_alignment_type"]),
        "error_types": dict(stats["error_types"]),
        "low_confidence_count": len(stats["low_confidence_records"]),
        "high_confidence_count": len(stats["high_confidence_records"])
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_stats, f, indent=2, ensure_ascii=False)

    print(f"\nSummary exported to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze validation results from validated JSONL file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze validation results
  python validation/analyze_validation_results.py alignment_results.validated.jsonl

  # Verbose output with examples
  python validation/analyze_validation_results.py alignment_results.validated.jsonl -v

  # Export summary to JSON
  python validation/analyze_validation_results.py alignment_results.validated.jsonl \\
      --export-summary results_summary.json
        """
    )

    parser.add_argument(
        "input_file",
        type=Path,
        help="Input validated JSONL file"
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed output including examples"
    )

    parser.add_argument(
        "--export-summary",
        type=Path,
        help="Export summary statistics to JSON file"
    )

    parser.add_argument(
        "--min-confidence",
        type=float,
        help="Filter: show only records with confidence >= this value"
    )

    parser.add_argument(
        "--part",
        help="Filter: analyze only specific part"
    )

    args = parser.parse_args()

    # Check input file
    if not args.input_file.exists():
        print(f"Error: Input file not found: {args.input_file}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading records from: {args.input_file}", file=sys.stderr)
    records = load_validated_jsonl(args.input_file)

    if not records:
        print("Error: No records loaded", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(records)} records", file=sys.stderr)

    # Apply filters
    if args.part:
        records = [r for r in records if r.get("part") == args.part]
        print(f"Filtered to part {args.part}: {len(records)} records", file=sys.stderr)

    if args.min_confidence is not None:
        records = [
            r for r in records
            if r.get("validation", {}).get("confidence", 0) >= args.min_confidence
        ]
        print(f"Filtered to confidence >= {args.min_confidence}: {len(records)} records", file=sys.stderr)

    # Analyze
    print("Analyzing...\n", file=sys.stderr)
    stats = analyze_validation_results(records)

    # Print results
    print_statistics(stats, verbose=args.verbose)

    # Export if requested
    if args.export_summary:
        export_summary(stats, args.export_summary)


if __name__ == "__main__":
    main()