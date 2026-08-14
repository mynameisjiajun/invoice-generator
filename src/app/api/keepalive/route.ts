// Pings Supabase on a schedule (see vercel.json's `crons` entry) so the
// free-tier project never sits idle long enough to auto-pause. A paused
// project causes real downtime until manually restored via the Management
// API — this is cheaper than that, and cheaper than upgrading to Pro.
//
// The ping MUST reach Postgres. Supabase's inactivity timer tracks database,
// REST and Edge Function traffic; endpoints that answer from config alone
// (GoTrue's /auth/v1/settings, which this route used to hit) return a happy
// 200 without the database ever seeing a query, so the project pauses anyway.
// Hence a real PostgREST select. RLS denies the anon key every row, so this
// comes back as an empty array — the query still ran, which is the point.
//
// The ping must not depend on a logged-in session, since a cron job has none.
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
    const res = await fetch(`${url}/rest/v1/businesses?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
    });
    // Fail loudly: a 200 here with `ok: false` would let Vercel record a
    // successful cron run while the project quietly drifted toward pausing.
    if (!res.ok) {
      return Response.json(
        { ok: false, status: res.status, checkedAt: new Date().toISOString() },
        { status: 502 },
      );
    }
    return Response.json({ ok: true, status: res.status, checkedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
