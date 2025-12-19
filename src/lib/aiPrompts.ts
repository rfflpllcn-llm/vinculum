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

export function buildTripleAlignmentAuditPrompt({
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
