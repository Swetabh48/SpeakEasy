"use client";

import Link from "next/link";
import { BoardInterview } from "@/components/BoardInterview";
import { BrandMark, Shell } from "@/components/Shell";
import { useEffect, useState } from "react";

export default function BoardPage() {
  const [live, setLive] = useState(false);

  // BoardInterview sets fixed overlay when live; hide chrome then.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setLive(Boolean(document.querySelector("[data-board-live='1']")));
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return (
    <Shell>
      {!live && (
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="rounded-2xl transition hover:opacity-90">
            <BrandMark />
          </Link>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm"
            >
              Profile
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm"
            >
              ← Practice
            </Link>
          </div>
        </header>
      )}
      <main
        className={
          live
            ? "flex-1"
            : "mx-auto w-full max-w-6xl flex-1 px-5 pb-16 sm:px-8"
        }
      >
        <BoardInterview />
      </main>
    </Shell>
  );
}
