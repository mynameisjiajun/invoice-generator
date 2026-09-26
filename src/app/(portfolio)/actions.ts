"use server";
import { after } from "next/server";
import { gmailEnv, sendMail } from "@/lib/gmail";
import { looksLikeBot, parseEnquiry } from "@/lib/enquiry";

export type EnquiryState = { status: "idle" | "sent" | "error"; message?: string };

/** The website's enquiry form. Saves the enquiry for the admin inbox
 *  (/invoices_login/enquiries), then emails the owner a heads-up after the
 *  response has gone out, so the visitor never waits on Gmail. */
export async function submitEnquiry(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  // Pretend success to bots so they don't retry with tweaks.
  if (looksLikeBot(form)) return { status: "sent" };

  const parsed = parseEnquiry(form);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const enquiry = parsed.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const failed: EnquiryState = {
    status: "error",
    message: "Your enquiry didn't go through. Please email chuajiajun2705@gmail.com instead.",
  };
  if (!url || !key) return failed;

  try {
    // return=minimal: visitors may insert but never read enquiries back (RLS).
    const res = await fetch(`${url}/rest/v1/enquiries`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(enquiry),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("enquiry insert failed", res.status, await res.text());
      return failed;
    }
  } catch (e) {
    console.error("enquiry insert failed", e);
    return failed;
  }

  after(async () => {
    try {
      const to = gmailEnv().sender;
      await sendMail({
        to,
        subject: `New enquiry: ${enquiry.name}${enquiry.shoot_type ? ` (${enquiry.shoot_type})` : ""}`,
        body: [
          `${enquiry.name} <${enquiry.email}>${enquiry.phone ? `, ${enquiry.phone}` : ""}`,
          ...(enquiry.shoot_type ? [`Shoot: ${enquiry.shoot_type}`] : []),
          ...(enquiry.shoot_date ? [`Date: ${enquiry.shoot_date}`] : []),
          ...(enquiry.budget ? [`Budget: ${enquiry.budget}`] : []),
          "",
          enquiry.message,
          "",
          "Open it in your admin: https://apexcinematics.tech/invoices_login/enquiries",
        ].join("\n"),
      });
    } catch (e) {
      // The enquiry is saved either way; the email is only a heads-up.
      console.warn("enquiry notification email not sent:", e instanceof Error ? e.message : e);
    }
  });

  return { status: "sent" };
}
