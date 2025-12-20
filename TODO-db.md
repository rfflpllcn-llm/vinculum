# AI Alignment Audit App - Database Integration Use Cases

## Primary Use Case
User prepares prompt with AI Alignment Audit → executes in GPT → receives markdown tables of comparison → includes table at corresponding point in text (single view)

---

## Proposed Additional Use Cases

### 1. Audit History & Comparison Archive 📚

**Use Case:** Store all AI-generated audit results with full provenance tracking

**Workflow:**
1. User generates audit prompt → executes in GPT → receives markdown table
2. User pastes result back into app → system saves to database
3. Database stores:
   - Original prompt + GPT response (markdown tables)
   - Alignment context (which segments were compared)
   - Timestamp, GPT model used, user notes
   - Link to specific alignment_id + document versions

**Value with Vector DB:**
- Semantic retrieval: "Show me all past audits about metaphorical language"
- Pattern detection: "Which translation choices have been flagged most often?"
- Versioning: Compare how GPT-4 vs GPT-4.5 analyzed the same alignment

**Database Schema:**
```sql
CREATE TABLE audit_sessions (
  session_id UUID PRIMARY KEY,
  alignment_id UUID,
  prompt_text TEXT,
  gpt_response TEXT, -- markdown tables
  gpt_model TEXT,    -- e.g., "gpt-4-turbo"
  created_at TIMESTAMP
);
```

**Vector DB Entry:**
```json
{
  "text": "[concatenated GPT analysis text]",
  "metadata": {
    "session_id": "uuid",
    "alignment_id": "uuid",
    "analysis_type": "literal_gloss",
    "languages": ["it", "en", "de"]
  }
}
```

---

### 2. Collaborative Translation Commentary 👥

**Use Case:** Multiple scholars annotate the same text with AI audit insights

**Workflow:**
1. Scholar A audits Canto 1, verse 1-3 → saves GPT analysis
2. Scholar B views same alignment → sees A's audit + adds their own
3. System shows conversation thread of multiple AI audits
4. Vector search: "Show other scholars' notes on similar passages"

**Database Tables:**
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  name TEXT,
  institution TEXT
);

CREATE TABLE audit_comments (
  comment_id UUID PRIMARY KEY,
  audit_session_id UUID,
  user_id UUID,
  comment_text TEXT,
  created_at TIMESTAMP
);
```

**Value:**
- Build collaborative scholarly knowledge base
- Track consensus vs. divergent interpretations
- Export as citation-ready footnotes

---

### 3. Translation Quality Dashboard 📊

**Use Case:** Aggregate AI audit results to identify systematic translation patterns

**Workflow:**
1. User completes 50+ AI audits for a translation
2. System analyzes stored audits → generates dashboard metrics:
   - Most frequent "additions/omissions" by translator
   - Sections with lowest alignment confidence
   - GPT-identified translation strategies (literal vs. interpretive)
3. Export report for academic publication

**Vector DB Aggregation:**
- Cluster similar audit findings (e.g., all instances where translator added clarifying words)
- Identify outlier alignments (low confidence + negative GPT assessment)

**UI Component:**
```jsx
<TranslationQualityDashboard
  documentId="dante_inferno"
  metrics={{
    totalAudits: 127,
    avgConfidence: 0.82,
    commonPatterns: [
      { type: "addition", count: 23, examples: [...] },
      { type: "reordering", count: 45, examples: [...] }
    ]
  }}
