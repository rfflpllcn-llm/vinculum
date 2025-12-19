import OpenAI from 'openai';
import { AIAuditInput } from '@/types/schemas';
import { AI_AUDIT_SYSTEM_PROMPT, AI_AUDIT_TASK_PROMPTS } from '@/lib/aiPrompts';

/**
 * OpenAI Integration for AI Audit Feature
 * Requires OPENAI_API_KEY environment variable
 */

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Audit alignment using GPT-4
 * @param input - Anchors and notes to analyze
 * @returns Markdown-formatted audit result with anchor references
 */
export async function auditAlignment(input: AIAuditInput): Promise<string> {
  const openai = getOpenAIClient();

  // Build prompt from input
  const prompt = buildAuditPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: AI_AUDIT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content || '';
    return result;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Failed to audit alignment with AI');
  }
}

/**
 * Build prompt for AI audit from input data
 */
function buildAuditPrompt(input: AIAuditInput): string {
  const { task, anchors, notes } = input;

  let prompt = '';

  // Task description
  prompt += AI_AUDIT_TASK_PROMPTS[task] || AI_AUDIT_TASK_PROMPTS.audit;

  // Add anchors
  if (anchors.length > 0) {
    prompt += '## Aligned Text Segments\n\n';
    anchors.forEach((anchor, index) => {
      prompt += `### Anchor ${index + 1} [anchor:${anchor.anchorId}]\n`;
      prompt += `**Document ID**: ${anchor.documentId}\n`;
      prompt += `**Text**: ${anchor.quote}\n\n`;
    });
  }

  // Add notes
  if (notes.length > 0) {
    prompt += '## User Notes\n\n';
    notes.forEach((note, index) => {
      prompt += `### Note ${index + 1}\n`;
      prompt += `${note.markdown}\n\n`;
    });
  }

  return prompt;
}
