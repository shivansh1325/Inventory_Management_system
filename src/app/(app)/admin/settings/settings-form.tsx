"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type Values = {
  companyName: string;
  currency: string;
  managerApprovalLimit: string;
  allowNegativeStock: boolean;
  lowStockAlerts: boolean;
};

export function SettingsForm({ initial }: { initial: Values }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveSettings(values);
      if (!res.ok) setError(res.error ?? "Failed");
      else toast.success("Settings saved");
    });

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Company name (shown in sidebar & slips)</Label>
              <Input
                value={values.companyName}
                onChange={(e) => setValues((v) => ({ ...v, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency symbol</Label>
              <Input
                className="w-24"
                value={values.currency}
                onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchasing</CardTitle>
          <CardDescription>
            Requisitions above this value cannot be approved by a Production Manager — they
            escalate to an Admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-64 space-y-1">
            <Label>Manager approval limit ({values.currency})</Label>
            <Input
              inputMode="decimal"
              value={values.managerApprovalLimit}
              onChange={(e) => setValues((v) => ({ ...v, managerApprovalLimit: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock behaviour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={values.allowNegativeStock}
              onChange={(e) => setValues((v) => ({ ...v, allowNegativeStock: e.target.checked }))}
            />
            <span>
              <span className="font-medium text-slate-800">Allow negative stock</span>
              <span className="block text-xs text-slate-500">
                OFF (recommended): production runs with any shortfall are blocked and deduct
                nothing. ON: runs proceed and stock can go negative — use only if your process
                back-fills receipts.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={values.lowStockAlerts}
              onChange={(e) => setValues((v) => ({ ...v, lowStockAlerts: e.target.checked }))}
            />
            <span>
              <span className="font-medium text-slate-800">Low-stock notifications</span>
              <span className="block text-xs text-slate-500">
                Notify purchasing-capable users when a component crosses below its minimum level.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <FieldError message={error ?? undefined} />
      <Button size="lg" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
