// Shared shape + validation for website enquiries. Pure, so the server action
// and tests use the same rules; the database repeats the size limits
// (018_enquiries.sql) as the last line of defence.

export const SHOOT_TYPES = ["Event", "Documentary", "Social media content", "Portraits or a photoshoot", "Something else"] as const;
export const BUDGETS = ["Under $500", "$500 to $1,000", "$1,000 to $2,500", "Over $2,500", "Not sure yet"] as const;

export type EnquiryInput = {
  name: string;
  email: string;
  phone: string;
  shoot_type: string;
  shoot_date: string | null;
  budget: string;
  message: string;
};

export type EnquiryStatus = "new" | "replied" | "booked" | "archived";

export type Enquiry = EnquiryInput & {
  id: string;
  created_at: string;
  status: EnquiryStatus;
  customer_id: number | null;
};

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Form → clean input, or a message saying what to fix. */
export function parseEnquiry(form: FormData): { ok: true; value: EnquiryInput } | { ok: false; error: string } {
  const value: EnquiryInput = {
    name: field(form, "name").slice(0, 120),
    email: field(form, "email").slice(0, 200),
    phone: field(form, "phone").slice(0, 40),
    shoot_type: field(form, "shoot_type"),
    shoot_date: field(form, "shoot_date") || null,
    budget: field(form, "budget"),
    message: field(form, "message").slice(0, 4000),
  };
  if (!value.name) return { ok: false, error: "Add your name so I know who to reply to." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return { ok: false, error: "That email address doesn't look right." };
  if (!value.message) return { ok: false, error: "Tell me a little about the shoot." };
  if (value.shoot_type && !(SHOOT_TYPES as readonly string[]).includes(value.shoot_type)) value.shoot_type = "";
  if (value.budget && !(BUDGETS as readonly string[]).includes(value.budget)) value.budget = "";
  if (value.shoot_date && !/^\d{4}-\d{2}-\d{2}$/.test(value.shoot_date)) value.shoot_date = null;
  return { ok: true, value };
}

/** Bots fill hidden fields and submit instantly; people do neither. */
export function looksLikeBot(form: FormData, now = Date.now()): boolean {
  if (field(form, "website")) return true;
  const raw = field(form, "started");
  const started = Number(raw);
  // A missing timestamp means the form wasn't filled in on the page.
  return !raw || !Number.isFinite(started) || now - started < 3000;
}
