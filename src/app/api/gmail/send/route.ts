import { createServerSupabase } from "@/lib/supabase/server";
import { createDraft, GmailAuthError, GmailNotConfiguredError, sendMail } from "@/lib/gmail";
import { emailMessage, emailSubject } from "@/lib/templates";
import { invoiceDocLabel, type Business, type Invoice } from "@/lib/types";

// Emails an invoice from the owner's Gmail, with the PDF attached.
//
// The client sends only the invoice id and the rendered PDF — never the
// recipient, subject or body. Those are derived here from the database, so a
// tampered request can't turn this route into an open relay for arbitrary mail
// from the owner's address. The worst a caller can do is email a real client
// their own real invoice.
//
// The PDF is generated in the browser (that's where @react-pdf/renderer and
// the QR code already run) and posted up as base64. Vercel Functions accept
// request bodies far larger than any invoice PDF.

export const maxDuration = 30;

/** Belt-and-braces cap. Invoice PDFs run to tens of KB; a logo pushes that to
 *  a few hundred. Anything past this is a bug or an abuse attempt, and
 *  rejecting it early keeps a malformed request from becoming a slow one. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Body = {
  invoiceId?: unknown;
  mode?: unknown;
  variant?: unknown;
  pdfBase64?: unknown;
};

function bad(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad("Not signed in", 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Malformed request body");
  }

  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  const mode = body.mode === "draft" ? "draft" : body.mode === "send" ? "send" : null;
  const variant = body.variant === "receipt" ? "receipt" : "invoice";
  const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  if (!invoiceId) return bad("Missing invoiceId");
  if (!mode) return bad("mode must be 'send' or 'draft'");
  if (!pdfBase64) return bad("Missing pdfBase64");

  const pdf = Buffer.from(pdfBase64, "base64");
  if (pdf.length === 0) return bad("Attachment was empty or not valid base64");
  if (pdf.length > MAX_PDF_BYTES) return bad("Attachment is too large");

  // RLS scopes both reads to the signed-in user's businesses.
  const { data: invoice, error: invErr } = await supabase
    .from("invoices").select("*, customers(*)").eq("id", invoiceId).single<Invoice>();
  if (invErr || !invoice) return bad("Invoice not found", 404);

  const { data: business, error: bizErr } = await supabase
    .from("businesses").select("*").eq("id", invoice.business_id).single<Business>();
  if (bizErr || !business) return bad("Business not found", 404);

  const to = invoice.customers?.email?.trim() ?? "";
  if (!to) return bad("This client has no email address saved — add one in Clients first.");

  const label = invoiceDocLabel(invoice, variant);
  const mail = {
    to,
    subject: variant === "receipt" ? label : emailSubject(invoice, business),
    body: emailMessage(invoice, business),
    senderName: business.payee_name || business.name,
    attachment: { filename: `${label}.pdf`, mimeType: "application/pdf", content: pdf },
  };

  try {
    const result = mode === "send" ? await sendMail(mail) : await createDraft(mail);
    return Response.json({
      ok: true,
      mode,
      id: result.id,
      to,
      // Gmail addresses a draft by its *message* id in the compose URL, but the
      // drafts endpoint returns the draft id; #drafts is the reliable landing
      // spot, and the new draft sits at the top of it.
      url: mode === "draft" ? "https://mail.google.com/mail/u/0/#drafts" : null,
    });
  } catch (e) {
    if (e instanceof GmailNotConfiguredError) return bad(e.message, 503);
    if (e instanceof GmailAuthError) return bad(e.message, 502);
    return bad(e instanceof Error ? e.message : "Sending failed", 502);
  }
}
