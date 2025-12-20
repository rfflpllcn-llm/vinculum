import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveService } from "@/lib/drive";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUUID } from "@/lib/utils";
import { Document } from "@/types/schemas";

/**
 * GET /api/documents
 * List all documents from Google Drive /Vinculum_Data/Books
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const driveService = new DriveService(session.accessToken);
    await driveService.ensureFolderStructure();
    const driveDocuments = await driveService.listDocuments();

    if (driveDocuments.length === 0) {
      return NextResponse.json({ documents: [] });
    }

    const driveFileIds = driveDocuments.map((doc) => doc.driveFileId);
    const { data: existingDocs, error: existingError } = await supabaseAdmin
      .from("documents")
      .select("document_id, drive_file_id")
      .in("drive_file_id", driveFileIds);

    if (existingError) {
      console.error("Supabase documents query error:", existingError);
      return NextResponse.json(
        { error: "Failed to load documents" },
        { status: 500 }
      );
    }

    const existingByDriveId = new Map(
      (existingDocs || []).map((row) => [row.drive_file_id, row.document_id])
    );

    const upsertPayload = driveDocuments.map((doc) => ({
      document_id: existingByDriveId.get(doc.driveFileId) || generateUUID(),
      drive_file_id: doc.driveFileId,
      filename: doc.filename,
      mime_type: doc.mimeType,
      page_count: doc.pageCount,
    }));

    const { data: upsertedDocs, error: upsertError } = await supabaseAdmin
      .from("documents")
      .upsert(upsertPayload, { onConflict: "drive_file_id" })
      .select();

    if (upsertError) {
      console.error("Supabase documents upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save documents" },
        { status: 500 }
      );
    }

    const responseDocuments: Document[] = (upsertedDocs || []).map((row) => ({
      documentId: row.document_id,
      driveFileId: row.drive_file_id,
      filename: row.filename,
      mimeType: row.mime_type as Document["mimeType"],
      pageCount: row.page_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ documents: responseDocuments });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
