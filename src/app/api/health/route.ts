/**
 * API Route: GET /api/health
 * Health check endpoint for Docker/Azure
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "vinculum",
  });
}