import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

// Validation schema
const saveAuditSchema = z.object({
  alignmentId: z.string().uuid().nullable(),
  taskName: z.string().max(200).nullable().optional(),
  promptText: z.string().min(1).max(50000),
  gptResponse: z.string().min(1).max(100000), // 100KB limit
  gptModel: z.string().default('gpt-4'),
  taskType: z.enum(['audit', 'explain', 'compare']),
  sourceText: z.string().min(1).max(50000),
  targetText: z.string().min(1).max(50000),
  originalText: z.string().max(50000).nullable(),
  sourceLanguage: z.string().nullable(),
  targetLanguage: z.string().nullable(),
  originalLanguage: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - user ID or email missing' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const validationResult = saveAuditSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const supabaseAdmin = getSupabaseAdmin();

    // 3. Insert audit session into Supabase (server-only, no RLS)
    const { data: insertedData, error } = await supabaseAdmin
      .from('audit_sessions')
      .insert({
        user_id: session.user.id, // Stable ID
        user_email: session.user.email, // Metadata only
        alignment_id: data.alignmentId,
        task_name: data.taskName?.trim() || null,
        prompt_text: data.promptText,
        gpt_response: data.gptResponse,
        gpt_model: data.gptModel,
        task_type: data.taskType,
        source_text: data.sourceText,
        target_text: data.targetText,
        original_text: data.originalText,
        source_language: data.sourceLanguage,
        target_language: data.targetLanguage,
        original_language: data.originalLanguage,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save audit session', details: error.message },
        { status: 500 }
      );
    }

    // 4. Transform to camelCase
    const audit = {
      auditId: insertedData.audit_id,
      userId: insertedData.user_id,
      userEmail: insertedData.user_email,
      alignmentId: insertedData.alignment_id,
      taskName: insertedData.task_name ?? null,
      promptText: insertedData.prompt_text,
      gptResponse: insertedData.gpt_response,
      gptModel: insertedData.gpt_model || 'gpt-4',
      taskType: insertedData.task_type as 'audit' | 'explain' | 'compare',
      sourceText: insertedData.source_text,
      targetText: insertedData.target_text,
      originalText: insertedData.original_text,
      sourceLanguage: insertedData.source_language,
      targetLanguage: insertedData.target_language,
      originalLanguage: insertedData.original_language,
      createdAt: insertedData.created_at,
      updatedAt: insertedData.updated_at,
    };

    return NextResponse.json({ audit });
  } catch (error) {
    console.error('Error saving audit session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
