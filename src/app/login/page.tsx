"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
};

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = useMemo(() => params.get("redirect") || "/", [params]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError || !data.session) {
      setError(authError?.message || "Login failed");
      return;
    }
    const expiresIn = data.session.expires_in || 3600;
    setCookie("sb-access-token", data.session.access_token, expiresIn);
    setCookie("sb-refresh-token", data.session.refresh_token, 60 * 60 * 24 * 30);
    router.push(redirectTo);
  };

  return (
    <div className="min-h-screen bg-[#f5f8f8] text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00778a]">
              Admin Access
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              UniMonitor Login
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to manage attendance dashboard.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="admin@kampus.ac.id"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Password</label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="????????"
                required
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#00778a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f6e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
