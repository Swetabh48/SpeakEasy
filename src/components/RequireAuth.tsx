"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { mergeLocalAfterLogin } from "@/lib/userData";

type AuthState = {
  ready: boolean;
  user: User | null;
  configured: boolean;
};

/** Shared auth subscription for gated pages + AuthButton */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
      if (event === "SIGNED_IN" && session?.user) {
        try {
          await mergeLocalAfterLogin();
        } catch {
          /* non-fatal */
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured]);

  return { ready, user, configured };
}

export async function signOutAndGoHome() {
  if (!isSupabaseConfigured()) {
    window.location.href = "/sign-in";
    return;
  }
  const { clearMergeFlag } = await import("@/lib/userData");
  await clearMergeFlag();
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/sign-in";
}

/** Blocks practice / profile / board until signed in. */
export function RequireAuth({
  children,
  next = "/",
}: {
  children: ReactNode;
  next?: string;
}) {
  const { ready, user, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!configured) {
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [ready, user, configured, next, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--muted)]">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-[var(--muted)]">Sign in required</p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
