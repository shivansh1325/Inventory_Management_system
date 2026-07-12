"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Send, PackageCheck, Truck, Lock } from "lucide-react";
import {
  submitRequisitionAction,
  decideRequisitionAction,
  markOrderedAction,
  receiveGoodsAction,
  closeRequisitionAction,
} from "@/lib/purchasing-actions";
import { fmtQty, fmtMoney, mulQty } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Line = {
  id: string;
  componentName: string;
  componentSku: string;
  unit: string;
  qtyRequested: number;
  qtyReceived: number;
  estUnitCost: number | null;
};

type PR = {
  id: string;
  prNo: string;
  status: string;
  note: string | null;
  raisedByName: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
  lines: Line[];
};

type Perms = { approve: boolean; approveBlockedByLimit: boolean; receive: boolean; raise: boolean };

export function RequisitionDetailClient({
  pr,
  perms,
  approvalLimitLabel,
}: {
  pr: PR;
  perms: Perms;
  approvalLimitLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [receiving, setReceiving] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Failed");
      else {
        toast.success(success);
        router.refresh();
      }
    });

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          {pr.note && <CardDescription>{pr.note}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Component</TH>
                <TH className="text-right">Requested</TH>
                <TH className="text-right">Received</TH>
                <TH className="text-right">Outstanding</TH>
                <TH className="text-right">Est. cost</TH>
              </TR>
            </THead>
            <TBody>
              {pr.lines.map((l) => {
                const outstanding = l.qtyRequested - l.qtyReceived;
                return (
                  <TR key={l.id}>
                    <TD>
                      <div className="font-medium">{l.componentName}</div>
                      <div className="font-mono text-xs text-slate-400">{l.componentSku}</div>
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">{fmtQty(l.qtyRequested)} {l.unit}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{fmtQty(l.qtyReceived)} {l.unit}</TD>
                    <TD className="text-right tabular-nums">
                      {outstanding > 0 ? (
                        <Badge tone="low">{fmtQty(outstanding)} {l.unit}</Badge>
                      ) : (
                        <Badge tone="ok">complete</Badge>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {l.estUnitCost != null ? fmtMoney(mulQty(l.qtyRequested, l.estUnitCost)) : "—"}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>History & actions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-slate-500">
            <li>
              Raised by <b className="text-slate-700">{pr.raisedByName ?? "—"}</b> on{" "}
              {new Date(pr.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </li>
            {pr.decidedByName && (
              <li>
                {pr.status === "REJECTED" ? "Rejected" : "Approved"} by{" "}
                <b className="text-slate-700">{pr.decidedByName}</b>
                {pr.decidedAt &&
                  ` on ${new Date(pr.decidedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                {pr.decisionComment && <span className="italic"> — “{pr.decisionComment}”</span>}
              </li>
            )}
          </ul>

          <div className="flex flex-wrap gap-2">
            {pr.status === "DRAFT" && perms.raise && (
              <Button disabled={pending} onClick={() => act(() => submitRequisitionAction(pr.id), "Submitted for approval")}>
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            )}
            {pr.status === "PENDING_APPROVAL" && perms.approve && (
              <>
                <Button disabled={pending} onClick={() => setDeciding("approve")}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button variant="destructive" disabled={pending} onClick={() => setDeciding("reject")}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </>
            )}
            {pr.status === "PENDING_APPROVAL" && perms.approveBlockedByLimit && (
              <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                <Lock className="h-4 w-4" /> Value exceeds your approval limit ({approvalLimitLabel}) — an Admin must decide.
              </p>
            )}
            {pr.status === "APPROVED" && perms.receive && (
              <Button variant="secondary" disabled={pending} onClick={() => act(() => markOrderedAction(pr.id), "Marked as ordered")}>
                <Truck className="h-4 w-4" /> Mark ordered
              </Button>
            )}
            {["APPROVED", "ORDERED"].includes(pr.status) && perms.receive && (
              <Button disabled={pending} onClick={() => setReceiving(true)}>
                <PackageCheck className="h-4 w-4" /> Receive goods
              </Button>
            )}
            {["RECEIVED", "REJECTED"].includes(pr.status) && perms.approve && (
              <Button variant="secondary" disabled={pending} onClick={() => act(() => closeRequisitionAction(pr.id), "Requisition closed")}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {deciding && (
        <DecisionDialog
          approve={deciding === "approve"}
          prNo={pr.prNo}
          pending={pending}
          onClose={() => setDeciding(null)}
          onConfirm={(comment) =>
            act(async () => {
              const res = await decideRequisitionAction(pr.id, deciding === "approve", comment);
              if (res.ok) setDeciding(null);
              return res;
            }, deciding === "approve" ? "Approved" : "Rejected")
          }
        />
      )}
      {receiving && (
        <ReceiveDialog
          lines={pr.lines}
          pending={pending}
          onClose={() => setReceiving(false)}
          onConfirm={(receipts) =>
            act(async () => {
              const res = await receiveGoodsAction(pr.id, receipts);
              if (res.ok) setReceiving(false);
              return res;
            }, "Goods received — stock updated via RECEIPT movements")
          }
        />
      )}
    </div>
  );
}

function DecisionDialog({
  approve,
  prNo,
  pending,
  onClose,
  onConfirm,
}: {
  approve: boolean;
  prNo: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{approve ? `Approve ${prNo}?` : `Reject ${prNo}?`}</DialogTitle>
        <DialogDescription>
          {approve
            ? "Approval allows goods to be ordered and received against this requisition."
            : "The requester will be notified with your comment."}
        </DialogDescription>
        <div className="mt-4 space-y-1">
          <Label>Comment {approve ? "(optional)" : "*"}</Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={approve ? "default" : "destructive"}
            disabled={pending || (!approve && !comment.trim())}
            title={!approve && !comment.trim() ? "A comment is required to reject" : undefined}
            onClick={() => onConfirm(comment)}
          >
            {approve ? "Approve" : "Reject"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({
  lines,
  pending,
  onClose,
  onConfirm,
}: {
  lines: Line[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (receipts: { lineId: string; qty: string }[]) => void;
}) {
  const open = lines.filter((l) => l.qtyRequested - l.qtyReceived > 0);
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(open.map((l) => [l.id, fmtQty(l.qtyRequested - l.qtyReceived)])),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Receive goods</DialogTitle>
        <DialogDescription>
          Partial receipts are fine — leave a line at 0 to skip it. Each receipt writes a
          RECEIPT movement into the requisition's warehouse.
        </DialogDescription>
        <div className="mt-4 space-y-2">
          {open.map((l) => (
            <div key={l.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.componentName}</div>
                <div className="text-xs text-slate-400">
                  outstanding {fmtQty(l.qtyRequested - l.qtyReceived)} {l.unit}
                </div>
              </div>
              <Input
                className="w-32 text-right"
                inputMode="decimal"
                value={qtys[l.id] ?? ""}
                onChange={(e) => setQtys((q) => ({ ...q, [l.id]: e.target.value }))}
              />
              <span className="w-8 text-xs text-slate-400">{l.unit}</span>
            </div>
          ))}
        </div>
        <FieldError message={error ?? undefined} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() => {
              const receipts = open.map((l) => ({ lineId: l.id, qty: (qtys[l.id] ?? "0").trim() || "0" }));
              if (receipts.every((r) => parseFloat(r.qty) === 0)) {
                setError("Enter at least one nonzero quantity");
                return;
              }
              onConfirm(receipts);
            }}
          >
            {pending ? "Receiving…" : "Receive"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
