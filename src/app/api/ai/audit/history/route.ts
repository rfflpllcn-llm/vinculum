import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/ai/audit/history
 * Fetch audit history for the current user
 * Query params: alignmentId (optional), limit (default: 50), offset (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse query parameters with validation
    const { searchParams } = new URL(req.url);
    const alignmentId = searchParams.get('alignmentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Max 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // 3. Build query with manual user_id filtering
    let query = supabaseAdmin
      .from('audit_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id) // Manual filtering by stable user ID
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by alignment if provided
    if (alignmentId) {
      query = query.eq('alignment_id', alignmentId);
    }

    // 4. Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit history', details: error.message },
        { status: 500 }
      );
    }

    // 5. Transform to camelCase
    const audits = (data || []).map((row) => ({
      auditId: row.audit_id,
      userId: row.user_id,
      userEmail: row.user_email,
      alignmentId: row.alignment_id,
      taskName: row.task_name ?? null,
      promptText: row.prompt_text,
      gptResponse: row.gpt_response,
      gptModel: row.gpt_model || 'gpt-4',
      taskType: row.task_type as 'audit' | 'explain' | 'compare',
      sourceText: row.source_text,
      targetText: row.target_text,
      originalText: row.original_text,
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      originalLanguage: row.original_language,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      audits,
      total: count || 0,
    });
  } catch (error) {
    console.error('Error fetching audit history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
