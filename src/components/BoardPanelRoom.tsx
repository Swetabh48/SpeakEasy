"use client";

import { motion } from "framer-motion";
import { BOARD_PANEL, type PanelMember } from "@/lib/boardPanel";

export function BoardPanelRoom({
  speakingId,
  listening,
}: {
  speakingId: string | null;
  listening?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-6">
      <p className="mb-4 text-center text-[11px] text-[var(--muted)]">
        Interview board · panel in session
      </p>
      <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5">
        {BOARD_PANEL.map((m, i) => (
          <Figurine
            key={m.id}
            member={m}
            speaking={speakingId === m.id}
            delay={i * 0.05}
            listening={listening}
          />
        ))}
      </div>
    </div>
  );
}

function Figurine({
  member,
  speaking,
  delay,
  listening,
}: {
  member: PanelMember;
  speaking: boolean;
  delay: number;
  listening?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex w-[72px] flex-col items-center sm:w-[96px]"
    >
      <motion.div
        animate={speaking ? { y: [0, -2, 0] } : { y: 0 }}
        transition={
          speaking
            ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
            : { duration: 0.25 }
        }
        className="relative"
      >
        <div
          className="mx-auto mt-10 h-16 w-14 rounded-t-md sm:h-20 sm:w-[4.25rem]"
          style={{
            background: speaking ? `${member.color}44` : "var(--panel-2)",
            border: speaking
              ? `1px solid ${member.color}`
              : "1px solid var(--line)",
          }}
        />
        <div
          className="absolute left-1/2 top-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--line)] sm:h-14 sm:w-14"
          style={{
            background: "#cbb79a",
            outline: speaking ? `2px solid ${member.color}` : undefined,
          }}
        >
          <span className="font-display text-xs font-bold text-[#2a1f14] sm:text-sm">
            {member.initials}
          </span>
        </div>
        {speaking && (
          <span
            className="absolute -right-1 top-2 h-2 w-2 rounded-full"
            style={{ background: member.color }}
          />
        )}
      </motion.div>
      <p className="mt-2 text-center font-display text-xs sm:text-sm">
        {member.name}
      </p>
      <p className="text-center text-[11px] text-[var(--muted)]">{member.role}</p>
    </motion.div>
  );
}
