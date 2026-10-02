"use client";

import Link from "next/link";
import { signOutAndGoHome, useAuth } from "@/components/RequireAuth";

type Props = {
  next?: string;
  className?: string;
  /** Emphasize Sign out (e.g. profile account card) */
  variant?: "header" | "profile";
};

export function AuthButton({
  next = "/",
  className = "",
  variant = "header",
}: Props) {
  const { ready, user, configured } = useAuth();

  if (!ready) {
    return (
      <span
        className={`inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--muted)] ${className}`}
      >
        …
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(next)}`}
        className={
          variant === "profile"
            ? `inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] ${className}`
            : `inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-deep)] ${className}`
        }
      >
        Sign in
      </Link>
    );
  }

  const label =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Account";

  if (variant === "profile") {
    return (
      <button
        type="button"
        onClick={() => void signOutAndGoHome()}
        className={`inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-6 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-sm)] transition hover:border-red-400 hover:text-red-700 sm:w-auto ${className}`}
      >
        Sign out
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="hidden max-w-[140px] truncate text-sm text-[var(--muted)] sm:inline">
        {configured ? label : ""}
      </span>
      <button
        type="button"
        onClick={() => void signOutAndGoHome()}
        className="inline-flex h-10 cursor-pointer items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-sm)] transition hover:border-[var(--accent)]"
      >
        Sign out
      </button>
    </div>
  );
}
