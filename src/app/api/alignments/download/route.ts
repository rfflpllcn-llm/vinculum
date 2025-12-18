import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveService } from "@/lib/drive";

/**
 * GET /api/alignments/download?fileId=xxx&filename=chunks.jsonl
 * Download JSONL files (chunks or alignments) from Google Drive
 *
 * Query params:
 * - fileId: Google Drive file ID
 * - filename: Optional filename for download (e.g., "chunks.jsonl", "en-it.jsonl")
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const fileId = searchParams.get("fileId");
    const filename = searchParams.get("filename") || "download.jsonl";

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId parameter required" },
        { status: 400 }
      );
    }

    // Download file from Drive
    const driveService = new DriveService(session.accessToken);
    const fileData = await driveService.downloadFile(fileId);

    // Return with correct MIME type and download headers
    return new NextResponse(fileData, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error downloading JSONL file:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}