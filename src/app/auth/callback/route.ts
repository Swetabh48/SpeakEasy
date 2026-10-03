import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSiteUrl } from "@/lib/supabase/siteUrl";

export async function GET(request: Request) {
  const site = getServerSiteUrl(request);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/sign-in?error=not_configured", site));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, site));
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=auth", site));
}
