"use server";
import { revalidatePath, updateTag } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { PORTFOLIO_TAG } from "@/lib/portfolio/data";

const OWNER_EMAIL = "chuajiajun2705@gmail.com";

/** Called by the admin page after every save so the public site shows the
 *  change on the next visit. Edits themselves go straight to Supabase from
 *  the browser (guarded by RLS); this only drops the cached pages, but it is
 *  still owner-only so strangers can't force rebuilds. getUser() (a network
 *  check) rather than getSession() because this is an authorization decision. */
export async function refreshPublicSite(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== OWNER_EMAIL) throw new Error("Not allowed");
  updateTag(PORTFOLIO_TAG);
  revalidatePath("/", "layout");
}
