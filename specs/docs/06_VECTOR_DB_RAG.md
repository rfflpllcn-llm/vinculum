# Vector Database & RAG Pipeline — Vinculum

This document defines the **authoritative Retrieval-Augmented Generation (RAG) system**. The vector database supports *scholarly memory and alignment-aware reasoning*. It is NOT a general-purpose semantic search engine.

All rules in this document are normative.

---

## 1\. Purpose

The vector system exists to:

- retrieve **previously anchored, user-curated material**  
- support **alignment-aware AI audit and explanation**  
- provide **long-term, citation-grade scholarly memory**

The vector DB never acts as an authority; it only **indexes references** to authoritative data.

---

## 2\. Vector DB Requirements

### Mandatory capabilities

- Dense vector similarity search  
- Metadata-based filtering  
- Deterministic query ordering  
- External persistence (out-of-process)

### Recommended implementation

- Qdrant (default)  
- Alternatives allowed if API-compatible

---

## 3\. Embedding Strategy

### Atomic embedding unit

The atomic unit is the **Vector Record** (see `05_DATA_SCHEMAS.md`).

Each vector corresponds to **exactly one anchor**.

### Permitted text sources

Only the following may be embedded:

- Anchor `quote`  
- Note `markdown`  
- Alignment text (source \+ target quote)

### Prohibited sources

- Full documents  
- Unanchored text  
- AI-generated text (unless explicitly reviewed and saved as a note)

---

## 4\. Chunking Rules

### Anchors

- One anchor \= one vector  
- No splitting  
- No overlap

### Notes

- Chunk only if \> 512 tokens  
- Overlap: 0  
- Each chunk inherits the same `anchorId`

### Alignments

- Text \= `source.quote + "\n---\n" + target.quote`  
- One alignment \= one vector

---

## 5\. Metadata Contract (Mandatory)

Each vector MUST include:

{

  "documentId": "uuid",

  "anchorId": "uuid",

  "noteId": "uuid | null",

  "alignmentId": "uuid | null",

  "type": "anchor | note | alignment"

}

### Hard rules

- Exactly one `anchorId`  
- `type` determines which other IDs may be non-null  
- No additional metadata keys allowed

---

## 6\. Indexing Pipeline

### Index-on-create

Vectors are created when:

- an anchor is created  
- a note is saved  
- an alignment is created

### Re-index triggers

- Note text changes  
- Embedding model version changes

### No re-index for

- UI-only edits  
- Metadata changes without text changes

### Pipeline steps

1. Validate entity against schema  
2. Extract canonical text  
3. Generate embedding  
4. Store vector \+ metadata  
5. Persist `embeddingModel` identifier

---

## 7\. Update & Deletion Semantics

### Anchors

- Never physically deleted  
- Vectors remain permanently indexed

### Notes

- Soft delete only  
- Deleted notes are excluded from retrieval but vectors remain

### Alignments

- Immutable  
- Deprecated alignments MAY be excluded via metadata filtering

**Rationale**: scholarly traceability outweighs storage efficiency.

---

## 8\. Similarity Search Parameters

### Defaults

- Distance metric: cosine  
- Top-k: ≤ 12  
- Minimum similarity threshold: enforced

### Ordering

1. Similarity score (descending)  
2. Timestamp (descending)

### Failure rule

If no vectors pass threshold → return empty result set.

---

## 9\. Retrieval Strategies

### Mode A — Contextual Recall

Used for answering questions about a document.

**Filter:**

- same `documentId`  
- OR aligned documents

### Mode B — Alignment Expansion

Used to deepen interpretation of a known alignment.

**Filter:**

- same `alignmentId`  
- OR same `anchorId`

### Mode C — Conversational Memory

Used during multi-turn AI interactions.

**Filter:**

- same user  
- recency bias  
- previously referenced anchors preferred

---

## 10\. Re-ranking Policy

### Default

- No learned re-ranking (v1)

### Deterministic adjustment

- Anchors \> notes \> alignments  
- Exact anchor matches boosted

### Prohibited

- LLM-based re-ranking  
- Query rewriting  
- Cross-document inference without alignment

---

## 11\. Integration with AI Audit Workflow

### Assembly rules

1. Retrieve vectors  
2. Resolve authoritative text (from storage)  
3. Sort deterministically  
4. Assemble input using AI Audit Input Contract

### Hard prohibitions

- Injecting vector text without anchor context  
- Summarizing or paraphrasing retrieved text pre-prompt  
- Mixing unaligned documents

---

## 12\. AI Output Grounding Rules

All AI output MUST:

- reference `anchorId`s explicitly  
- correspond to retrieved vectors  
- avoid generalizations beyond retrieved material

**If grounding is impossible → AI response MUST be empty.**

---

## 13\. Evaluation Metrics

### Quantitative

- Precision@k (anchor-level)  
- Recall@k (alignment-level)

### Qualitative

- Citation correctness  
- Anchor traceability  
- Hallucination rate (manual audit)

---

## 14\. Schema Stability

Changes to:

- metadata fields  
- chunking rules  
- retrieval modes  
- similarity parameters

**REQUIRE:**

- update to this document  
- entry in `09_DECISIONS.md`

---

## 15\. Non-Goals

- End-to-end document QA  
- Automatic summarization  
- Web search augmentation  
- Autonomous agents

