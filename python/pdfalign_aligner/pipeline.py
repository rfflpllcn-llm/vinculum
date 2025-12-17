"""
PDF to JSONL Pipeline

This module provides the core pipeline functionality for:
1. Converting PDFs in a directory to per-page markdown files
2. Merging all markdown files into a single JSONL file
3. (Optional) Aligning source language to target languages using BERT alignment
"""
import json
import shutil
import subprocess
import sys
import yaml
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any


class PDFToJSONLPipeline:
    """
    Complete pipeline for converting PDFs to JSONL format.
    """

    def __init__(self, config_path: Path):
        """
        Initialize pipeline with configuration.

        Args:
            config_path: Path to config.yaml file
        """
        self.config_path = Path(config_path)
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        # Get project root (one level up from this file: python/pdfalign_aligner/pipeline.py -> python/)
        self.project_root = Path(__file__).parent.parent.resolve()
        self.pdf_pipeline_dir = self.project_root / "pdf_pipeline"
        self.python_path = sys.executable

        # Extract config paths
        self.base_data_dir = Path(self.config['paths']['base_data_dir'])
        self.source_data_subdir = self.config['paths']['source_data_subdir']
        self.data_dir = self.base_data_dir / self.source_data_subdir

    def run_pdf_to_markdown(self) -> bool:
        """
        Run the PDF to Markdown conversion pipeline.

        This executes all 6 steps of the PDF processing:
        1. Normalize filenames
        2. Organize PDFs into folders
        3. Split PDFs by page
        4. Remove original PDFs
        5. Convert to Markdown
        6. Remove remaining PDFs

        Returns:
            True if successful, False otherwise
        """
        print("=" * 50)
        print("PDF to Markdown Pipeline")
        print("=" * 50)
        print(f"Data directory: {self.data_dir}")
        print()

        steps = [
            ("1/6: Normalizing filenames",
             [self.python_path, str(self.pdf_pipeline_dir / "normalize_pdf_names.py"),
              str(self.data_dir), "-r", "-y"]),

            ("2/6: Organizing PDFs into folders",
             [self.python_path, str(self.pdf_pipeline_dir / "organize_pdfs_into_folders.py"),
              str(self.data_dir), "-r", "-y"]),

            ("3/6: Splitting PDFs by page (parallel)",
             [self.python_path, str(self.pdf_pipeline_dir / "split_pdfs_by_page_parallel.py"),
              str(self.data_dir), "-r", "-y"]),

            ("4/6: Removing original PDFs (post-split cleanup)",
             [self.python_path, str(self.pdf_pipeline_dir / "remove_pdfs_matching_folder.py"),
              "-y", "-r", str(self.data_dir)]),

            ("5/6: Converting PDFs to Markdown (parallel)",
             [str(self.pdf_pipeline_dir / "run_pdf_to_markdown_parallel.sh"),
              str(self.data_dir)]),

            ("6/6: Removing all remaining PDFs",
             [self.python_path, str(self.pdf_pipeline_dir / "remove_all_pdfs.py"),
              "-y", "-r", str(self.data_dir)])
        ]

        for step_name, cmd in steps:
            print(f"Step {step_name}...")
            try:
                result = subprocess.run(cmd, check=True, capture_output=True, text=True)
                if result.stdout:
                    print(result.stdout)
                print(f"✓ Step completed")
                print()
            except subprocess.CalledProcessError as e:
                print(f"✗ Step failed: {e}")
                if e.stderr:
                    print(f"Error: {e.stderr}")
                return False

        return True

    def run_merge_to_jsonl(
        self,
        text_field: str = "text",
        metadata_fields: Optional[List[str]] = None
    ) -> bool:
        """
        Merge all markdown files into a single JSONL file.

        Args:
            text_field: Name of the field to store text content
            metadata_fields: List of metadata fields to include

        Returns:
            True if successful, False otherwise
        """
        print("=" * 50)
        print("Merging Markdown to JSONL")
        print("=" * 50)

        cmd = [
            self.python_path,
            str(self.pdf_pipeline_dir / "merge_md_to_jsonl.py"),
            "--config", str(self.config_path),
            "--text-field", text_field
        ]

        if metadata_fields:
            cmd.extend(["--metadata-fields"] + metadata_fields)

        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            if result.stdout:
                print(result.stdout)
            print("✓ Merge completed")
            return True
        except subprocess.CalledProcessError as e:
            print(f"✗ Merge failed: {e}")
            if e.stderr:
                print(f"Error: {e.stderr}")
            return False

    def _detect_languages_from_data(self, data: List[Dict]) -> tuple:
        """
        Automatically detect languages from JSONL data using langdetect.

        Determines source language with priority: en > it > de > fr
        Other detected languages become targets.

        Args:
            data: List of JSONL entries with 'language' field

        Returns:
            Tuple of (source_language, target_languages_list)
        """
        from langdetect import detect, DetectorFactory

        # Set seed for consistent results
        DetectorFactory.seed = 0

        # Detect languages from data
        detected_langs = set()
        for entry in data:
            if 'language' in entry:
                detected_langs.add(entry['language'])

        if not detected_langs:
            # Fallback: detect from text content
            print("No 'language' field found, detecting from text content...")
            lang_samples = {}
            for entry in data[:100]:  # Sample first 100 entries
                text = entry.get('text', '')
                if len(text) > 20:  # Need enough text
                    try:
                        lang = detect(text[:200])
                        lang_samples[lang] = lang_samples.get(lang, 0) + 1
                    except:
                        continue
            detected_langs = set(lang_samples.keys())

        print(f"Detected languages: {sorted(detected_langs)}")

        # Determine source language with priority
        source_priority = ['en', 'it', 'de', 'fr']
        source_lang = None

        for lang in source_priority:
            if lang in detected_langs:
                source_lang = lang
                break

        # If no priority language found, use first detected
        if not source_lang:
            source_lang = sorted(detected_langs)[0] if detected_langs else 'en'

        # Remaining languages are targets
        target_langs = sorted(detected_langs - {source_lang})

        print(f"Auto-detected: Source={source_lang}, Targets={target_langs}")

        return source_lang, target_langs

    def run_bert_alignment(self) -> bool:
        """
        Run BERT alignment to align source language text with target languages.

        This step:
        1. Loads the JSONL file created by merge step
        2. Separates entries by language (source and targets)
        3. Uses Bertalign to align source with each target language
        4. Creates aligned pairs and writes them to separate JSONL files

        Languages can be:
        - Specified in config.yaml under 'languages'
        - Auto-detected from data (with priority: en > it > de > fr)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Add project root to path to import local bertalign module
            if str(self.project_root) not in sys.path:
                sys.path.insert(0, str(self.project_root))
            from bertalign import Bertalign
        except ImportError:
            print("✗ Bertalign not available. Skipping alignment step.")
            print("  To use alignment, ensure bertalign is properly installed.")
            return False

        print("=" * 50)
        print("BERT Alignment")
        print("=" * 50)

        # Load JSONL data first (needed for auto-detection)
        experiments_dir = self.base_data_dir / self.config['paths']['experiments_subdir']
        source_data_file = experiments_dir / self.config['paths']['source_data_file']

        if not source_data_file.exists():
            print(f"✗ Source data file not found: {source_data_file}")
            return False

        data = []
        with open(source_data_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    data.append(json.loads(line))

        # Get or detect languages
        if 'languages' in self.config and self.config['languages']:
            # Use configured languages
            language_src = self.config['languages']['source']
            language_tgt = tuple(self.config['languages']['targets'])
            print(f"Using configured languages: Source={language_src}, Targets={list(language_tgt)}")
        else:
            # Auto-detect languages
            print("No languages configured, auto-detecting...")
            language_src, language_tgt_list = self._detect_languages_from_data(data)
            language_tgt = tuple(language_tgt_list)

        # Store languages as instance variables for production mode cleanup
        self.detected_language_src = language_src
        self.detected_language_tgt = language_tgt
        fake_validation = self.config['alignment']['fake_validation']
        keep_all_alignments = self.config['alignment']['keep_all_alignments']
        bert_config = self.config['bert_aligner']

        # Generate experiment ID
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        config_id = f"ma{bert_config['max_align']}_p{int(bert_config['percent']*100)}_w{bert_config['win']}_k{bert_config['top_k']}"
        experiment_id = f"exp_{config_id}_{timestamp}"

        # Setup output paths
        output_dir = experiments_dir / experiment_id
        output_dir.mkdir(parents=True, exist_ok=True)

        print(f"Experiment ID: {experiment_id}")
        print(f"Source data: {source_data_file}")
        print()

        # Get source entries
        src_entries = [e for e in data if e['language'] == language_src]
        print(f"Found {len(src_entries)} {language_src.upper()} lines")

        if not src_entries:
            print(f"✗ No source language ({language_src}) entries found")
            return False

        # Process each target language
        for lang_tgt in language_tgt:
            print(f"\n{'='*60}")
            print(f"Processing language pair: {language_src.upper()} -> {lang_tgt.upper()}")
            print(f"{'='*60}")

            # Get target entries
            tgt_entries = [e for e in data if e['language'] == lang_tgt]
            print(f"Found {len(tgt_entries)} {lang_tgt.upper()} lines")

            if not tgt_entries:
                print(f"Warning: No {lang_tgt} entries found, skipping")
                continue

            # Prepare texts
            src_texts = [e['text'] for e in src_entries]
            tgt_texts = [e['text'] for e in tgt_entries]

            print(f"  Source ({language_src.upper()}): {len(src_texts)} lines")
            print(f"  Target ({lang_tgt.upper()}): {len(tgt_texts)} lines")

            # Join texts for alignment
            src = "\n".join(src_texts)
            tgt = "\n".join(tgt_texts)

            # Run BERT alignment
            print(f"  Running BERT alignment...")
            aligner = Bertalign(
                src,
                tgt,
                max_align=bert_config['max_align'],
                min_win_size=bert_config['min_win_size'],
                percent=bert_config['percent'],
                win=bert_config['win'],
                top_k=bert_config['top_k'],
                is_split=bert_config['is_split']
            )
            aligner.align_sents()

            # Process aligned pairs
            aligned_pairs = []
            for bead in aligner.result:
                src_bead, tgt_bead = bead

                # Extract source sentence(s)
                if len(src_bead) > 0:
                    src_sent = ' '.join(aligner.src_sents[src_bead[0]:src_bead[-1]+1])
                else:
                    src_sent = ''

                # Extract target sentence(s)
                if len(tgt_bead) > 0:
                    tgt_sent = ' '.join(aligner.tgt_sents[tgt_bead[0]:tgt_bead[-1]+1])
                else:
                    tgt_sent = ''

                if src_bead and tgt_bead:
                    aligned_pairs.append((
                        src_sent, tgt_sent,
                        src_entries[src_bead[0]:src_bead[-1]+1],
                        tgt_entries[tgt_bead[0]:tgt_bead[-1]+1],
                        src_bead, tgt_bead
                    ))
                else:
                    if src_bead:
                        aligned_pairs.append((
                            src_sent, tgt_sent,
                            src_entries[src_bead[0]:src_bead[-1]+1],
                            [],
                            src_bead, tgt_bead
                        ))
                    elif tgt_bead:
                        aligned_pairs.append((
                            src_sent, tgt_sent,
                            [],
                            tgt_entries[tgt_bead[0]:tgt_bead[-1]+1],
                            src_bead, tgt_bead
                        ))
                    else:
                        aligned_pairs.append((
                            src_sent, tgt_sent,
                            [], [],
                            src_bead, tgt_bead
                        ))

            print(f"  Aligned: {len(aligned_pairs)} sentence pairs")

            # Create alignment entries
            all_alignments = []
            validation = {}
            if fake_validation:
                validation = {
                    "is_valid_alignment": True,
                    "confidence": 1.0,
                    "reason": "test",
                    "validation_success": True,
                    "error": None
                }

            alignment_type_counts = {}

            for i, (src_sent, tgt_sent, sent, tent, src_bead, tgt_bead) in enumerate(aligned_pairs):
                # Filter based on KEEP_ALL_ALIGNMENTS config
                if keep_all_alignments or (sent and tent):
                    alignment_type = f"{len(src_bead)}-{len(tgt_bead)}"
                    alignment_type_counts[alignment_type] = alignment_type_counts.get(alignment_type, 0) + 1

                    alignment_entry = {
                        'alignment_id': len(all_alignments),
                        'pair_id': i,
                        'src_text': src_sent,
                        'tgt_text': tgt_sent,
                        'src_lang': language_src,
                        'tgt_lang': lang_tgt,
                        'alignment_type': alignment_type,
                        'src_chunks': sent,
                        'tgt_chunks': tent,
                        'validation': validation
                    }
                    all_alignments.append(alignment_entry)

            # Write alignments to JSONL
            output_file = output_dir / f"{self.source_data_subdir}_aligned-{language_src}-{lang_tgt}.jsonl"
            print(f"\nWriting {len(all_alignments)} aligned pairs to {output_file}")
            with output_file.open('w', encoding='utf-8') as f:
                for entry in all_alignments:
                    f.write(json.dumps(entry, ensure_ascii=False) + '\n')

            # Print statistics
            print(f"\nAlignment Statistics for {language_src}-{lang_tgt}:")
            print(f"  {len(src_texts)} {language_src} lines, {len(tgt_texts)} {lang_tgt} lines → {len(aligned_pairs)} pairs")
            print(f"  Kept {len(all_alignments)} alignments (KEEP_ALL_ALIGNMENTS={keep_all_alignments})")
            print(f"\nAlignment type distribution:")
            for atype in sorted(alignment_type_counts.keys()):
                print(f"    {atype}: {alignment_type_counts[atype]}")

            # Save metadata
            metadata_file = output_dir / f"metadata_{language_src}-{lang_tgt}.json"
            metadata = {
                "experiment_id": experiment_id,
                "timestamp": timestamp,
                "language_pair": f"{language_src}-{lang_tgt}",
                "data_file": output_file.name,
                "source_file": str(source_data_file),
                "total_aligned_pairs": len(all_alignments),
                "alignment_statistics": {
                    'src_lines': len(src_texts),
                    'tgt_lines': len(tgt_texts),
                    'aligned_pairs': len(aligned_pairs)
                },
                "alignment_type_distribution": alignment_type_counts,
                "keep_all_alignments": keep_all_alignments,
                "bert_aligner_config": bert_config
            }

            with metadata_file.open('w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            print(f"Wrote metadata to: {metadata_file}")

        print(f"\n{'='*60}")
        print(f"All language pairs processed!")
        print(f"Experiment directory: {output_dir}")
        print(f"{'='*60}")

        # Store last experiment directory for production mode cleanup
        self.last_experiment_dir = output_dir

        return True

    def apply_production_mode(self) -> bool:
        """
        Apply production mode simplifications if IS_PROD is True.

        In production mode:
        - Rename source_data_file to chunks.jsonl
        - Rename aligned files to {src_lang}-{tgt_lang}.jsonl
        - Move all final outputs to source_data_subdir
        - Remove experiments directory and all intermediate files

        Returns:
            True if successful, False otherwise
        """
        is_prod = self.config.get('IS_PROD', False)

        if not is_prod:
            return True  # Nothing to do

        print("=" * 50)
        print("Applying Production Mode")
        print("=" * 50)

        try:
            # Get paths
            experiments_dir = self.base_data_dir / self.config['paths']['experiments_subdir']
            output_dir = self.data_dir  # source_data_subdir

            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)

            # 1. Copy and rename chunks.jsonl
            source_data_file = experiments_dir / self.config['paths']['source_data_file']
            chunks_file = output_dir / "chunks.jsonl"

            if source_data_file.exists():
                print(f"Moving {source_data_file.name} -> chunks.jsonl")
                shutil.copy2(source_data_file, chunks_file)
                print(f"✓ Created {chunks_file}")

            # 2. Find and move aligned files
            if hasattr(self, 'last_experiment_dir') and self.last_experiment_dir.exists():
                # Use detected/configured languages from alignment run
                language_src = getattr(self, 'detected_language_src', None)
                language_tgt = getattr(self, 'detected_language_tgt', ())

                if not language_src:
                    print("⚠️  No language information available, skipping aligned file cleanup")
                    return True

                for lang_tgt in language_tgt:
                    # Find aligned file in experiment directory
                    aligned_pattern = f"*_aligned-{language_src}-{lang_tgt}.jsonl"
                    aligned_files = list(self.last_experiment_dir.glob(aligned_pattern))

                    if aligned_files:
                        aligned_file = aligned_files[0]
                        simple_name = f"{language_src}-{lang_tgt}.jsonl"
                        output_file = output_dir / simple_name

                        print(f"Moving {aligned_file.name} -> {simple_name}")
                        shutil.copy2(aligned_file, output_file)
                        print(f"✓ Created {output_file}")

            # 3. Remove experiments directory
            if experiments_dir.exists():
                print(f"\nRemoving experiments directory: {experiments_dir}")
                shutil.rmtree(experiments_dir)
                print("✓ Experiments directory removed")

            # 4. Remove markdown folders (language-specific directories)
            print("\nRemoving markdown folders...")
            for item in output_dir.iterdir():
                if item.is_dir():
                    print(f"  Removing {item.name}/")
                    shutil.rmtree(item)
            print("✓ Markdown folders removed")

            print("\n✅ Production mode applied successfully!")
            print(f"Output directory: {output_dir}")
            print(f"Files: chunks.jsonl, {language_src}-*.jsonl")

            return True

        except Exception as e:
            print(f"✗ Production mode failed: {e}")
            return False

    def run_full_pipeline(
        self,
        text_field: str = "text",
        metadata_fields: Optional[List[str]] = None,
        skip_pdf_conversion: bool = False,
        run_alignment: bool = False
    ) -> bool:
        """
        Run the complete pipeline from PDF to JSONL, optionally with alignment.

        Args:
            text_field: Name of the field to store text content
            metadata_fields: List of metadata fields to include
            skip_pdf_conversion: If True, skip PDF conversion and only merge existing MD files
            run_alignment: If True, run BERT alignment after merging

        Returns:
            True if successful, False otherwise
        """
        # Step 1: PDF to Markdown
        if not skip_pdf_conversion:
            if not self.run_pdf_to_markdown():
                print("\n❌ Pipeline failed during PDF to Markdown conversion")
                return False

        # Step 2: Merge to JSONL
        if not self.run_merge_to_jsonl(text_field, metadata_fields):
            print("\n❌ Pipeline failed during Markdown to JSONL merge")
            return False

        # Step 3: BERT Alignment (optional)
        if run_alignment:
            if not self.run_bert_alignment():
                print("\n❌ Pipeline failed during BERT alignment")
                return False

        # Step 4: Apply production mode if enabled
        if not self.apply_production_mode():
            print("\n⚠️  Warning: Production mode cleanup failed")
            # Don't return False - the main pipeline succeeded

        print("\n✅ Full pipeline completed successfully!")
        return True
