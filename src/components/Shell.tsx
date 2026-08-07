"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 bg-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(232,168,73,0.18),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.12),transparent_65%)] blur-2xl" />
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3"
    >
      <span
        className={`relative inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_0_0_1px_rgba(232,168,73,0.12)] ${
          large ? "h-14 w-14" : "h-10 w-10"
        }`}
      >
        <span className="absolute inset-1 rounded-xl bg-[conic-gradient(from_210deg,#E8A849,#5EEAD4,#E8A849)] opacity-90" />
        <span className="relative font-display text-[var(--void)] font-bold tracking-tight">
          S
        </span>
      </span>
      <div className="leading-none">
        <div
          className={`font-display font-semibold tracking-tight ${
            large ? "text-3xl sm:text-4xl" : "text-xl"
          }`}
        >
          Speakeasy
        </div>
        {!large && (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            think · speak · improve
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-[var(--line)] bg-[var(--panel)]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
