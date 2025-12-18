/**
 * API Route: POST /api/alignments/generate
 * Generates JSONL files from PDF uploads using Python pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveService } from "@/lib/drive";
import {
  hashFileContent,
  checkCache,
  saveToCache,
  downloadCachedFile,
} from "@/lib/jsonlCache";
import { createTask, updateTask } from "@/lib/taskManager";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const pdfSource = (formData.get("pdfSource") as string) || "upload";
    const textField = (formData.get("textField") as string) || "text";
    const metadataFieldsStr = (formData.get("metadataFields") as string) || "chunk_id,language,page";
    const runAlignment = formData.get("runAlignment") !== "false";
    const maxAlign = parseInt(formData.get("maxAlign") as string) || 3;
    const keepAllAlignments = formData.get("keepAllAlignments") === "true";

    const metadataFields = metadataFieldsStr.split(",").map((f) => f.trim());

    // Initialize Drive service
    const drive = new DriveService(session.accessToken);

    // Read PDF files and compute hashes
    const pdfHashes: Record<string, string> = {};
    const tempPdfPaths: Record<string, string> = {};

    if (pdfSource === "drive") {
      // Download PDFs from Google Drive
      const pdfDocIdsJson = formData.get("pdfDocIds") as string;
      if (!pdfDocIdsJson) {
        return NextResponse.json(
          { error: "PDF document IDs required for Drive source" },
          { status: 400 }
        );
      }

      let pdfDocIds: Record<string, string>;
      try {
        pdfDocIds = JSON.parse(pdfDocIdsJson);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid pdfDocIds JSON" },
          { status: 400 }
        );
      }

      for (const [lang, driveFileId] of Object.entries(pdfDocIds)) {
        // Download PDF from Drive
        const arrayBuffer = await drive.downloadFile(driveFileId);
        const hash = hashFileContent(arrayBuffer);
        pdfHashes[lang] = hash;

        // Save to temp file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
        const tempPath = path.join(tempDir, `${lang}.pdf`);
        await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
        tempPdfPaths[lang] = tempPath;
      }
    } else {
      // Upload from computer
      const pdfFilesJson = formData.get("pdfFiles") as string;
      if (!pdfFilesJson) {
        return NextResponse.json(
          { error: "PDF files configuration required" },
          { status: 400 }
        );
      }

      let pdfFilesConfig: Record<string, string>;
      try {
        pdfFilesConfig = JSON.parse(pdfFilesJson);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid pdfFiles JSON" },
          { status: 400 }
        );
      }

      for (const [lang, fieldName] of Object.entries(pdfFilesConfig)) {
        const pdfFile = formData.get(fieldName) as File;
        if (!pdfFile) {
          return NextResponse.json(
            { error: `PDF file for language ${lang} not found` },
            { status: 400 }
          );
        }

        // Read file and compute hash
        const arrayBuffer = await pdfFile.arrayBuffer();
        const hash = hashFileContent(arrayBuffer);
        pdfHashes[lang] = hash;

        // Save to temp file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
        const tempPath = path.join(tempDir, `${lang}.pdf`);
        await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
        tempPdfPaths[lang] = tempPath;
      }
    }

    // Check cache
    let cached = await checkCache(drive, pdfHashes, textField, metadataFields);

    // If alignment generation is requested but cached alignments are missing,
    // invalidate the cache to ensure consistent regeneration
    if (cached && runAlignment && (!cached.alignments || cached.alignments.length === 0)) {
      console.log('Cache found but alignments missing - will regenerate everything');
      cached = null; // Treat cache as invalid
    }

    if (cached) {
      // Return cached results immediately
      // Clean up temp files
      for (const tempPath of Object.values(tempPdfPaths)) {
        const tempDir = path.dirname(tempPath);
        await fs.rm(tempDir, { recursive: true, force: true });
      }

      return NextResponse.json({
        cached: true,
        chunks: {
          driveFileId: cached.chunks!.driveFileId,
          count: cached.chunks!.count,
        },
        alignments: cached.alignments,
      });
    }

    // Create task for tracking
    const task = createTask();

    // Start background generation
    generateInBackground(
      task.taskId,
      tempPdfPaths,
      textField,
      metadataFields,
      runAlignment,
      maxAlign,
      keepAllAlignments,
      pdfHashes,
      session.accessToken
    );

    // Return task ID for polling
    return NextResponse.json({
      cached: false,
      taskId: task.taskId,
      status: task.status,
    });
  } catch (error) {
    console.error("Error in generate route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Run Python pipeline in background
 */
