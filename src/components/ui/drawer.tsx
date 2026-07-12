"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Right-side sheet for detail views. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-surface shadow-overlay focus:outline-none",
            wide ? "max-w-2xl" : "max-w-lg",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
