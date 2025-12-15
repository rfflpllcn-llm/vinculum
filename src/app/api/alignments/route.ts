import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DriveService } from '@/lib/drive';
import { Alignment, UUID } from '@/types/schemas';

/**
 * GET /api/alignments?sourceDocId=X&targetDocId=Y
 * List alignments for a document pair
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const sourceDocId = searchParams.get('sourceDocId') as UUID | null;
    const targetDocId = searchParams.get('targetDocId') as UUID | null;

    if (!sourceDocId || !targetDocId) {
      return NextResponse.json(
        { error: 'Missing sourceDocId or targetDocId' },
        { status: 400 }
      );
    }

    // Initialize Drive service
    const drive = new DriveService(session.accessToken);

    // Look for alignment file
    const filename = `alignment_${sourceDocId}_${targetDocId}.json`;
    const alignments = await drive.loadMetadata(filename);

    if (!alignments) {
      return NextResponse.json({ alignments: [] });
    }

    return NextResponse.json({ alignments: alignments as Alignment[] });
  } catch (error) {
    console.error('Error loading alignments:', error);
    return NextResponse.json(
      { error: 'Failed to load alignments', details: String(error) },
      { status: 500 }
    );
  }
}