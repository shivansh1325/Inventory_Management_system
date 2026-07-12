"use client";

import { cn } from "@/lib/utils";

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
            active === t.key
              ? "border-primary text-primary dark:text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
