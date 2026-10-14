// Copy and small rules for the quote-focused homepage. Plain data (no React)
// so the server page can build FAQ JSON-LD from the same text the visitor sees.
import { SHOOT_TYPES } from "@/lib/enquiry";

export type ShootType = (typeof SHOOT_TYPES)[number];

/** Which form choice each service card's "Get a quote for this" preselects. */
export const SERVICE_SHOOT_TYPE: Record<"s1" | "s2" | "s3", ShootType> = {
  s1: "Corporate event",
  s2: "Documentary",
  s3: "Social media content",
};

export const PROCESS_STEPS = [
  { title: "Enquire", text: "Tell me what you need using the form or email. I reply within 24 hours." },
  { title: "Plan", text: "A quick call to lock in the brief, the date and your quote." },
  { title: "Shoot", text: "On the day, I work around your team with as little disruption as possible." },
  { title: "Deliver", text: "Edited files within 14 days, ready to post and share." },
];

export const FAQS = [
  {
    q: "How fast will I get my files?",
    a: "Edited files are delivered within 14 days of the shoot, for events and social content alike.",
  },
  {
    q: "Can we use the footage in ads?",
    a: "Yes. You get full usage rights for ads, social media and your website, at no extra cost.",
  },
  {
    q: "Can you shoot at short notice?",
    a: "Yes, if the date is free. Enquire as early as you can and I'll confirm availability within 24 hours.",
  },
  {
    q: "How do I get a quote?",
    a: "Send the form below or email contact@apexcinematics.tech. I'll reply within 24 hours with a free, no-obligation quote.",
  },
  {
    q: "Do you do ongoing social content?",
    a: "Yes. I can plan, shoot and edit Reels and TikToks with you every month, so your feed stays consistent.",
  },
];

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** The phone quote bar: hidden over the hero (it has its own button) and
 *  while the form is on screen (it would cover what they're typing). */
export function quoteBarVisible(heroInView: boolean, contactInView: boolean): boolean {
  return !heroInView && !contactInView;
}
