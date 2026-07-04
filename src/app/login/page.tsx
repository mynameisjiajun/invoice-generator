"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      background: "linear-gradient(135deg, #F8F9FC 0%, #EEEDF5 50%, #E8F4FD 100%)",
    }}>
      <div className="animate-slide-up" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{
          textAlign: "center",
          marginBottom: 32,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "var(--bg-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            boxShadow: "var(--shadow-lg)",
          }}>
            <span style={{ color: "white", fontWeight: 800, fontSize: "1.25rem", letterSpacing: 2 }}>JJ</span>
          </div>
          <h1 style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 4,
          }}>
            JJ Visuals
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
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
