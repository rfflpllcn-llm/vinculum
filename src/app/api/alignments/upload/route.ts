import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DriveService } from '@/lib/drive';
import { parseAlignmentFiles } from '@/lib/alignmentParser';
import * as pdfjsLib from 'pdfjs-dist';
import { UUID, Anchor, Alignment } from '@/types/schemas';

/**
 * POST /api/alignments/upload
 * Upload JSONL files and create anchors and alignments
 *
 * Expects FormData with:
 * - chunksFile: JSONL file with language chunks
 * - alignmentsFile: JSONL file with alignment pairs
 * - sourceDocId: UUID of source document
 * - targetDocId: UUID of target document
 * - sourceDriveFileId: Google Drive ID of source PDF
 * - targetDriveFileId: Google Drive ID of target PDF
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const chunksFile = formData.get('chunksFile') as File;
    const alignmentsFile = formData.get('alignmentsFile') as File;
    const sourceDocId = formData.get('sourceDocId') as UUID;
    const targetDocId = formData.get('targetDocId') as UUID;
    const sourceDriveFileId = formData.get('sourceDriveFileId') as string;
    const targetDriveFileId = formData.get('targetDriveFileId') as string;

    if (!chunksFile || !alignmentsFile || !sourceDocId || !targetDocId || !sourceDriveFileId || !targetDriveFileId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Processing alignment upload...');
    console.log('Source doc:', sourceDocId, 'Target doc:', targetDocId);

    // Initialize Drive service
    const drive = new DriveService(session.accessToken);

    // Download PDFs from Drive
    console.log('Downloading PDFs...');
    const sourceBuffer = await drive.downloadFile(sourceDriveFileId);
    const targetBuffer = await drive.downloadFile(targetDriveFileId);

    // Load PDFs with pdfjs
    const sourcePDF = await pdfjsLib.getDocument({ data: sourceBuffer }).promise;
    const targetPDF = await pdfjsLib.getDocument({ data: targetBuffer }).promise;

    console.log('PDFs loaded. Parsing alignment files...');

    // Parse alignment files
    const parsed = await parseAlignmentFiles(
      chunksFile,
      alignmentsFile,
      sourceDocId,
      targetDocId,
      sourcePDF,
      targetPDF
    );

    console.log(`Parsed: ${parsed.sourceAnchors.length} source anchors, ${parsed.targetAnchors.length} target anchors, ${parsed.alignments.length} alignments`);

    // Save anchors to Drive
    const allAnchors = [...parsed.sourceAnchors, ...parsed.targetAnchors];

    // Group anchors by document
    const anchorsByDoc = new Map<UUID, Anchor[]>();
    for (const anchor of allAnchors) {
      if (!anchorsByDoc.has(anchor.documentId)) {
        anchorsByDoc.set(anchor.documentId, []);
      }
      anchorsByDoc.get(anchor.documentId)!.push(anchor);
    }

    // Save anchors for each document
    for (const [docId, anchors] of anchorsByDoc.entries()) {
      const filename = `anchors_${docId}.json`;
      await drive.saveMetadata(filename, anchors);
      console.log(`Saved ${anchors.length} anchors to ${filename}`);
    }

    // Save alignments
    const alignmentFilename = `alignment_${sourceDocId}_${targetDocId}.json`;
    await drive.saveMetadata(alignmentFilename, parsed.alignments);
    console.log(`Saved ${parsed.alignments.length} alignments to ${alignmentFilename}`);

    return NextResponse.json({
      success: true,
      sourceAnchorsCount: parsed.sourceAnchors.length,
      targetAnchorsCount: parsed.targetAnchors.length,
      alignmentsCount: parsed.alignments.length,
    });
  } catch (error) {
    console.error('Error uploading alignments:', error);
    return NextResponse.json(
      { error: 'Failed to upload alignments', details: String(error) },
      { status: 500 }
    );
  }
}