"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 bg-fintech" />
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-[var(--line)] bg-[var(--panel)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <BrandMark />
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            Timed speaking and essay practice with evidence-based scoring,
            built for serious exam prep.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  Practice
                </Link>
              </li>
              <li>
                <Link
                  href="/engineering"
                  className="text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  Engineering
                </Link>
              </li>
              <li>
                <Link
                  href="/developers"
                  className="text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  Developers
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Company
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-[var(--ink)] transition hover:text-[var(--accent)]"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Legal
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink)]">
              <li>Privacy</li>
              <li>Terms</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--void)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Speakeasy. All rights reserved.</p>
          <p>think · speak · improve</p>
        </div>
      </div>
    </footer>
  );
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          large
            ? "inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] font-display text-xl font-bold text-white shadow-[var(--shadow-sm)]"
            : "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] font-display text-base font-bold text-white shadow-[var(--shadow-sm)]"
        }
      >
        S
      </span>
      <div className="leading-none">
        <div
          className={
            large
              ? "font-display text-2xl font-semibold tracking-tight sm:text-3xl"
              : "font-display text-xl font-semibold tracking-tight"
          }
        >
          Speakeasy
        </div>
        {!large && (
          <div className="mt-1 text-[11px] font-medium text-[var(--muted)]">
            think · speak · improve
          </div>
        )}
      </div>
    </div>
  );
}

export const navPillClass =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-sm)] transition hover:border-[var(--accent)]";

export function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[11px] font-medium text-[var(--muted)] shadow-[var(--shadow-sm)]">
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

export const TRUSTED_MARKS = [
  "UPSC",
  "IELTS",
  "CAT / IIM",
  "Bank PO",
  "CSS",
  "RBI Grade B",
  "State PSC",
  "XAT",
] as const;
