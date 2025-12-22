import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { cleanupOldTasks } from "@/lib/taskManager";

export async function GET(request: NextRequest) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret) {
      const requestSecret =
        request.headers.get("x-cron-secret") ||
        request.nextUrl.searchParams.get("secret");
      if (!requestSecret || requestSecret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const retentionHours = Number(process.env.GENERATION_TASK_RETENTION_HOURS);
    const deleted = await cleanupOldTasks(
      Number.isFinite(retentionHours) ? retentionHours : 1
    );
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Error cleaning up generation tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
