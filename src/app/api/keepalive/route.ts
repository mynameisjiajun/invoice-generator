// Pings Supabase on a schedule (see vercel.json's `crons` entry) so the
// free-tier project never sits idle long enough to auto-pause. A paused
// project causes real downtime until manually restored via the Management
// API — this is cheaper than that, and cheaper than upgrading to Pro.
//
// The ping itself must not depend on a logged-in session (a cron job has
// none) or touch any RLS-protected data — it just hits Supabase Auth's
// public settings endpoint, which requires nothing but the anon key and
// still counts as project activity.
//
// If a CRON_SECRET env var is set (Vercel automatically sends it as
// `Authorization: Bearer <value>` for scheduled invocations once you add
// the var in the project's env settings), this route requires it — so a
// stranger can't repeatedly hit this endpoint. Until that var is set, the
// route works unauthenticated so it's usable immediately.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    return Response.json({ ok: res.ok, status: res.status, checkedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
