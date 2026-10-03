#!/usr/bin/env python3
"""
Set Supabase Auth Site URL + redirect allow list to production (spkeasy.in).

Requires a Supabase personal access token (Account → Access Tokens), not the service role key:

  set SUPABASE_ACCESS_TOKEN=sbp_...
  python scripts/fix_supabase_auth_urls.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

REF = os.environ.get("SUPABASE_PROJECT_REF", "ogociwvswryczgqsiebp")
SITE = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://spkeasy.in").rstrip("/")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()

ALLOWED = [
    f"{SITE}/**",
    f"{SITE}/auth/callback",
    "http://localhost:3000/**",
    "http://127.0.0.1:3000/**",
]


def main() -> None:
    if not TOKEN:
        print(
            "Missing SUPABASE_ACCESS_TOKEN.\n"
            "1) https://supabase.com/dashboard/account/tokens → Generate\n"
            "2) set SUPABASE_ACCESS_TOKEN=sbp_...\n"
            "3) python scripts/fix_supabase_auth_urls.py\n"
            "Or set Site URL manually:\n"
            f"  https://supabase.com/dashboard/project/{REF}/auth/url-configuration\n"
            f"  Site URL = {SITE}\n"
            f"  Redirect URLs = {', '.join(ALLOWED)}",
            file=sys.stderr,
        )
        sys.exit(2)

    base = f"https://api.supabase.com/v1/projects/{REF}/config/auth"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    cfg = json.loads(urllib.request.urlopen(urllib.request.Request(base, headers=headers)).read())
    print("BEFORE site_url:", cfg.get("site_url"))
    print("BEFORE uri_allow_list:", cfg.get("uri_allow_list"))

    current = [u.strip() for u in (cfg.get("uri_allow_list") or "").split(",") if u.strip()]
    for u in ALLOWED:
        if u not in current:
            current.append(u)

    payload = json.dumps(
        {"site_url": SITE, "uri_allow_list": ",".join(current)}
    ).encode()
    req = urllib.request.Request(base, data=payload, headers=headers, method="PATCH")
    try:
        out = json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise
    print("AFTER site_url:", out.get("site_url"))
    print("AFTER uri_allow_list:", out.get("uri_allow_list"))


if __name__ == "__main__":
    main()
