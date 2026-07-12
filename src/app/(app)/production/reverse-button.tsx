"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { reverseRunAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function ReverseRunButton({ runId, runNo }: { runId: string; runNo: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" /> Reverse
      </Button>
      {open && (
        <ConfirmDialog
          title={`Reverse ${runNo}?`}
          destructive
          typeToConfirm={runNo}
          description="All consumed components will be returned to stock (from this run's snapshot, not the live BOM) and the produced quantity removed from finished stock. The run will be marked CANCELLED. This cannot be un-done."
          confirmLabel="Reverse run"
          pending={pending}
          onClose={() => setOpen(false)}
          onConfirm={() =>
            startTransition(async () => {
              const res = await reverseRunAction(runId);
              if (!res.ok) toast.error(res.error ?? "Reversal failed");
              else {
                toast.success(`${runNo} reversed — stock restored`);
                setOpen(false);
              }
            })
          }
        />
      )}
    </>
  );
}
