"use client";

import { MetaChip } from "@/components/Shell";
import type { ProctorStatus, ViolationEvent } from "@/lib/proctor/types";

export function ProctorOverlay({
  videoRef,
  status,
  violations,
  compact,
}: {
  videoRef: (el: HTMLVideoElement | null) => void;
  status: ProctorStatus;
  violations: ViolationEvent[];
  compact?: boolean;
}) {
  const latest = violations.slice(-8);
  return (
    <div
      className={`overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)]/90 ${
        compact ? "" : ""
      }`}
    >
      <div className={`relative bg-black/60 ${compact ? "aspect-[4/3]" : "aspect-video"}`}>
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <MetaChip>{status.active ? "camera on" : "camera off"}</MetaChip>
          <MetaChip>{status.faces} face</MetaChip>
          {status.tooClose && <MetaChip>too close — sit back</MetaChip>}
        </div>
        {latest.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 rounded-xl bg-red-950/80 px-2 py-1.5 text-[11px] text-red-200">
            Last: {latest[latest.length - 1]!.kind.replace(/-/g, " ")}
          </div>
        )}
      </div>
      <div className="border-t border-[var(--line)] p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Discipline · {violations.length} event{violations.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 max-h-20 overflow-y-auto text-sm text-[var(--muted)]">
          {violations.length === 0
            ? "Stay in fullscreen. Tab switch / leave page = violation."
            : latest
                .map((v) => `${v.kind}@${Math.round(v.atMs / 1000)}s`)
                .join(" · ")}
        </p>
      </div>
    </div>
  );
}
