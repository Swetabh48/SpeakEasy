"use client";

import Link from "next/link";
import { BoardInterview } from "@/components/BoardInterview";
import { AuthButton } from "@/components/AuthButton";
import { RequireAuth } from "@/components/RequireAuth";
import { BrandMark, Shell, navPillClass } from "@/components/Shell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";

export default function BoardPage() {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setLive(Boolean(document.querySelector("[data-board-live='1']")));
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return (
    <RequireAuth next="/board">
      <Shell>
        {!live && (
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <Link href="/" className="rounded-2xl transition hover:opacity-90">
              <BrandMark />
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/profile" className={navPillClass}>
                Profile
              </Link>
              <Link href="/" className={navPillClass}>
                ← Practice
              </Link>
              <ThemeToggle />
              <AuthButton next="/board" />
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
    </RequireAuth>
  );
}
