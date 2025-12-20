import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveService } from "@/lib/drive";
import { Anchor, CreateAnchor } from "@/types/schemas";
import { generateUUID, computeQuoteHash, getCurrentTimestamp } from "@/lib/utils";

/**
 * POST /api/anchors
 * Create a new anchor and persist to Google Drive
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateAnchor = await req.json();

    // Validate required fields
    if (!body.documentId || !body.quote || !body.rect) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create anchor with generated fields
    const anchor: Anchor = {
      anchorId: generateUUID(),
      documentId: body.documentId,
      page: body.page,
      rect: body.rect,
      quote: body.quote,
      quoteHash: computeQuoteHash(body.quote),
      createdAt: getCurrentTimestamp(),
    };

    // Persist to Drive
    const driveService = new DriveService(session.accessToken);
    const filename = `anchors_${anchor.documentId}.json`;
    const existingAnchors = await driveService.loadMetadata(filename);
    const anchorsArray = Array.isArray(existingAnchors)
      ? existingAnchors
      : [];
    anchorsArray.push(anchor);
    await driveService.saveMetadata(filename, anchorsArray);

    return NextResponse.json({ anchor });
  } catch (error) {
    console.error("Error creating anchor:", error);
    return NextResponse.json(
      { error: "Failed to create anchor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/anchors?documentId=...
 * Load all anchors for a document
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId required" },
        { status: 400 }
      );
    }

    // Load anchors from Drive
    const driveService = new DriveService(session.accessToken);
    const filename = `anchors_${documentId}.json`;
    const anchorsData = await driveService.loadMetadata(filename);

    // Return anchors or empty array if file doesn't exist
    const anchors: Anchor[] = anchorsData || [];

    return NextResponse.json({ anchors });
  } catch (error) {
    console.error("Error loading anchors:", error);
    return NextResponse.json(
      { error: "Failed to load anchors" },
      { status: 500 }
    );
  }
}
