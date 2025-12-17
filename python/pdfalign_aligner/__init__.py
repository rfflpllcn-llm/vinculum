"""
pdfalign-aligner: PDF to JSONL Pipeline with BERT Alignment

A complete pipeline for converting PDFs to JSONL format with optional
multilingual text alignment using BERT embeddings.
"""

from .pipeline import PDFToJSONLPipeline

__version__ = "0.1.0"
__all__ = ["PDFToJSONLPipeline"]
