export const AI_AUDIT_SYSTEM_PROMPT = `You are an expert translator and alignment analyst.
Your task is to audit text alignments between source and target documents.
Provide detailed analysis in markdown format.
When referencing specific anchors, use the format [anchor:anchorId].`;

export const AI_AUDIT_TASK_PROMPTS: Record<string, string> = {
  audit: [
    '# Alignment Audit Request',
    '',
    'Please audit the following text alignment and provide:',
    '1. Translation quality assessment',
    '2. Semantic accuracy',
    '3. Any discrepancies or issues',
    '4. Suggested improvements',
    '',
  ].join('\n'),
  explain: [
    '# Alignment Explanation Request',
    '',
    'Please explain the relationship between these aligned texts:',
    '',
  ].join('\n'),
  compare: [
    '# Alignment Comparison Request',
    '',
    'Please compare the following aligned texts:',
    '',
  ].join('\n'),
};

export function buildAlignmentAuditPrompt({
  srcLanguage,
  tgtLanguage,
  srcText,
  tgtText,
}: {
  srcLanguage: string;
  tgtLanguage: string;
  srcText: string;
  tgtText: string;
}): string {
  return `Analyze and align the translation against the original text.

CRITICAL INSTRUCTIONS:
1. **Find the alignment/intersection point**: Identify where the texts correspond to each other
2. **Segment ALL text**: Break down the ENTIRE provided text into aligned segments (not just significant parts)
3. **Maintain correspondence**: Each row must contain corresponding segments from the two versions
4. **Handle misalignments**: If texts don't align perfectly, note additions/omissions/reorderings

Output ONLY a Markdown table with these columns:
| Segment | ${srcLanguage} (Original) | ${tgtLanguage} | Alignment Notes |

Column descriptions:
- **Segment**: Segment number (1, 2, 3, ...)
- **${srcLanguage} (Original)**: The original text segment in ${srcLanguage}
- **${tgtLanguage}**: Corresponding translation in ${tgtLanguage}
- **Alignment Notes**: How translation align with original; note additions (+), omissions (-), reorderings, or semantic shifts

IMPORTANT:
- Cover the COMPLETE text from the two versions
- Start from the first identifiable correspondence point
- If one version has extra text, mark cells as "--" (double hyphen) for missing segments
- Be thorough and systematic

---

**Original (${srcLanguage}):**
${srcText}

**Translation 1 (${tgtLanguage}):**
${tgtText}`;
}

export function buildTripleAlignmentQualityAuditPrompt({
  orgLanguage,
  srcLanguage,
  tgtLanguage,
  orgText,
  srcText,
  tgtText,
}: {
  orgLanguage: string;
  srcLanguage: string;
  tgtLanguage: string;
  orgText: string;
  srcText: string;
  tgtText: string;
}): string {
  return `Analyze and align these translations against the original text.

CRITICAL INSTRUCTIONS:
1. **Find the alignment/intersection point**: Identify where the three texts correspond to each other
2. **Segment ALL text**: Break down the ENTIRE provided text into aligned segments (not just significant parts)
3. **Maintain correspondence**: Each row must contain corresponding segments from all three versions
4. **Handle misalignments**: If texts don't align perfectly, note additions/omissions/reorderings

Output ONLY a Markdown table with these columns:
| Segment | ${orgLanguage} (Original) | ${srcLanguage} | ${tgtLanguage} | ${orgLanguage} (Literal Gloss) | Alignment Notes |

Column descriptions:
- **Segment**: Segment number (1, 2, 3, ...)
- **${orgLanguage} (Original)**: The original text segment
- **${srcLanguage}**: Corresponding translation in ${srcLanguage}
- **${tgtLanguage}**: Corresponding translation in ${tgtLanguage}
- **${orgLanguage} (Literal Gloss)**: Word-for-word English translation showing exact meaning
- **Alignment Notes**: How translations align with original; note additions (+), omissions (-), reorderings, or semantic shifts

IMPORTANT:
- Cover the COMPLETE text from all three versions
- Start from the first identifiable correspondence point
- If one version has extra text, mark cells as "--" (double hyphen) for missing segments
- Be thorough and systematic

No introductory text, explanations, or comments outside the table.

---

**Original (${orgLanguage}):**
${orgText}

**Translation 1 (${srcLanguage}):**
${srcText}

**Translation 2 (${tgtLanguage}):**
${tgtText}`;
}

