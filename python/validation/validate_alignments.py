#!/usr/bin/env python3
"""
Validation script for alignment quality using vLLM with Qwen model.
Checks if src_text can be used to retrieve tgt_text - validates that the alignment
is semantically related enough for retrieval purposes (not necessarily exact translation).
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List
from openai import OpenAI


def load_env_variables() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / '.env'
    env_vars = {}

    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value

    return env_vars


def create_vllm_client(host: str = "localhost", port: int = 8000) -> OpenAI:
    """Create OpenAI client configured for vLLM endpoint."""
    base_url = f"http://{host}:{port}/v1"
    return OpenAI(
        api_key="EMPTY",  # vLLM doesn't require API key
        base_url=base_url
    )


def create_validation_prompt(src_text: str, tgt_text: str, src_lang: str = "en", tgt_lang: str = "it") -> str:
    """Create a prompt to validate if target text is a reasonable retrieval match for source text."""
    prompt = f"""You are an expert in cross-lingual text retrieval and semantic alignment. Your task is to determine if a target text would be a valid retrieval result for a given source text.

Source query text ({src_lang}):
{src_text}

Target text ({tgt_lang}):
{tgt_text}

Context: This is for a retrieval system where users search with the source text to find the corresponding target text. The texts don't need to be exact translations, but they should be semantically related enough that retrieving the target based on the source makes sense.

Analyze whether the target text is a reasonable retrieval match for the source text. Consider:
1. Semantic relevance: Do they discuss the same topic, event, or concept?
2. Content alignment: Is the core meaning/information sufficiently aligned?
3. Retrieval quality: Would someone searching with the source text expect to find this target text?

Note: Perfect translation is NOT required. Paraphrases, summaries, or semantically equivalent texts are valid matches.

Respond with a JSON object containing:
- "is_valid_alignment": boolean (true if target is a reasonable retrieval match for source, false otherwise)
- "confidence": float between 0 and 1 (how confident you are in your assessment)
- "reason": string (brief explanation of your decision, max 2 sentences)

