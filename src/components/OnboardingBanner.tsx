"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSettings } from "@/lib/db";
import { IconClose, IconSettings } from "@/components/icons";

const DISMISS_KEY = "jjv.onboarding.dismissed";
const DEFAULT_ADDRESS = "Blk 296A Compassvale Crescent #10-293, S541296";

export default function OnboardingBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    getSettings()
      .then((s) => {
        // Only nudge if the business details still look like the seeded
        // defaults — i.e. the owner likely hasn't reviewed Settings yet.
        if (s.address === DEFAULT_ADDRESS) setShow(true);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="onboarding-banner">
      <IconSettings size={20} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>Set up your business details</p>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 8 }}>
          Add your address, PayNow number, and bank details so every invoice is ready to send.
        </p>
        <Link href="/settings" onClick={dismiss} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          Go to Settings
        </Link>
      </div>
      <button onClick={dismiss} className="onboarding-dismiss" aria-label="Dismiss">
        <IconClose size={14} />
      </button>
    </div>
  );
}
