import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const URL_ENV = "https://example.supabase.co";
const KEY_ENV = "anon-key";

function request(headers: Record<string, string> = {}) {
  return new Request("https://app.test/api/keepalive", { headers });
}

describe("keepalive route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_ENV;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = KEY_ENV;
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The whole point of the ping: Supabase's free-tier inactivity timer tracks
  // database/REST activity. A GoTrue endpoint like /auth/v1/settings answers
  // from config without touching Postgres, so it can leave the timer running.
  it("pings the REST API so the request reaches Postgres", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(request());

    expect(res.status).toBe(200);
    const pinged = String(fetchMock.mock.calls[0][0]);
    expect(pinged).toContain("/rest/v1/");
    expect(pinged).not.toContain("/auth/v1/");
  });

  it("sends the anon key as both apikey and bearer token, as PostgREST requires", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(request());

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(KEY_ENV);
    expect(headers.Authorization).toBe(`Bearer ${KEY_ENV}`);
  });

  it("reports failure when Supabase answers with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 503 })));

    const res = await GET(request());

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ ok: false, status: 503 });
  });

  it("rejects callers without the cron secret once one is configured", async () => {
    process.env.CRON_SECRET = "s3cret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the bearer token Vercel Cron sends", async () => {
    process.env.CRON_SECRET = "s3cret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));

    const res = await GET(request({ authorization: "Bearer s3cret" }));

    expect(res.status).toBe(200);
  });
});
