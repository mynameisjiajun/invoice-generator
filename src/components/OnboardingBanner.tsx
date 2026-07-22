"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useBusiness } from "@/lib/businessContext";
import { IconClose, IconSettings } from "@/components/icons";

const DISMISS_KEY = "jjv.onboarding.dismissed";

export default function OnboardingBanner() {
  const { activeBusiness } = useBusiness();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY));
  }, []);

  // Only nudge if the active business's details are still blank — i.e. the
  // owner hasn't reviewed Settings for it yet (true for every newly created
  // business, and for the original one before it's ever been configured).
  const show = !dismissed && !!activeBusiness && activeBusiness.address.trim() === "";

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
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
        <Link href="/invoices_login/settings" onClick={dismiss} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          Go to Settings
        </Link>
      </div>
      <button onClick={dismiss} className="onboarding-dismiss" aria-label="Dismiss">
        <IconClose size={14} />
      </button>
    </div>
  );
}
