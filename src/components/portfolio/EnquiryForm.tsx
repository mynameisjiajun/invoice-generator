"use client";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { submitEnquiry, type EnquiryState } from "@/app/(portfolio)/actions";
import { BUDGETS, SHOOT_TYPES } from "@/lib/enquiry";

// Same visual language as the rest of the contact section: black fields,
// bold uppercase labels, orange focus and button.
const input =
  "w-full bg-black border border-neutral-800 p-4 text-white placeholder:text-neutral-600 " +
  "focus:border-brand-orange focus:outline-none transition-colors";
const label = "block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2";

export default function EnquiryForm() {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(submitEnquiry, { status: "idle" });
  // When the form was first shown — lets the server tell people from instant bot posts.
  const [started] = useState(() => String(Date.now()));

  if (state.status === "sent") {
    return (
      <div role="status" className="border-l-2 border-brand-orange pl-6 py-2">
        <p className="text-3xl font-apex-display font-bold text-white uppercase">Enquiry received</p>
        <p className="mt-2 text-neutral-400">Thanks — I&apos;ll reply by email within a day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <input type="hidden" name="started" value={started} />
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label htmlFor="enq-name" className={label}>Name</label>
        <input id="enq-name" name="name" required autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="enq-email" className={label}>Email</label>
        <input id="enq-email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="enq-phone" className={label}>Phone / WhatsApp <span className="text-neutral-700">(optional)</span></label>
        <input id="enq-phone" name="phone" type="tel" autoComplete="tel" placeholder="+65" className={input} />
      </div>
      <div>
        <label htmlFor="enq-type" className={label}>Type of shoot</label>
        <select id="enq-type" name="shoot_type" defaultValue="" className={input}>
          <option value="">Choose one</option>
          {SHOOT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="enq-date" className={label}>Date <span className="text-neutral-700">(if known)</span></label>
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
          className="group inline-flex items-center justify-center gap-3 px-10 py-4 bg-brand-orange text-white font-bold uppercase tracking-wider hover:bg-orange-600 disabled:opacity-60 transition-all">
          {pending ? "Sending…" : "Send enquiry"}
          {!pending && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
        </button>
        {state.status === "error" && <p role="alert" className="text-sm font-bold text-brand-orange">{state.message}</p>}
      </div>
    </form>
  );
}
