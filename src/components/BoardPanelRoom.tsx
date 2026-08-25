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
    <div className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[radial-gradient(ellipse_at_50%_0%,#1a2230_0%,#0b0e14_70%)] p-4 sm:p-6">
      <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="flex w-[72px] flex-col items-center sm:w-[96px]"
    >
      <motion.div
        animate={
          speaking
            ? { scale: [1, 1.06, 1], y: [0, -4, 0] }
            : listening
              ? { scale: 1 }
              : { scale: 1 }
        }
        transition={
          speaking
            ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
            : { duration: 0.3 }
        }
        className="relative"
      >
        {/* torso */}
        <div
          className="mx-auto mt-10 h-16 w-14 rounded-t-[28px] sm:h-20 sm:w-[4.25rem]"
          style={{
            background: `linear-gradient(160deg, ${member.color}55, #12161d 70%)`,
            boxShadow: speaking
              ? `0 0 0 2px ${member.color}, 0 0 24px ${member.color}66`
              : `0 0 0 1px rgba(243,239,230,0.12)`,
          }}
        />
        {/* head */}
        <div
          className="absolute left-1/2 top-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border sm:h-14 sm:w-14"
          style={{
            background: `radial-gradient(circle at 35% 30%, #f5e6d3, #c4a484 55%, #8b6b4a)`,
            borderColor: speaking ? member.color : "rgba(243,239,230,0.15)",
          }}
        >
          <span className="font-display text-xs font-bold text-[#2a1f14] sm:text-sm">
            {member.initials}
          </span>
        </div>
        {speaking && (
          <motion.span
            className="absolute -right-1 top-2 h-2 w-2 rounded-full"
            style={{ background: member.color }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </motion.div>
      <p className="mt-2 text-center font-display text-xs sm:text-sm">{member.name}</p>
      <p className="text-center font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {member.role}
      </p>
    </motion.div>
  );
}
