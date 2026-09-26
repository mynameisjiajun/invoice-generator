"use client";
import { useEffect } from "react";

// Registers public/invoice-sw.js for the invoice app so it opens offline.
// Production only: in dev a cached page would mask hot-reloaded changes.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/invoice-sw.js", { scope: "/invoices_login" }).catch((e) => {
      console.warn("service worker not registered:", e);
    });
  }, []);
  return null;
}

/** Drops cached invoice/client data from this device (call on sign-out). */
export function clearOfflineData() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-data" });
}
