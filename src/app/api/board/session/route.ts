import { NextResponse } from "next/server";
import { createSession } from "@/lib/boardAgent/store";
import type { CandidateProfile } from "@/lib/topics/board";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { profile?: CandidateProfile };
    if (!body.profile?.name?.trim()) {
      return NextResponse.json({ error: "profile required" }, { status: 400 });
    }
    const rec = createSession(body.profile);
    return NextResponse.json({
      sessionId: rec.sessionId,
      profileId: rec.profileId,
      track: rec.profile.track,
      startedAt: rec.startedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "session failed" },
      { status: 500 },
    );
  }
}