/>
```

---

### 4. Cross-Document Reference Network 🔗

**Use Case:** Link related passages across different documents via audit insights

**Workflow:**
1. User audits Inferno Canto 1 → GPT mentions thematic similarity to Purgatorio Canto 9
2. User clicks "Create cross-reference" → system links the two alignments
3. Database stores relationship + GPT's explanation
4. Vector search enables: "Find all passages discussing 'journey' motifs"

**Database Schema:**
```sql
CREATE TABLE cross_references (
  ref_id UUID PRIMARY KEY,
  source_alignment_id UUID,
  target_alignment_id UUID,
  relationship_type TEXT, -- "thematic", "linguistic", "intertextual"
  ai_justification TEXT,  -- GPT's explanation
  created_at TIMESTAMP
);
```

**Vector DB Search:**
- Embed GPT's justification text
- Search: "passages with light/dark imagery" → returns linked alignments

---

### 5. Automated Audit Suggestion Pipeline 🤖

**Use Case:** System proactively suggests which alignments need auditing

**Workflow:**
1. User uploads new translation (100 pages)
2. System analyzes all alignments → ranks by "audit worthiness":
   - Low confidence scores
   - Complex multi-chunk alignments (N-N)
   - Semantically distant (via vector similarity of src vs tgt embeddings)
3. User sees prioritized audit queue
4. Completed audits update ranking algorithm

**Database Table:**
```sql
CREATE TABLE audit_queue (
  queue_id UUID PRIMARY KEY,
  alignment_id UUID,
  priority_score FLOAT,
  reasons JSONB, -- ["low_confidence", "complex_structure"]
  audit_status TEXT, -- "pending", "in_progress", "completed"
  assigned_to UUID  -- user_id
);
```

**Vector DB Role:**
- Embed all src_text and tgt_text separately
- Compare embeddings → flag large semantic distances
- Store "semantic distance" as metadata for prioritization

---

### 6. Prompt Template Library 📝

**Use Case:** Save and share effective audit prompt templates

**Workflow:**
1. User refines AI audit prompt for specific analysis (e.g., "focus on meter preservation")
2. User saves as template with parameters
3. Other users browse template library, filter by language pair or analysis type
4. Templates include success rate (% of times user accepted GPT's analysis)

**Database Schema:**
```sql
CREATE TABLE prompt_templates (
  template_id UUID PRIMARY KEY,
  name TEXT,
  prompt_text TEXT,
  parameters JSONB, -- {"context_rows": 3, "focus": "meter"}
  language_pairs TEXT[], -- ["it-en", "it-de"]
  success_rate FLOAT,
  usage_count INT,
  created_by UUID
);
```

**Vector DB Search:**
- Embed template prompt_text
- Search: "templates for analyzing poetic meter" → returns relevant templates

---

### 7. Batch Audit Processing ⚙️

**Use Case:** Queue multiple alignments for AI audit, track progress

**Workflow:**
1. User selects 20 alignments → clicks "Batch Audit"
2. System generates 20 prompts → user pastes into GPT API (or manual processing)
3. User uploads GPT responses as JSONL file
4. System parses responses → attaches to respective alignments
5. Database tracks batch job progress

**Database Table:**
```sql
CREATE TABLE batch_audit_jobs (
  job_id UUID PRIMARY KEY,
  alignment_ids UUID[],
  status TEXT, -- "pending", "in_progress", "completed"
  results JSONB,
  created_at TIMESTAMP
);
```

**Value:**
- Efficient for large-scale translation audits
- Progress tracking across sessions
- Export all results as single research dataset

---

### 8. Contextual Embedding Search 🎯

**Use Case:** Search not just for text, but for audit insights and patterns

**Workflow:**
1. User searches: "Where did the translator struggle with subjunctive mood?"
2. Vector DB searches:
   - Stored audit results (GPT's analysis text)
   - User notes on alignments
   - Cross-reference justifications
3. Returns alignments where GPT flagged grammatical challenges

**Vector DB Schema:**
```json
{
  "vectorId": "uuid",
  "text": "[GPT analysis excerpt]",
  "metadata": {
    "type": "audit_result",
    "alignment_id": "uuid",
    "finding_type": "grammatical_issue",
    "severity": "high"
  }
}
```

**Advanced Query:**
- Multi-vector search (combine chunk text + audit analysis)
- Filter by: language, cantica, translator, time period

---

## Implementation Priority Ranking

Based on primary use case and existing architecture:

| # | Use Case | Impact | Complexity | Priority |
|---|----------|--------|------------|----------|
| 1 | Audit History & Archive | High | Low | 🟢 High |
| 3 | Translation Quality Dashboard | High | Medium | 🟢 High |
| 8 | Contextual Embedding Search | High | Medium | 🟢 High |
| 5 | Automated Audit Suggestion | Medium | Medium | 🟡 Medium |
| 6 | Prompt Template Library | Medium | Low | 🟡 Medium |
| 2 | Collaborative Commentary | Medium | High | 🟡 Medium |
| 7 | Batch Audit Processing | Low | Low | 🔴 Low |
| 4 | Cross-Document References | Low | High | 🔴 Low |

---

## Quick Start: Minimal Viable Database Integration

### Phase 1: Audit History Storage (PostgreSQL)
- Add `audit_sessions` table
- Store prompt + GPT response when user pastes results
- Enable "View Past Audits" panel in UI

### Phase 2: Semantic Search (Qdrant)
- Embed all audit responses
- Add search bar: "Find audits mentioning [concept]"
- Boost user workflow efficiency by 10x

### Phase 3: Quality Dashboard
- Aggregate stored audits
- Generate translation quality metrics
- Export as academic reports