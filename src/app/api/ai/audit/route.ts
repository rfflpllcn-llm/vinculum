import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditAlignment } from '@/lib/openai';
import { AIAuditInput } from '@/types/schemas';

/**
 * POST /api/ai/audit
 * Audit alignment using OpenAI GPT-4
 *
 * Request body:
 * - task: "audit" | "explain" | "compare"
 * - anchors: Array of { anchorId, quote, documentId }
 * - notes: Array of { noteId, markdown }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const input: AIAuditInput = {
      task: body.task || 'audit',
      anchors: body.anchors || [],
      notes: body.notes || [],
    };

    // Validate input
    if (input.anchors.length === 0) {
      return NextResponse.json(
        { error: 'At least one anchor is required' },
        { status: 400 }
      );
    }

    console.log(`AI audit request: ${input.task}, ${input.anchors.length} anchors`);

    // Call OpenAI
    const result = await auditAlignment(input);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error in AI audit:', error);
    return NextResponse.json(
      { error: 'Failed to audit alignment', details: String(error) },
      { status: 500 }
    );
  }
}