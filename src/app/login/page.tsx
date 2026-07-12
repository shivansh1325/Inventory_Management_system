"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Factory } from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (!res.ok) setError(res.error ?? "Sign-in failed");
      else router.replace(params.get("from") || "/");
    });
  };

  return (
    <Card className="w-full max-w-sm shadow-overlay">
      <CardContent className="p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">Assembly Line</div>
            <div className="text-sm text-slate-500">Inventory Manager</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          Demo logins — <b>admin@demo.local</b>, <b>manager@demo.local</b>, <b>store@demo.local</b>,{" "}
          <b>operator@demo.local</b> · password <b>demo1234</b>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