async function generateInBackground(
  taskId: string,
  pdfPaths: Record<string, string>,
  textField: string,
  metadataFields: string[],
  runAlignment: boolean,
  maxAlign: number,
  keepAllAlignments: boolean,
  pdfHashes: Record<string, string>,
  accessToken: string
) {
  try {
    updateTask(taskId, {
      status: "running",
      progress: 10,
      message: "Starting PDF processing...",
    });

    // Create output directory
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "jsonl-"));

    // Prepare Python script arguments
    const pythonScript = path.join(process.cwd(), "python", "wrapper.py");
    const args = [
      pythonScript,
      "--pdf-files",
      JSON.stringify(pdfPaths),
      "--output-dir",
      outputDir,
      "--text-field",
      textField,
      "--metadata-fields",
      metadataFields.join(","),
      "--max-align",
      maxAlign.toString(),
    ];

    if (!runAlignment) {
      args.push("--no-alignment");
    }

    if (keepAllAlignments) {
      args.push("--keep-all-alignments");
    }

    updateTask(taskId, {
      progress: 20,
      message: "Running Python pipeline...",
    });

    // Run Python script
    const result = await runPythonScript("python3", args);

    if (!result.success) {
      console.error('Python script failed:', result.error);
      console.error('Python stdout:', result.stdout);
      throw new Error(result.error || "Python script failed");
    }

    // Log Python output for debugging
    if (result.stdout) {
      console.log('Python stdout:', result.stdout.substring(0, 500));
    }

    updateTask(taskId, {
      progress: 80,
      message: "Saving to cache...",
    });

    // Parse result - extract JSON from stdout (may have other output)
    let output;
    try {
      const stdoutTrimmed = result.stdout.trim();
      const jsonStr = extractLastJson(stdoutTrimmed);
      output = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Python output:', result.stdout);
      console.error('Parse error:', parseError);
      throw new Error(`Failed to parse Python output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    if (!output.success) {
      throw new Error(output.error || "Generation failed");
    }

    // Read generated files
    const chunksPath = path.join(outputDir, "chunks.jsonl");
    const chunksContent = await fs.readFile(chunksPath, "utf-8");
    const chunksCount = chunksContent.split("\n").filter((l) => l.trim()).length;

    const alignmentFiles = [];
    const alignmentFilenames = Object.keys(output.output_files.alignments || {});

    for (const filename of alignmentFilenames) {
      const alignmentPath = path.join(outputDir, filename);
      const content = await fs.readFile(alignmentPath, "utf-8");
      const [sourceLang, targetLang] = filename.replace(".jsonl", "").split("-");
      const count = content.split("\n").filter((l) => l.trim()).length;

      alignmentFiles.push({
        content,
        sourceLang,
        targetLang,
        count,
      });
    }

    // Save to cache
    const drive = new DriveService(accessToken);
    const cached = await saveToCache(
      drive,
      pdfHashes,
      { content: chunksContent, count: chunksCount },
      alignmentFiles,
      textField,
      metadataFields
    );

    updateTask(taskId, {
      status: "completed",
      progress: 100,
      message: "Generation completed successfully",
      result: {
        chunks: {
          path: cached.chunks!.driveFileId,
          count: cached.chunks!.count,
        },
        alignments: cached.alignments.reduce(
          (acc, a) => ({
            ...acc,
            [`${a.sourceLang}-${a.targetLang}`]: {
              path: a.driveFileId,
              count: a.count,
            },
          }),
          {}
        ),
      },
    });

    // Clean up temp files
    await fs.rm(outputDir, { recursive: true, force: true });
    for (const tempPath of Object.values(pdfPaths)) {
      const tempDir = path.dirname(tempPath);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Background generation error:", error);
    updateTask(taskId, {
      status: "failed",
      progress: 0,
      message: "Generation failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Clean up on error
    try {
      for (const tempPath of Object.values(pdfPaths)) {
        const tempDir = path.dirname(tempPath);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}

function extractLastJson(stdout: string): string {
  const end = stdout.lastIndexOf("}");
  if (end === -1) {
    throw new Error("No JSON object found in Python output");
  }

  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const ch = stdout[i];
    if (ch === "}") {
      depth += 1;
    } else if (ch === "{") {
      depth -= 1;
      if (depth === 0) {
        return stdout.slice(i, end + 1);
      }
    }
  }

  throw new Error("No complete JSON object found in Python output");
}

/**
 * Run Python script and return result
 */
function runPythonScript(
  command: string,
  args: string[]
): Promise<{ success: boolean; stdout: string; error?: string }> {
  return new Promise((resolve) => {
    const process = spawn(command, args);
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, stdout });
      } else {
        resolve({ success: false, stdout, error: stderr });
      }
    });

    process.on("error", (error) => {
      resolve({ success: false, stdout, error: error.message });
    });
  });
}
