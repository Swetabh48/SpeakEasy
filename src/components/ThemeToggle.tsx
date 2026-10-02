"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "speakeasy-theme";

function applyTheme(nextDark: boolean) {
  document.documentElement.classList.toggle("dark", nextDark);
  localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        applyTheme(next);
        setDark(next);
      }}
      aria-label={ready && dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[var(--shadow-sm)] transition hover:border-[var(--accent)] ${className}`}
    >
      <span suppressHydrationWarning className="inline-flex">
        {ready && dark ? (
          <Sun className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Moon className="h-4 w-4" strokeWidth={1.75} />
        )}
      </span>
    </button>
  );
}
