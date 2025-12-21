import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveService } from "@/lib/drive";
import { Note, UUID } from "@/types/schemas";
import { generateUUID, getCurrentTimestamp } from "@/lib/utils";

/**
 * GET /api/notes?documentId=...&anchorId=...
 * Load notes for a document (optionally filter by anchorId).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId") as UUID | null;
    const anchorId = searchParams.get("anchorId") as UUID | null;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId required" },
        { status: 400 }
      );
    }

    const driveService = new DriveService(session.accessToken);
    const filename = `notes_${documentId}.json`;
    const notesData = await driveService.loadMetadata(filename);
    const notes: Note[] = Array.isArray(notesData) ? notesData : [];

    if (anchorId) {
      const note = notes.find((item) => item.anchorId === anchorId && !item.deleted) || null;
      return NextResponse.json({ note });
    }

    return NextResponse.json({ notes: notes.filter((item) => !item.deleted) });
  } catch (error) {
    console.error("Error loading notes:", error);
    return NextResponse.json(
      { error: "Failed to load notes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes
 * Create or update a note for an anchor.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const documentId = body.documentId as UUID | undefined;
    const anchorId = body.anchorId as UUID | undefined;
    const markdown = body.markdown as string | undefined;
    const tags = Array.isArray(body.tags) ? body.tags : [];

    if (!documentId || !anchorId || typeof markdown !== "string") {
      return NextResponse.json(
        { error: "documentId, anchorId, and markdown are required" },
        { status: 400 }
      );
    }

    const driveService = new DriveService(session.accessToken);
    const filename = `notes_${documentId}.json`;
    const existingData = await driveService.loadMetadata(filename);
    const notes: Note[] = Array.isArray(existingData) ? existingData : [];
    const timestamp = getCurrentTimestamp();

    const nextNotes = notes.filter((note) => note.anchorId !== anchorId);
    const existing = notes.find((note) => note.anchorId === anchorId && !note.deleted);

    if (existing) {
      nextNotes.push({
        ...existing,
        markdown,
        tags,
        updatedAt: timestamp,
        deleted: false,
      });
    } else {
      nextNotes.push({
        noteId: generateUUID(),
        anchorId,
        markdown,
        tags,
        createdAt: timestamp,
        updatedAt: timestamp,
        deleted: false,
      });
    }

    await driveService.saveMetadata(filename, nextNotes);

    const savedNote = nextNotes.find((note) => note.anchorId === anchorId && !note.deleted) || null;
    return NextResponse.json({ note: savedNote });
  } catch (error) {
    console.error("Error saving note:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes
 * Soft-delete a note for an anchor.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const documentId = body.documentId as UUID | undefined;
    const anchorId = body.anchorId as UUID | undefined;

    if (!documentId || !anchorId) {
      return NextResponse.json(
        { error: "documentId and anchorId are required" },
        { status: 400 }
      );
    }

    const driveService = new DriveService(session.accessToken);
    const notesFilename = `notes_${documentId}.json`;
    const existingData = await driveService.loadMetadata(notesFilename);
    const notes: Note[] = Array.isArray(existingData) ? existingData : [];
    const timestamp = getCurrentTimestamp();

    const matches = notes.filter((note) => note.anchorId === anchorId);
    if (matches.length === 0) {
      return NextResponse.json({ note: null });
    }

    const nextNotes = notes.map((note) =>
      note.anchorId === anchorId
        ? { ...note, deleted: true, updatedAt: timestamp }
        : note
    );

    await driveService.saveMetadata(notesFilename, nextNotes);

    const deletedNote = nextNotes.find((note) => note.anchorId === anchorId) || null;

    return NextResponse.json({ note: deletedNote });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
