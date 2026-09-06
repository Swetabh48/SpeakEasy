import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "speakeasy-board-api",
    mode: "next-edge-compatible",
  });
}