Respond ONLY with the JSON object, no additional text."""
    return prompt


def validate_alignment(
    client: OpenAI,
    src_text: str,
    tgt_text: str,
    model_name: str,
    src_lang: str = "en",
    tgt_lang: str = "it",
    temperature: float = 0.1,
    max_tokens: int = 500
) -> Dict[str, Any]:
    """Validate a single alignment pair using the LLM."""
    prompt = create_validation_prompt(src_text, tgt_text, src_lang, tgt_lang)

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )

        response_text = response.choices[0].message.content.strip()

        # Try to extract JSON from the response
        # Sometimes the model might include markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        result = json.loads(response_text)
        result["validation_success"] = True
        result["error"] = None

    except json.JSONDecodeError as e:
        result = {
            "is_valid_alignment": None,
            "confidence": 0.0,
            "reason": f"Failed to parse LLM response as JSON: {str(e)}",
            "validation_success": False,
            "error": "json_parse_error",
            "raw_response": response_text if 'response_text' in locals() else None
        }
    except Exception as e:
        result = {
            "is_valid_alignment": None,
            "confidence": 0.0,
            "reason": f"Error during validation: {str(e)}",
            "validation_success": False,
            "error": str(type(e).__name__)
        }

    return result


def process_jsonl_file(
    input_path: Path,
    output_path: Path,
    client: OpenAI,
    model_name: str,
    src_lang: str = "en",
    tgt_lang: str = "it",
    max_records: int = None,
    verbose: bool = False
) -> Dict[str, Any]:
    """Process JSONL file and validate each alignment."""
    stats = {
        "total_processed": 0,
        "valid_alignments": 0,
        "invalid_alignments": 0,
        "validation_errors": 0,
        "average_confidence": 0.0
    }

    confidences = []

    with open(input_path, 'r') as infile, open(output_path, 'w') as outfile:
        for i, line in enumerate(infile):
            if max_records and i >= max_records:
                break

            try:
                record = json.loads(line.strip())
            except json.JSONDecodeError:
                print(f"Warning: Skipping invalid JSON at line {i+1}", file=sys.stderr)
                continue

            src_text = record.get("src", "")
            tgt_text = record.get("tgt", "")

            if not src_text or not tgt_text:
                print(f"Warning: Missing text at line {i+1}", file=sys.stderr)
                continue

            if verbose:
                print(f"Processing record {i+1}...", file=sys.stderr)

            validation_result = validate_alignment(
                client=client,
                src_text=src_text,
                tgt_text=tgt_text,
                model_name=model_name,
                src_lang=src_lang,
                tgt_lang=tgt_lang
            )

            # Add validation results to the record
            record["validation"] = validation_result

            # Update statistics
            stats["total_processed"] += 1

            if validation_result.get("validation_success"):
                if validation_result.get("is_valid_alignment"):
                    stats["valid_alignments"] += 1
                else:
                    stats["invalid_alignments"] += 1

                if validation_result.get("confidence") is not None:
                    confidences.append(validation_result["confidence"])
            else:
                stats["validation_errors"] += 1

            # Write enriched record to output
            outfile.write(json.dumps(record, ensure_ascii=False) + '\n')

            if verbose and (i + 1) % 10 == 0:
                print(f"Processed {i+1} records...", file=sys.stderr)

    if confidences:
        stats["average_confidence"] = sum(confidences) / len(confidences)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Validate alignment quality using vLLM with Qwen model"
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Input JSONL file containing alignments"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        help="Output JSONL file with validation results (default: input_file with .validated.jsonl suffix)"
    )
    parser.add_argument(
        "--host",
        default="localhost",
        help="vLLM server host (default: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="vLLM server port (default: 8000)"
    )
    parser.add_argument(
        "--src-lang",
        default="en",
        help="Source language code (default: en)"
    )
    parser.add_argument(
        "--tgt-lang",
        default="it",
        help="Target language code (default: it)"
    )
    parser.add_argument(
        "--max-records",
        type=int,
        help="Maximum number of records to process (for testing)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Load environment variables
    env_vars = load_env_variables()
    model_name = env_vars.get("VLLM_SERVED_MODEL_NAME", "Qwen/Qwen2.5-32B-Instruct-AWQ")

    # Determine output path
    output_path = args.output
    if not output_path:
        output_path = args.input_file.parent / f"{args.input_file.stem}.validated.jsonl"

    # Check if input file exists
    if not args.input_file.exists():
        print(f"Error: Input file not found: {args.input_file}", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"Input file: {args.input_file}", file=sys.stderr)
        print(f"Output file: {output_path}", file=sys.stderr)
        print(f"vLLM endpoint: http://{args.host}:{args.port}/v1", file=sys.stderr)
        print(f"Model: {model_name}", file=sys.stderr)
        print(f"Languages: {args.src_lang} -> {args.tgt_lang}", file=sys.stderr)
        print("-" * 80, file=sys.stderr)

    # Create vLLM client
    client = create_vllm_client(host=args.host, port=args.port)

    # Process the file
    stats = process_jsonl_file(
        input_path=args.input_file,
        output_path=output_path,
        client=client,
        model_name=model_name,
        src_lang=args.src_lang,
        tgt_lang=args.tgt_lang,
        max_records=args.max_records,
        verbose=args.verbose
    )

    # Print summary
    print("\n" + "=" * 80, file=sys.stderr)
    print("VALIDATION SUMMARY", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print(f"Total processed: {stats['total_processed']}", file=sys.stderr)
    print(f"Valid alignments: {stats['valid_alignments']}", file=sys.stderr)
    print(f"Invalid alignments: {stats['invalid_alignments']}", file=sys.stderr)
    print(f"Validation errors: {stats['validation_errors']}", file=sys.stderr)
    print(f"Average confidence: {stats['average_confidence']:.2f}", file=sys.stderr)
    print(f"\nOutput written to: {output_path}", file=sys.stderr)
    print("=" * 80, file=sys.stderr)


if __name__ == "__main__":
    main()