"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconCamera } from "@/components/icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
      overflow: "hidden",
      background: "var(--bg-primary)",
    }}>
      {/* Warm light-leak wash, like light bleeding onto film stock */}
      <div aria-hidden style={{
        position: "absolute",
        inset: "-20%",
        background: "radial-gradient(circle at 15% 10%, rgba(184, 69, 46, 0.20), transparent 45%), radial-gradient(circle at 85% 90%, rgba(166, 122, 30, 0.22), transparent 50%)",
        pointerEvents: "none",
      }} />

      <div className="animate-slide-up" style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        <div style={{
          textAlign: "center",
          marginBottom: 32,
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-accent)",
            color: "var(--text-on-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-default)",
          }}>
            <IconCamera size={26} />
          </div>
          <h1 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "1.9rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            marginBottom: 6,
          }}>
            JJ Visuals
          </h1>
          <p className="section-label" style={{ display: "inline-flex", marginBottom: 0 }}>
            Sign in to manage your invoices
          </p>
        </div>

        <form onSubmit={onSubmit} className="card" style={{
          padding: 28,
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          <div>
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="your@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" />
          </div>
          <div>
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" />
          </div>

          {error && (
            <div style={{
              background: "var(--warning-bg)",
              color: "var(--warning)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: "14px 20px", marginTop: 4 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
