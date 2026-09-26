"use client";
import { useActionState, useState } from "react";
import { submitEnquiry, type EnquiryState } from "@/app/(portfolio)/actions";
import { BUDGETS, SHOOT_TYPES } from "@/lib/enquiry";

const input =
  "w-full bg-brand-gray border border-brand-rule px-4 py-3 text-brand-paper placeholder:text-brand-muted/70 " +
  "focus:border-brand-accent focus:outline-none transition-colors";
const label = "block text-sm text-brand-muted mb-2";

export default function EnquiryForm() {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, { status: "idle" });
  // When the form was first shown — lets the server tell people from instant bot posts.
  const [started] = useState(() => String(Date.now()));

  if (state.status === "sent") {
    return (
      <div role="status" className="border-l-2 border-brand-accent pl-6 py-2">
        <p className="font-apex-display text-3xl text-brand-paper">Thanks, your enquiry is in.</p>
        <p className="mt-3 text-brand-muted">I&apos;ll reply by email within a day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
      <input type="hidden" name="started" value={started} />
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label htmlFor="enq-name" className={label}>Your name</label>
        <input id="enq-name" name="name" required autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="enq-email" className={label}>Email</label>
        <input id="enq-email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="enq-phone" className={label}>Phone or WhatsApp (optional)</label>
        <input id="enq-phone" name="phone" type="tel" autoComplete="tel" placeholder="+65" className={input} />
      </div>
      <div>
        <label htmlFor="enq-type" className={label}>What&apos;s the shoot?</label>
        <select id="enq-type" name="shoot_type" defaultValue="" className={input}>
          <option value="">Choose one</option>
          {SHOOT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="enq-date" className={label}>Date (if you know it)</label>
        <input id="enq-date" name="shoot_date" type="date" className={`${input} [color-scheme:dark]`} />
      </div>
      <div>
        <label htmlFor="enq-budget" className={label}>Budget</label>
        <select id="enq-budget" name="budget" defaultValue="" className={input}>
          <option value="">Choose one</option>
          {BUDGETS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="enq-message" className={label}>Tell me about it</label>
        <textarea id="enq-message" name="message" required rows={5} className={input}
          placeholder="What's happening, where, and what you'd like to come away with." />
      </div>

      <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4">
        <button type="submit" disabled={pending}
          className="px-8 py-3.5 bg-brand-paper text-brand-dark font-medium hover:bg-white disabled:opacity-60 transition-colors">
          {pending ? "Sending…" : "Send enquiry"}
        </button>
        {state.status === "error" && <p role="alert" className="text-sm text-brand-accent">{state.message}</p>}
      </div>
    </form>
  );
}
