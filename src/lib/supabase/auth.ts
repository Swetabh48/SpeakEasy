import type { User } from "@supabase/supabase-js";
import {
  createClient as createServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export async function requireUser(): Promise<
  | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createServerClient>> }
  | { ok: false; status: number; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, error: "Auth is not configured" };
  }
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { ok: false, status: 401, error: "Not signed in" };
    }
    return { ok: true, user, supabase };
  } catch {
    return { ok: false, status: 503, error: "Auth is not configured" };
  }
}
