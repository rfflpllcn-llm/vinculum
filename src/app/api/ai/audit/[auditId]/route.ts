import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

/**
 * DELETE /api/ai/audit/[auditId]
 * Delete an audit session
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  try {
    const resolvedParams = await params;
    const auditId =
      typeof resolvedParams?.auditId === 'string'
        ? resolvedParams.auditId
        : null;

    // 1. Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Validate UUID
    const validationResult = uuidSchema.safeParse(auditId);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid audit ID format' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 3. Delete audit session with manual user_id check
    const { data, error } = await supabaseAdmin
      .from('audit_sessions')
      .delete()
      .eq('audit_id', validationResult.data)
      .eq('user_id', session.user.id)
      .select('audit_id'); // Ensure user owns this audit

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete audit session', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Audit session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting audit session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
