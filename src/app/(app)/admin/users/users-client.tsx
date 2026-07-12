"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, UserX, UserCheck, KeyRound, Users } from "lucide-react";
import { z } from "zod";
import { userSchema } from "@/lib/validation";
import { saveUser, setUserActive, forcePasswordReset } from "@/lib/admin-actions";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

const roleTone = { ADMIN: "info", MANAGER: "ok", STORE: "low", OPERATOR: "neutral" } as const;

export function UsersClient({ meId, users }: { meId: string; users: UserRow[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<UserRow | null | "new">(null);
  const [toggling, setToggling] = useState<UserRow | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = useMemo<ColumnDef<UserRow, any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name}
            {row.original.id === meId && <Badge tone="neutral" className="ml-2">you</Badge>}
            {!row.original.isActive && <Badge tone="out" className="ml-2">deactivated</Badge>}
            {row.original.mustChangePassword && row.original.isActive && (
              <Badge tone="low" className="ml-2">must change password</Badge>
            )}
          </span>
        ),
      },
      { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-slate-500">{getValue<string>()}</span> },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ getValue }) => {
          const r = getValue<string>() as keyof typeof roleTone;
          return <Badge tone={roleTone[r] ?? "neutral"}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Badge>;
        },
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return (
            <span className="text-xs text-slate-500">
              {v
                ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "never"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(u)} aria-label="Edit" title="Edit name / email / role">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Force password reset"
                onClick={() =>
                  startTransition(async () => {
                    const res = await forcePasswordReset(u.id);
                    if (!res.ok) toast.error(res.error ?? "Failed");
                    else toast.info(`Temporary password for ${u.name}: ${res.tempPassword} (share securely — they must change it at next login)`);
                  })
                }
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={u.id === meId}
                title={u.id === meId ? "You cannot deactivate yourself" : u.isActive ? "Deactivate" : "Reactivate"}
                onClick={() => setToggling(u)}
              >
                {u.isActive ? (
                  <UserX className="h-3.5 w-3.5 text-danger" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5 text-success" />
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [meId, toast, startTransition],
  );

  return (
    <>
      <div className="mb-4 grid gap-2 rounded-card border border-slate-200 bg-surface p-4 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r}>
            <Badge tone={roleTone[r]}>{ROLE_LABELS[r]}</Badge>
            <p className="mt-1 leading-relaxed">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Search users…"
        exportName="users"
        exportRow={(u) => ({ Name: u.name, Email: u.email, Role: u.role, Active: u.isActive ? "yes" : "no" })}
        toolbar={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
        emptyState={<EmptyState icon={Users} title="No users" />}
      />

      {editing !== null && (
        <UserFormDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling.name}?`}
          destructive={toggling.isActive}
          description={
            toggling.isActive
              ? "They will be signed out and unable to log in. Their history in the audit trail is preserved. You can reactivate at any time."
              : "They will be able to sign in again."
          }
          confirmLabel={toggling.isActive ? "Deactivate" : "Reactivate"}
          pending={pending}
          onClose={() => setToggling(null)}
          onConfirm={() =>
            startTransition(async () => {
              const res = await setUserActive(toggling.id, !toggling.isActive);
              if (!res.ok) toast.error(res.error ?? "Failed");
              else {
                toast.success(toggling.isActive ? "User deactivated" : "User reactivated");
                setToggling(null);
              }
            })
          }
        />
      )}
    </>
  );
}

type UserInput = z.infer<typeof userSchema>;

function UserFormDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, role: user.role as UserInput["role"], password: "" }
      : { role: "OPERATOR", password: "" },
  });
  const role = watch("role");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{user ? "Edit user" : "Invite user"}</DialogTitle>
        <DialogDescription>
          {user
            ? "Role changes apply on the user's next request."
            : "New users must change their password at first login."}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={handleSubmit((data) =>
            startTransition(async () => {
              const res = await saveUser(user?.id ?? null, data);
              if (!res.ok) setServerError(res.error ?? "Failed");
              else {
                toast.success(user ? "User updated" : "User created");
                onClose();
              }
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Role *</Label>
            <Select {...register("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
            <p className="text-xs text-slate-400">{ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}</p>
          </div>
          {!user && (
            <div className="space-y-1">
              <Label>Initial password * (min 8 chars)</Label>
              <Input type="password" {...register("password")} />
              <FieldError message={errors.password?.message as string | undefined} />
            </div>
          )}
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