export function buildTripleTranslationAuditPrompt({
  orgLanguage,
  srcLanguage,
  tgtLanguage,
  orgText,
  srcText,
  tgtText,
}: {
  orgLanguage: string;
  srcLanguage: string;
  tgtLanguage: string;
  orgText: string;
  srcText: string;
  tgtText: string;
}): string {
  return `Analyze the QUALITY of the two translations with respect to the original text.

Your goal is NOT to judge alignment quality per se, but to use segmentation as a scaffold to audit translation decisions and their effects.

CORE EVALUATION CATEGORIES (use these labels in your notes):
1) Semantic Fidelity: meaning accuracy; ambiguities preserved/resolved/lost; omissions/additions
2) Lexical Choices: word/term selection; consistency of key terms; register/formality
3) Syntactic Handling: structure preservation vs adaptation; word order shifts; complex constructions
4) Stylistic Preservation: tone/voice; rhetorical devices; (if literary) rhythm/sound/imagery
5) Cultural & Pragmatic Transfer: idioms/metaphors/cultural refs; domestication vs foreignization; reader effect
6) Cohesion & Flow: discourse markers; coherence across segments; readability/naturalness

CRITICAL INSTRUCTIONS:
1. **Find the correspondence point**: Identify where the three texts refer to the same content so segmentation is comparable.
2. **Segment ALL text**: Break down the ENTIRE provided text into corresponding segments (not just highlights).
3. **One row = one unit of meaning**: Each row must contain the original segment and the corresponding segments in both translations.
4. **Audit, don’t just describe**: For each translation, explicitly flag gains/losses, shifts, and notable choices.
5. **Handle divergences explicitly**: If a translation adds/omits/reorders content, mark it clearly and evaluate its impact.
6. **Be concrete**: Prefer specific observations (“X weakens the metaphor / shifts agency / raises register”) over vague judgments.

Output ONLY a Markdown table with these columns:
| Segment | ${orgLanguage} (Original) | ${srcLanguage} | ${tgtLanguage} | ${orgLanguage} (Literal Gloss) | Translation Quality Notes | Mini Verdict |

Column descriptions:
- **Segment**: Segment number (1, 2, 3, ...)
- **${orgLanguage} (Original)**: The original text segment
- **${srcLanguage}**: Corresponding segment from translation 1
- **${tgtLanguage}**: Corresponding segment from translation 2
- **${orgLanguage} (Literal Gloss)**: Word-for-word English gloss of the ORIGINAL to anchor meaning comparisons
- **Translation Quality Notes**: Evaluate EACH translation vs the original using the category labels above.
  - Use a compact structure like:
    - T1: [Semantic Fidelity] ...; [Lexical] ...; [Syntax] ...; [Style] ...; [Cultural/Pragmatic] ...; [Cohesion/Flow] ...
    - T2: ...
  - Mark shifts explicitly: (+) added, (-) omitted, (≠) meaning shift, (↕) register shift, (≈) acceptable paraphrase
- **Mini Verdict**: A concise evaluative synthesis for THIS SEGMENT ONLY.
  - Format:
    - T1: Excellent / Good / Adequate / Weak / Problematic — brief reason
    - T2: Excellent / Good / Adequate / Weak / Problematic — brief reason
  - Base the verdict on overall impact on meaning, style, and reader effect, not on literalness alone.

IMPORTANT:
- Cover the COMPLETE text from all three versions
- Start from the first identifiable correspondence point
- If one version has extra text, mark missing cells as "--" (double hyphen) and reflect this in the verdict
- No introductory text, explanations, or comments outside the table

---

**Original (${orgLanguage}):**
${orgText}

**Translation 1 (${srcLanguage}):**
${srcText}

**Translation 2 (${tgtLanguage}):**
${tgtText}`;
}

export function buildSingleTranslationAuditPrompt({
  orgLanguage,
  translationLanguage,
  orgText,
  translationText,
}: {
  orgLanguage: string;
  translationLanguage: string;
  orgText: string;
  translationText: string;
}): string {
  return `Analyze the QUALITY of the translation with respect to the original text.

Your goal is NOT to judge alignment quality per se, but to use segmentation as a scaffold to audit translation decisions and their effects.

CORE EVALUATION CATEGORIES (use these labels in your notes):
1) Semantic Fidelity: meaning accuracy; ambiguities preserved/resolved/lost; omissions/additions
2) Lexical Choices: word/term selection; consistency of key terms; register/formality
3) Syntactic Handling: structure preservation vs adaptation; word order shifts; complex constructions
4) Stylistic Preservation: tone/voice; rhetorical devices; (if literary) rhythm/sound/imagery
5) Cultural & Pragmatic Transfer: idioms/metaphors/cultural refs; domestication vs foreignization; reader effect
6) Cohesion & Flow: discourse markers; coherence across segments; readability/naturalness

CRITICAL INSTRUCTIONS:
1. **Find the correspondence point**: Identify where the two texts refer to the same content so segmentation is comparable.
2. **Segment ALL text**: Break down the ENTIRE provided text into corresponding segments (not just highlights).
3. **One row = one unit of meaning**: Each row must contain the original segment and the corresponding translation segment.
4. **Audit, don't just describe**: Explicitly flag gains/losses, shifts, and notable choices.
5. **Handle divergences explicitly**: If the translation adds/omits/reorders content, mark it clearly and evaluate its impact.
6. **Be concrete**: Prefer specific observations ("X weakens the metaphor / shifts agency / raises register") over vague judgments.

Output ONLY a Markdown table with these columns:
| Segment | ${orgLanguage} (Original) | ${translationLanguage} | ${orgLanguage} (Literal Gloss) | Translation Quality Notes | Mini Verdict |

Column descriptions:
- **Segment**: Segment number (1, 2, 3, ...)
- **${orgLanguage} (Original)**: The original text segment
- **${translationLanguage}**: Corresponding segment from the translation
- **${orgLanguage} (Literal Gloss)**: Word-for-word English gloss of the ORIGINAL to anchor meaning comparisons
- **Translation Quality Notes**: Evaluate the translation vs the original using the category labels above.
  - Use a compact structure like:
    - [Semantic Fidelity] ...; [Lexical] ...; [Syntax] ...; [Style] ...; [Cultural/Pragmatic] ...; [Cohesion/Flow] ...
  - Mark shifts explicitly: (+) added, (-) omitted, (≠) meaning shift, (↕) register shift, (≈) acceptable paraphrase
- **Mini Verdict**: A concise evaluative synthesis for THIS SEGMENT ONLY.
  - Format: Excellent / Good / Adequate / Weak / Problematic - brief reason
  - Base the verdict on overall impact on meaning, style, and reader effect, not on literalness alone.

IMPORTANT:
- Cover the COMPLETE text from both versions
- Start from the first identifiable correspondence point
- If one version has extra text, mark missing cells as "--" (double hyphen) and reflect this in the verdict
- No introductory text, explanations, or comments outside the table

---

**Original (${orgLanguage}):**
${orgText}

**Translation (${translationLanguage}):**
${translationText}`;
}
