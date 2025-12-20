import { google } from "googleapis";
import { Document } from "@/types/schemas";

/**
 * Google Drive service for Vinculum
 * Conforms to Architecture specs (07_ARCHITECTURE.md)
 *
 * Storage structure:
 * /Vinculum_Data/
 *   /Books/ (PDFs, Markdown)
 *   /Metadata/ (anchors, notes, alignments)
 *   /Backups/
 */

const VINCULUM_FOLDER = "Vinculum_Data";
const BOOKS_FOLDER = "Books";
const METADATA_FOLDER = "Metadata";

export class DriveService {
  private drive;

  constructor(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: "v3", auth: oauth2Client });
  }

  /**
   * Ensure Vinculum folder structure exists
   */
  async ensureFolderStructure(): Promise<void> {
    const rootFolder = await this.findOrCreateFolder(VINCULUM_FOLDER);
    await this.findOrCreateFolder(BOOKS_FOLDER, rootFolder);
    await this.findOrCreateFolder(METADATA_FOLDER, rootFolder);
  }

  /**
   * Find or create a folder
   */
  private async findOrCreateFolder(
    name: string,
    parentId?: string
  ): Promise<string> {
    const query = parentId
      ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const response = await this.drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    // Create folder
    const fileMetadata: any = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };

    if (parentId) {
      fileMetadata.parents = [parentId];
    }

    const folder = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    return folder.data.id!;
  }

  /**
   * Resolve a metadata file path into a folder ID and filename.
   * Supports subfolders like "Cache/foo.json".
   */
  private async resolveMetadataPath(
    metadataPath: string,
    rootFolderId: string
  ): Promise<{ folderId: string; filename: string }> {
    const parts = metadataPath.split("/").filter(Boolean);
    const filename = parts.pop();
    if (!filename) {
      throw new Error("Invalid metadata path");
    }

    let folderId = await this.findOrCreateFolder(METADATA_FOLDER, rootFolderId);
    for (const segment of parts) {
      folderId = await this.findOrCreateFolder(segment, folderId);
    }

    return { folderId, filename };
  }

  /**
   * List documents from /Vinculum_Data/Books
   */
  async listDocuments(): Promise<Document[]> {
    const rootFolder = await this.findOrCreateFolder(VINCULUM_FOLDER);
    const booksFolder = await this.findOrCreateFolder(BOOKS_FOLDER, rootFolder);

    const response = await this.drive.files.list({
      q: `'${booksFolder}' in parents and trashed=false and (mimeType='application/pdf' or mimeType='text/markdown')`,
      fields:
        "files(id, name, mimeType, createdTime, modifiedTime, size)",
      spaces: "drive",
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files || [];

    return files.map((file) => ({
      documentId: "", // Will be generated when creating anchor
      driveFileId: file.id!,
      filename: file.name!,
      mimeType: file.mimeType as "application/pdf" | "text/markdown",
      pageCount: 0, // Will be determined when loading PDF
      createdAt: file.createdTime!,
      updatedAt: file.modifiedTime!,
    }));
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const response = await this.drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "arraybuffer" }
    );

    return response.data as ArrayBuffer;
  }

  /**
   * Upload or update a JSON metadata file
   */
  async saveMetadata(
    filename: string,
    content: any,
    mimeType: string = "application/json"
  ): Promise<string> {
    const rootFolder = await this.findOrCreateFolder(VINCULUM_FOLDER);
    const { folderId: metadataFolder, filename: baseFilename } =
      await this.resolveMetadataPath(filename, rootFolder);

    // Check if file exists
    const query = `name='${baseFilename}' and '${metadataFolder}' in parents and trashed=false`;
    const existing = await this.drive.files.list({
      q: query,
      fields: "files(id)",
      spaces: "drive",
    });

    const body = typeof content === "string"
      ? content
      : JSON.stringify(content, null, 2);

    const media = {
      mimeType,
      body,
    };

    if (existing.data.files && existing.data.files.length > 0) {
      // Update existing - don't include parents field
      const fileId = existing.data.files[0].id!;
      await this.drive.files.update({
        fileId,
        requestBody: {
          name: baseFilename,
          mimeType,
          // parents field not allowed in updates
        },
        media: media as any,
      });
      return fileId;
    } else {
      // Create new - include parents field
      const file = await this.drive.files.create({
        requestBody: {
          name: baseFilename,
          mimeType,
          parents: [metadataFolder],
        },
        media: media as any,
        fields: "id",
      });
      return file.data.id!;
    }
  }

  /**
   * Load JSON metadata file
   */
  async loadMetadata(filename: string): Promise<any | null> {
    const rootFolder = await this.findOrCreateFolder(VINCULUM_FOLDER);
    const { folderId: metadataFolder, filename: baseFilename } =
      await this.resolveMetadataPath(filename, rootFolder);

    const query = `name='${baseFilename}' and '${metadataFolder}' in parents and trashed=false`;
    const files = await this.drive.files.list({
      q: query,
      fields: "files(id)",
      spaces: "drive",
    });

    if (!files.data.files || files.data.files.length === 0) {
      return null;
    }

    const fileId = files.data.files[0].id!;
    const response = await this.drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "arraybuffer" }
    );

    const data = response.data;
    if (data == null) {
      return null;
    }

    let text: string | null = null;
    if (typeof data === "string") {
      text = data;
    } else if (data instanceof ArrayBuffer) {
      text = Buffer.from(data).toString("utf-8");
    } else if (Buffer.isBuffer(data)) {
      text = data.toString("utf-8");
    } else if (data instanceof Uint8Array) {
      text = Buffer.from(data).toString("utf-8");
    }

    if (text !== null) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return data;
  }

  /**
   * List metadata files matching a pattern
   * @param pattern - Filename pattern (e.g., "alignment_*")
   * @returns Array of filenames
   */
  async listMetadataFiles(pattern: string): Promise<string[]> {
    const rootFolder = await this.findOrCreateFolder(VINCULUM_FOLDER);
    const parts = pattern.split("/").filter(Boolean);
    const filenamePattern = parts.pop() || "";
    const { folderId: metadataFolder } = await this.resolveMetadataPath(
      parts.length > 0 ? `${parts.join("/")}/__placeholder__` : "__placeholder__",
      rootFolder
    );

    // Convert pattern to Google Drive query format
    // For now, support simple prefix matching
    const prefix = filenamePattern.replace('*', '');
    const query = `'${metadataFolder}' in parents and trashed=false and name contains '${prefix}'`;

    const response = await this.drive.files.list({
      q: query,
      fields: "files(name)",
      spaces: "drive",
      orderBy: "name",
    });

    return (response.data.files || []).map(file => file.name!);
  }
}
