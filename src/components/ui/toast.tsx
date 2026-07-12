"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

const ToastContext = createContext<{ push: (kind: Toast["kind"], message: string) => void }>({
  push: () => {},
});

export function useToast() {
  const { push } = useContext(ToastContext);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  };
}

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-info" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-md border bg-surface px-3.5 py-2.5 text-sm shadow-overlay",
              t.kind === "error" ? "border-danger/40" : "border-slate-200",
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <span className="flex-1 text-slate-700">{t.message}</span>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
