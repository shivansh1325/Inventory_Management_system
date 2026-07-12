"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

function Logo({ size = 44 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.logoUrl} alt={BRAND.company} className="h-full w-full object-contain" />
    </span>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (!res.ok) setError(res.error ?? "Sign-in failed");
      else if (res.mustChangePassword) router.replace("/change-password");
      else router.replace(params.get("from") || "/");
    });
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm" noValidate>
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <Logo size={40} />
        <div>
          <div className="text-base font-bold leading-tight text-slate-900">{BRAND.company}</div>
          <div className="text-sm text-slate-500">{BRAND.product}</div>
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back — enter your work credentials.</p>

      <div className="mt-7 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-11 w-full rounded-lg border border-slate-300 bg-surface pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-slate-300 bg-surface pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Access is provisioned by your administrator.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-app">
      {/* Brand panel — deliberately minimal */}
      <aside className="relative hidden w-[44%] shrink-0 flex-col overflow-hidden bg-[#221D6E] p-10 text-white lg:flex xl:p-14 dark:bg-[#171344]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(48rem 32rem at 115% -10%, #4F46E5 0%, transparent 60%), radial-gradient(40rem 28rem at -20% 115%, #1675BF 0%, transparent 55%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo />
          <div>
            <div className="text-lg font-bold leading-tight">{BRAND.company}</div>
            <div className="text-sm text-indigo-200">{BRAND.product}</div>
          </div>
        </div>

        <div className="relative flex flex-1 items-center">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-snug xl:text-[2.6rem] xl:leading-[1.2]">
              Inventory, production &amp; purchasing.
              <span className="mt-2 block text-indigo-300">One source of truth.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-indigo-200/90">
              Every stock movement audited. Every production run all-or-nothing.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-indigo-300/80">
          © {new Date().getFullYear()} {BRAND.company}. All rights reserved.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-w-0 flex-1 items-center justify-center px-6 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
