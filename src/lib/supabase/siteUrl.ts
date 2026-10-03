/**
 * Canonical public site origin for auth redirects.
 * Never fall back to localhost in production — that sends Google sign-in
 * users to the developer's machine.
 */

const PROD_FALLBACK = "https://spkeasy.in";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Browser / client: on real hosts always use public site URL; localhost keeps local origin. */
export function getClientSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || PROD_FALLBACK;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      // Local dev only — magic links / OAuth return to this machine
      return stripTrailingSlash(window.location.origin);
    }
    // Production / preview / any public host — never send users to localhost
    return stripTrailingSlash(configured);
  }

  return stripTrailingSlash(configured);
}

/** Server routes (auth callback): honor proxy headers + env; never prefer localhost over prod. */
export function getServerSiteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    "";

  if (host && host !== "localhost" && !host.startsWith("127.0.0.1")) {
    return stripTrailingSlash(`${proto}://${host}`);
  }

  // Vercel system env
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
    || process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withProto = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return stripTrailingSlash(withProto);
  }

  try {
    const { origin } = new URL(request.url);
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return stripTrailingSlash(origin);
    }
  } catch {
    /* ignore */
  }

  return PROD_FALLBACK;
}

export function authCallbackUrl(siteUrl: string, nextPath: string): string {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${stripTrailingSlash(siteUrl)}/auth/callback?next=${encodeURIComponent(next)}`;
}
