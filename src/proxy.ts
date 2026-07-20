import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth gate only — reads the session from the cookie's JWT
// without a network round-trip to Supabase. Proxy runs on every route
// (including prefetches), so it must stay fast; a network call here means
// one slow/unreachable Supabase request stalls the entire app until Vercel
// kills the invocation (this is what caused the 504 MIDDLEWARE_INVOCATION_TIMEOUT
// outage when the Supabase project was paused). Real access control lives in
// Supabase RLS, which every table already enforces.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons).*)"],
};
