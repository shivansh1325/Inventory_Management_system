"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * Confirmation dialog. For irreversible actions pass `typeToConfirm`
 * (e.g. the run number) — the user must type it exactly.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  typeToConfirm,
  onConfirm,
  onClose,
  pending,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  typeToConfirm?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const blocked = !!typeToConfirm && typed !== typeToConfirm;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          {destructive && <AlertTriangle className="h-5 w-5 text-danger" />}
          {title}
        </DialogTitle>
        <DialogDescription className="mt-1">{description}</DialogDescription>
        {typeToConfirm && (
          <div className="mt-4 space-y-1">
            <Label>
              Type <span className="font-mono font-semibold">{typeToConfirm}</span> to confirm
            </Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={blocked || pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
