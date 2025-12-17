# Alignment Validation

This directory contains scripts for validating the quality of text alignments using LLMs.

## validate_alignments.py

Validates alignment pairs for retrieval purposes - checks if `src_text` can be used to retrieve/point to `tgt_text`. The validation focuses on semantic relevance rather than exact translation quality, making it suitable for cross-lingual retrieval systems.

### Prerequisites

1. Ensure the vLLM service is running:
   ```bash
   docker-compose up -d vllm-qwen
   ```

2. Install dependencies:
   ```bash
   uv sync
   ```

### Usage

Basic usage:
```bash
python validation/validate_alignments.py <input_file.jsonl>
```

With options:
```bash
python validation/validate_alignments.py <input_file.jsonl> \
    --output validated_output.jsonl \
    --src-lang en \
    --tgt-lang it \
    --verbose
```

### Arguments

- `input_file`: Path to JSONL file containing alignments (required)
- `-o, --output`: Output path (default: `<input_file>.validated.jsonl`)
- `--host`: vLLM server host (default: `localhost`)
- `--port`: vLLM server port (default: `8000`)
- `--src-lang`: Source language code (default: `en`)
- `--tgt-lang`: Target language code (default: `it`)
- `--max-records`: Limit processing to N records (useful for testing)
- `-v, --verbose`: Enable verbose output

### Input Format

The script expects JSONL files where each line contains an alignment record with at least:
```json
{
  "src_text": "source text here",
  "tgt_text": "target text here",
  ...other fields...
}
```

### Output Format

The output JSONL file contains all original fields plus a `validation` object:
```json
{
  "src_text": "...",
  "tgt_text": "...",
  ...original fields...,
  "validation": {
    "is_valid_alignment": true,
    "confidence": 0.95,
    "reason": "The texts discuss the same topic with sufficient semantic overlap for retrieval.",
    "validation_success": true,
    "error": null
  }
}
```

### Example

```bash
# Validate a small sample
python validation/validate_alignments.py \
    /home/rp/data/melancolia_della_resistenza/chunking4/experiments/exp_ma4_p15_w20_k10_20251123_152528/alignment_results.jsonl \
    --max-records 10 \
    --verbose

# Validate full file
python validation/validate_alignments.py \
    alignment_results.jsonl \
    -o validated_alignments.jsonl
```

### Output Summary

After processing, the script prints a summary:
```
================================================================================
VALIDATION SUMMARY
================================================================================
Total processed: 100
Valid alignments: 87
Invalid alignments: 10
Validation errors: 3
Average confidence: 0.89

Output written to: alignment_results.validated.jsonl
================================================================================
```

### Notes on Validation Approach

This validator is designed for **retrieval-focused validation**, not translation quality assessment:

- **Valid alignment**: The target text is a reasonable match when searching with the source text
- **Not required**: Perfect word-for-word translation, complete information preservation
- **Acceptable**: Paraphrases, summaries, semantically equivalent content
- **Focus**: Can a retrieval system successfully point to the target using the source?

This approach is ideal for validating cross-lingual text alignment systems where the goal is semantic matching rather than translation accuracy.

---

## analyze_validation_results.py

Analyzes validated JSONL files to compute statistics on validation success, alignment quality, and confidence scores.

### Usage

Basic analysis:
```bash
python validation/analyze_validation_results.py alignment_results.validated.jsonl
```

With verbose output:
```bash
python validation/analyze_validation_results.py alignment_results.validated.jsonl -v
```

Export summary to JSON:
```bash
python validation/analyze_validation_results.py alignment_results.validated.jsonl \
    --export-summary summary.json
```

### Arguments

- `input_file`: Path to validated JSONL file (required)
- `-v, --verbose`: Show detailed output including low-confidence examples
- `--export-summary`: Export summary statistics to JSON file
- `--min-confidence`: Filter to records with confidence >= threshold
- `--part`: Filter to specific part

### Output

The script provides comprehensive statistics:

```
================================================================================
VALIDATION RESULTS ANALYSIS
================================================================================

## Overall Statistics
Total records: 7144
Validation successful: 7143 (100.0%)
Validation errors: 1 (0.0%)

## Alignment Quality (from successful validations)
Valid alignments: 5855 (82.0%)
Invalid alignments: 1288 (18.0%)

## Confidence Scores
Average: 0.837
Median: 0.850
Min: 0.700
Max: 1.000
Low confidence (<0.5): 0
High confidence (≥0.9): 645

## By Part
Part          Total    Valid  Invalid   Errors     Valid%
------------------------------------------------------------
001            1364     1128      236        0      82.7%
002             764      607      157        0      79.5%
...

## By Alignment Type
Type          Total    Valid  Invalid     Valid%
--------------------------------------------------
1-1            4390     3366     1024      76.7%
2-2            1237     1188       49      96.0%
...
```

### Examples

```bash
# Analyze specific part
python validation/analyze_validation_results.py results.validated.jsonl --part 001

# Show only high-confidence alignments
python validation/analyze_validation_results.py results.validated.jsonl --min-confidence 0.9

# Verbose mode with low-confidence examples
python validation/analyze_validation_results.py results.validated.jsonl -v
```